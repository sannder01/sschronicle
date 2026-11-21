DO $migration$
DECLARE
  kind_attnum SMALLINT;
  constraint_row RECORD;
BEGIN
  SELECT attnum INTO kind_attnum
  FROM pg_attribute
  WHERE attrelid = 'timetable_entries'::regclass AND attname = 'kind' AND NOT attisdropped;

  FOR constraint_row IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'timetable_entries'::regclass
      AND contype = 'c'
      AND kind_attnum = ANY(conkey)
  LOOP
    EXECUTE format('ALTER TABLE timetable_entries DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;

  UPDATE timetable_entries
  SET kind = CASE
    WHEN kind IN ('lecture', 'practice', 'lab', 'seminar') THEN 'study'
    WHEN kind IN ('study', 'work', 'sport', 'food', 'rest', 'other') THEN kind
    ELSE 'other'
  END;

  ALTER TABLE timetable_entries ALTER COLUMN kind SET DEFAULT 'other';
  ALTER TABLE timetable_entries
    ADD CONSTRAINT timetable_entries_kind_check
    CHECK (kind IN ('study', 'work', 'sport', 'food', 'rest', 'other'));
END
$migration$;

CREATE TABLE IF NOT EXISTS timetable_done (
  entry_id INTEGER NOT NULL REFERENCES timetable_entries(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entry_id, day)
);
CREATE INDEX IF NOT EXISTS idx_timetable_done_user_day ON timetable_done(user_id, day);
