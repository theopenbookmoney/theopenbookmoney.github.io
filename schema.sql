-- The Open Book newsletter subscriber table (Cloudflare D1)
CREATE TABLE IF NOT EXISTS subscribers (
  email TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | active | unsubscribed
  confirm_token TEXT,                          -- double opt-in token
  unsubscribe_token TEXT NOT NULL,             -- one-click unsubscribe token
  source TEXT,                                 -- page path the signup came from
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT,
  unsubscribed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subscribers_confirm ON subscribers(confirm_token);
