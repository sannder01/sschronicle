CREATE TABLE IF NOT EXISTS user_ai_settings (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('groq', 'gemini')),
  model VARCHAR(120) NOT NULL,
  key_ciphertext TEXT NOT NULL,
  key_last4 VARCHAR(4) NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
