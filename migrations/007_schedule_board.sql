ALTER TABLE schedule_blocks ADD COLUMN IF NOT EXISTS canvas_x REAL;
ALTER TABLE schedule_blocks ADD COLUMN IF NOT EXISTS canvas_y REAL;

CREATE TABLE IF NOT EXISTS schedule_links (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_id INTEGER NOT NULL REFERENCES schedule_blocks(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES schedule_blocks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_id < to_id),
  UNIQUE (from_id, to_id)
);
CREATE INDEX IF NOT EXISTS idx_schedule_links_user ON schedule_links(user_id);
