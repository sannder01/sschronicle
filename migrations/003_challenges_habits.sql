-- Fixed calendar-day timezones; no DDL runs inside request handlers.
ALTER TABLE habits ADD COLUMN IF NOT EXISTS days JSONB;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE habits ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE habit_logs ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE habit_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
UPDATE habits h SET start_date = LEAST((h.created_at AT TIME ZONE h.timezone)::date, COALESCE((SELECT min(logged_at) FROM habit_logs l WHERE l.habit_id = h.id), (h.created_at AT TIME ZONE h.timezone)::date)) WHERE h.start_date IS NULL;
ALTER TABLE habits ALTER COLUMN start_date SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_habit_logs_owner_date ON habit_logs(user_id, logged_at);

CREATE TABLE IF NOT EXISTS challenges (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '🌱',
  color TEXT NOT NULL DEFAULT '#34a853',
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS challenge_attempts (
  id SERIAL PRIMARY KEY,
  challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  duration INTEGER NOT NULL CHECK (duration BETWEEN 1 AND 366),
  timezone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS challenge_entries (
  id SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES challenge_attempts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success','failed','unset')),
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(attempt_id, entry_date)
);
CREATE INDEX IF NOT EXISTS idx_challenges_owner ON challenges(user_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_attempts_challenge ON challenge_attempts(challenge_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_entries_owner ON challenge_entries(user_id, attempt_id);
