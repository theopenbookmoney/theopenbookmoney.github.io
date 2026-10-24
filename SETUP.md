# The Open Book — DIY email capture: setup guide

Staged and ready. No code work left; everything below happens in the user's
own accounts, in one sitting (~30–45 min). Nothing sensitive goes through
chat — API keys are entered directly in Cloudflare's dashboard.

**What it is:** a Cloudflare Worker holds the signup form logic, subscriber
list lives in the user's own Cloudflare D1 database, and emails go out
through Resend's free tier (3,000 emails/month, 100/day — plenty: the list
starts at zero and updates go out only on tracker refreshes and new tools).
Double opt-in (confirmation email) = express consent under Canada's
anti-spam law; every broadcast carries a one-click unsubscribe link.

## User's steps

### 1. Resend (free) — the mail sender
1. Create a free account at resend.com.
2. Add your domain: Domains → Add Domain → `theopenbookmoney.com`.
3. Resend shows 3 DNS records (SPF + 2 DKIM). In Hostinger (hPanel → DNS):
   add them exactly as shown. Wait for "Verified" in Resend (usually minutes).
4. In Resend → API Keys → create a key, name it `open-book-worker`.
   **Copy it now — Resend shows it once.** You will paste it into Cloudflare
   in step 3; never send it in chat.

### 2. Cloudflare (free) — the signup backend
1. Create a free account at cloudflare.com.
2. Workers & Pages → Create → Create Worker → name it `open-book-newsletter`.
3. Replace the default worker code with the contents of `worker.js` in this
   folder (copy-paste in the dashboard editor; or `npx wrangler deploy`
   from this folder after `wrangler login`).
4. Create the database: Workers & Pages → D1 → Create → name
   `open-book-subscribers` → run the contents of `schema.sql` in its Console.
   Bind it to the worker as variable name `DB` (Settings → Bindings).
   (If using wrangler.toml, paste the database_id `wrangler d1 create` prints.)
5. Settings → Variables → add these secrets (encrypted at rest):
   - `RESEND_API_KEY` — the key from step 1.4
   - `FROM_EMAIL` — `updates@theopenbookmoney.com` (must be on the domain
     verified in Resend)
   - `ADMIN_KEY` — invent a long random password; it's the password for the
     send page
   - `PUBLIC_URL` — the worker's public URL after deploy
     (e.g. `https://open-book-newsletter.<your-account>.workers.dev`)
6. Deploy.

### 3. Put the form on the site
1. In `signup-form-snippet.html` (this folder), replace `__WORKER_URL__`
   with the worker's public URL.
2. Tell Muse: "DIY email it is — wire it up." Muse drops the snippet into
   the tools hub + tracker pages, rebuilds, and deploys. That's the only
   Muse-side step, and it's already staged.

### 4. Sending an update
- Open `<PUBLIC_URL>/api/admin`, enter the ADMIN_KEY, write subject +
  message, send. Goes to every confirmed subscriber; unsubscribe footer is
  added automatically.

## Costs and limits
- Cloudflare Workers + D1 free tiers: far above what a new list needs.
- Resend free: 3,000 emails/month, 100/day. If the list ever outgrows that,
  that's a good problem — it means the project is earning, and the
  no-spend-before-revenue rule can be revisited then.

## Files in this folder
- `worker.js` — the whole backend (subscribe / confirm / unsubscribe /
  admin send page / broadcast)
- `schema.sql` — one table, run once in D1
- `wrangler.toml` — deploy config (optional; dashboard copy-paste works too)
- `signup-form-snippet.html` — the static-site form section (staged)
- `SETUP.md` — this file
