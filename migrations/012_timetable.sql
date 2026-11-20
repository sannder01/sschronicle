CREATE TABLE IF NOT EXISTS timetable_entries (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  start_min SMALLINT NOT NULL CHECK (start_min BETWEEN 0 AND 1435),
  end_min SMALLINT NOT NULL CHECK (end_min BETWEEN 5 AND 1440),
  title VARCHAR(120) NOT NULL,
  kind TEXT NOT NULL DEFAULT 'lecture' CHECK (kind IN ('lecture','practice','lab','seminar','other')),
  room VARCHAR(60) NOT NULL DEFAULT '',
  teacher VARCHAR(80) NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  color TEXT NOT NULL DEFAULT 'accent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_min > start_min)
);
CREATE INDEX IF NOT EXISTS idx_timetable_entries_user_weekday_start
  ON timetable_entries(user_id, weekday, start_min);
