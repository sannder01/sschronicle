-- ChatGPT access is opt-in per account: a signed-in user issues a short-lived
-- code and the bridge redeems it for the verified ChatGPT email.
CREATE TABLE chatgpt_link_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX chatgpt_link_codes_user_idx ON chatgpt_link_codes (user_id);

CREATE TABLE chatgpt_links (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX chatgpt_links_email_idx ON chatgpt_links (lower(email));

-- Fixed-window counters shared by every serverless instance.
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX rate_limits_window_idx ON rate_limits (window_start);

-- XP is awarded only for tasks completed after they were created.
ALTER TABLE tasks ADD COLUMN completed_at TIMESTAMPTZ;
UPDATE tasks SET completed_at = updated_at WHERE completed;
