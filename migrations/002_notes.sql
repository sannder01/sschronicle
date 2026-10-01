ALTER TABLE notes ADD COLUMN IF NOT EXISTS document JSONB;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Preserve every legacy line and retain plain text for older readers.
UPDATE notes n SET document = jsonb_build_object('type', 'doc', 'content', (
  SELECT jsonb_agg(CASE WHEN line = '' THEN jsonb_build_object('type', 'paragraph')
    ELSE jsonb_build_object('type', 'paragraph', 'content', jsonb_build_array(jsonb_build_object('type', 'text', 'text', line))) END ORDER BY ordinal)
  FROM unnest(regexp_split_to_array(COALESCE(n.content, ''), E'\\r\\n|\\r|\\n')) WITH ORDINALITY AS lines(line, ordinal)
)) WHERE document IS NULL;
ALTER TABLE notes ALTER COLUMN document SET DEFAULT '{"type":"doc","content":[{"type":"paragraph"}]}'::jsonb;
ALTER TABLE notes ALTER COLUMN document SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notes_user_deleted_updated ON notes(user_id, deleted_at, updated_at DESC);
