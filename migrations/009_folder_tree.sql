-- Task folders can nest (Obsidian-style), sit on the board and be tied together.
ALTER TABLE folders ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES folders(id) ON DELETE SET NULL;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS canvas_x REAL;
ALTER TABLE folders ADD COLUMN IF NOT EXISTS canvas_y REAL;
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);

CREATE TABLE IF NOT EXISTS folder_links (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  to_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_id < to_id),
  UNIQUE (from_id, to_id)
);
CREATE INDEX IF NOT EXISTS idx_folder_links_user ON folder_links(user_id);
