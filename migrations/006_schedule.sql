CREATE TABLE IF NOT EXISTS schedule_blocks (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  start_min SMALLINT NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
  end_min SMALLINT NOT NULL CHECK (end_min BETWEEN 1 AND 1440),
  title TEXT NOT NULL,
  note TEXT,
  color TEXT NOT NULL DEFAULT 'accent',
  done BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_min > start_min)
);
CREATE INDEX IF NOT EXISTS idx_schedule_blocks_user_day ON schedule_blocks(user_id, day);
