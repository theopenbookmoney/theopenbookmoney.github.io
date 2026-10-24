// The Open Book — newsletter signup worker (Cloudflare Workers + D1 + Resend)
// Endpoints:
//   POST /api/subscribe   {email, source?} -> sends double opt-in email
//   GET  /api/confirm?token=...           -> activates subscription
//   GET  /api/unsubscribe?token=...       -> unsubscribes (one click)
//   GET  /api/admin                       -> password-gated send page
//   POST /api/broadcast   {key, subject, html} -> sends to all active
//
// Bindings: D1 database named DB.
// Secrets (set in Cloudflare dashboard, never in code): RESEND_API_KEY,
// FROM_EMAIL (e.g. updates@theopenbookmoney.com), ADMIN_KEY, PUBLIC_URL
// (the worker's public URL, e.g. https://signup.theopenbookmoney.com)

const RESEND_API = "https://api.resend.com/emails";

function response(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

function htmlResponse(title, body) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
      `<body style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:34rem;margin:4rem auto;padding:0 1.5rem;line-height:1.6;color:#1a1a2e;">${body}</body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

function randomToken() {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

function plainTextFromHtml(html) {
  // A plain-text version of the email body. Links keep their address
  // visible ("Yes, notify me (https://...)") so the email still works in
  // clients that strip or disable clickable links, like Yahoo Mail does
  // for messages it distrusts.
  return html
    .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
    .replace(/<\/p>\s*/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sendEmail(env, to, subject, htmlBody, listUnsub) {
  const headers = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    "Content-Type": "application/json",
  };
  const payload = {
    from: env.FROM_EMAIL,
    to: [to],
    subject,
    html: htmlBody,
    text: plainTextFromHtml(htmlBody),
  };
  if (listUnsub) payload.headers = { "List-Unsubscribe": `<${listUnsub}>` };
  const r = await fetch(RESEND_API, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Resend error ${r.status}: ${await r.text()}`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") return response({});

    // ---------- subscribe ----------
    if (path === "/api/subscribe" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return response({ error: "bad request" }, 400);
      }
      const email = String(body.email || "").trim().toLowerCase();
      if (!isValidEmail(email)) return response({ error: "invalid email" }, 400);
      const source = String(body.source || "").slice(0, 80);

      const confirmToken = randomToken();
      const unsubToken = randomToken();
      const existing = await env.DB.prepare(
        "SELECT email, status FROM subscribers WHERE email = ?"
      )
        .bind(email)
        .first();

      if (existing && existing.status === "active") {
        // Already subscribed — say so without leaking anything new.
        return response({ ok: true, already: true });
      }

      await env.DB.prepare(
        `INSERT INTO subscribers (email, status, confirm_token, unsubscribe_token, source)
         VALUES (?, 'pending', ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET status='pending', confirm_token=excluded.confirm_token,
         source=excluded.source`
      )
        .bind(email, confirmToken, unsubToken, source)
        .run();

      const confirmUrl = `${env.PUBLIC_URL}/api/confirm?token=${confirmToken}`;
      await sendEmail(
        env,
        email,
        "Confirm your Open Book updates",
        `<p>You're one click away from getting notified when The Open Book refreshes a tracker or ships a new tool.</p>` +
          `<p><a href="${confirmUrl}">Yes, notify me</a></p>` +
          `<p style="color:#6b7280;font-size:0.9rem;">Button not working? Copy and paste this link into your browser:<br>${confirmUrl}</p>` +
          `<p style="color:#6b7280;font-size:0.9rem;">Didn't ask for this? Ignore this email — nothing happens until you click.</p>`
      );
      return response({ ok: true });
    }

    // ---------- confirm (double opt-in) ----------
    if (path === "/api/confirm" && request.method === "GET") {
      const token = url.searchParams.get("token") || "";
      const row = await env.DB.prepare(
        "SELECT email FROM subscribers WHERE confirm_token = ?"
      )
        .bind(token)
        .first();
      if (!row) return htmlResponse("Link expired", "<h1>That link doesn't work</h1><p>It may have been used already. Try signing up again on the site.</p>");
      await env.DB.prepare(
        "UPDATE subscribers SET status='active', confirmed_at=datetime('now'), confirm_token=NULL WHERE email = ?"
      )
        .bind(row.email)
        .run();
      return htmlResponse(
        "You're in",
        "<h1>You're on the list</h1><p>You'll get one email when a tracker is refreshed or a new tool ships. Unsubscribe anytime with one click.</p>"
      );
    }

    // ---------- unsubscribe (one click) ----------
    if (path === "/api/unsubscribe" && request.method === "GET") {
      const token = url.searchParams.get("token") || "";
      const row = await env.DB.prepare(
        "SELECT email, status FROM subscribers WHERE unsubscribe_token = ?"
      )
        .bind(token)
        .first();
      if (row && row.status !== "unsubscribed") {
        await env.DB.prepare(
          "UPDATE subscribers SET status='unsubscribed', unsubscribed_at=datetime('now') WHERE email = ?"
        )
          .bind(row.email)
          .run();
      }
      return htmlResponse(
        "Unsubscribed",
        "<h1>You're off the list</h1><p>No more emails from The Open Book. Sorry to see you go.</p>"
      );
    }

    // ---------- admin page (password = ADMIN_KEY) ----------
    if (path === "/api/admin" && request.method === "GET") {
      return htmlResponse(
        "Send update",
        `<h1>Send an update</h1>
        <p style="color:#6b7280">Sends to every active subscriber. The footer with the unsubscribe link is added automatically.</p>
        <form id="f">
          <p><label>Admin key<br><input type="password" name="key" style="width:100%;padding:0.6rem" required></label></p>
          <p><label>Subject<br><input name="subject" style="width:100%;padding:0.6rem" required></label></p>
          <p><label>Message (plain text is fine)<br><textarea name="body" rows="12" style="width:100%;padding:0.6rem" required></textarea></label></p>
          <p><button type="submit" id="sendbtn" style="padding:0.7rem 1.5rem;font-size:1rem" disabled>Enter your admin key to see the count</button></p>
        </form>
        <p id="countline"></p>
        <p id="out"></p>
        <script>
        var keyEl = document.querySelector('input[name="key"]');
        var countEl = document.getElementById('countline');
        var sendBtn = document.getElementById('sendbtn');
        var timer = null;
        keyEl.addEventListener('input', function () {
          clearTimeout(timer);
          timer = setTimeout(refreshCount, 600);
        });
        async function refreshCount() {
          var k = keyEl.value.trim();
          if (!k) { countEl.textContent = ""; sendBtn.disabled = true;
            sendBtn.textContent = "Enter your admin key to see the count"; return; }
          try {
            var r = await fetch('/api/count', { method: 'POST',
              headers: {'content-type':'application/json'},
              body: JSON.stringify({ key: k }) });
            if (!r.ok) { countEl.textContent = "Wrong admin key."; sendBtn.disabled = true; return; }
            var j = await r.json();
            countEl.textContent = "This will send to " + j.active + " active subscriber" + (j.active === 1 ? "" : "s") + ".";
            sendBtn.disabled = false;
            sendBtn.textContent = "Send to " + j.active + " subscriber" + (j.active === 1 ? "" : "s");
          } catch (e) {
            countEl.textContent = "Couldn't reach the worker.";
          }
        }
        document.getElementById('f').addEventListener('submit', async (e) => {
          e.preventDefault();
          const d = new FormData(e.target);
          const out = document.getElementById('out');
          if (sendBtn.disabled) return;
          if (!confirm('Send this to the list?')) return;
          out.textContent = 'Sending…';
          const r = await fetch('/api/broadcast', { method: 'POST',
            headers: {'content-type':'application/json'},
            body: JSON.stringify({ key: d.get('key'), subject: d.get('subject'), body: d.get('body') }) });
          const j = await r.json();
          out.textContent = r.ok ? ('Sent to ' + j.sent + ' subscribers.') : ('Error: ' + (j.error || r.status));
        });
        </script>`
      );
    }

    // ---------- subscriber count (for the admin send page) ----------
    if (path === "/api/count" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return response({ error: "bad request" }, 400);
      }
      if (!body.key || body.key !== env.ADMIN_KEY)
        return response({ error: "unauthorized" }, 401);
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM subscribers WHERE status='active'"
      ).first();
      return response({ ok: true, active: row ? row.n : 0 });
    }
    if (path === "/api/broadcast" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return response({ error: "bad request" }, 400);
      }
      if (!body.key || body.key !== env.ADMIN_KEY)
        return response({ error: "unauthorized" }, 401);
      const subject = String(body.subject || "").slice(0, 200);
      const msg = String(body.body || "").slice(0, 20000);
      if (!subject || !msg) return response({ error: "subject and body required" }, 400);

      const rows = await env.DB.prepare(
        "SELECT email, unsubscribe_token FROM subscribers WHERE status='active'"
      ).all();

      let sent = 0;
      for (const r of rows.results || []) {
        const unsub = `${env.PUBLIC_URL}/api/unsubscribe?token=${r.unsubscribe_token}`;
        const htmlBody =
          `<div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:34rem;line-height:1.6;color:#1a1a2e;">` +
          msg.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>").replace(/^/, "<p>").concat("</p>") +
          `<hr style="border:none;border-top:1px solid #e5e1da;margin:2rem 0">` +
          `<p style="color:#6b7280;font-size:0.85rem;">The Open Book — money, explained.<br>` +
          `<a href="${unsub}">Unsubscribe</a> with one click.</p></div>`;
        try {
          await sendEmail(env, r.email, subject, htmlBody, unsub);
          sent++;
        } catch (e) {
          // keep going; one bad address must not kill the batch
        }
      }
      return response({ ok: true, sent });
    }

    return response({ error: "not found" }, 404);
  },
};
