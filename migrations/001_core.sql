CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, email TEXT UNIQUE NOT NULL,
  name TEXT, image TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{"theme":"system","language":"ru","timezone":"UTC","animations":true,"reduce_transparency":false}'::jsonb;
UPDATE users SET google_image=image WHERE google_image IS NULL;
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, provider TEXT NOT NULL, provider_account_id TEXT NOT NULL,
  refresh_token TEXT, access_token TEXT, expires_at BIGINT, token_type TEXT, scope TEXT, id_token TEXT,
  UNIQUE(provider,provider_account_id)
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL, expires TIMESTAMPTZ NOT NULL
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS authenticated_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS verification_tokens (identifier TEXT NOT NULL, token TEXT NOT NULL, expires TIMESTAMPTZ NOT NULL, PRIMARY KEY(identifier,token));
CREATE TABLE IF NOT EXISTS folders (
  id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, emoji TEXT DEFAULT '📁', color TEXT DEFAULT '#007aff', created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE folders ADD COLUMN IF NOT EXISTS entity_type TEXT;
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE, due_date DATE, due_time TEXT, priority TEXT DEFAULT 'medium',
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL, notified_1h BOOLEAN DEFAULT FALSE,
  notified_1d BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'todo';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE tasks SET completed=COALESCE(completed,FALSE), status=CASE WHEN completed THEN 'done' ELSE 'todo' END;
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL, title TEXT DEFAULT '', content TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS habits (
  id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, frequency TEXT DEFAULT 'daily', color TEXT DEFAULT '#007aff', created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS habit_logs (
  id SERIAL PRIMARY KEY, habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE, UNIQUE(habit_id,logged_at)
);
-- Preserve mixed folders by copying the notes half and relinking notes.
DO $$
DECLARE old_folder RECORD; note_folder_id INTEGER;
BEGIN
  FOR old_folder IN SELECT f.* FROM folders f LOOP
    IF EXISTS(SELECT 1 FROM tasks WHERE folder_id=old_folder.id) AND EXISTS(SELECT 1 FROM notes WHERE folder_id=old_folder.id) THEN
      INSERT INTO folders(user_id,name,emoji,color,entity_type,created_at)
        VALUES(old_folder.user_id,old_folder.name,old_folder.emoji,old_folder.color,'note',old_folder.created_at)
        RETURNING id INTO note_folder_id;
      UPDATE notes SET folder_id=note_folder_id WHERE folder_id=old_folder.id;
      UPDATE folders SET entity_type='task' WHERE id=old_folder.id;
    ELSIF EXISTS(SELECT 1 FROM notes WHERE folder_id=old_folder.id) THEN
      UPDATE folders SET entity_type='note' WHERE id=old_folder.id;
    ELSIF EXISTS(SELECT 1 FROM tasks WHERE folder_id=old_folder.id) THEN
      UPDATE folders SET entity_type='task' WHERE id=old_folder.id;
    ELSE
      UPDATE folders SET entity_type=CASE WHEN entity_type='note' THEN 'note' ELSE 'task' END WHERE id=old_folder.id;
    END IF;
  END LOOP;
END $$;
ALTER TABLE folders ALTER COLUMN entity_type SET DEFAULT 'task';
ALTER TABLE folders ALTER COLUMN entity_type SET NOT NULL;
ALTER TABLE folders ADD CONSTRAINT folders_entity_type_check CHECK(entity_type IN ('task','note'));
CREATE TABLE IF NOT EXISTS tg_connections (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, chat_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tg_connections ADD COLUMN IF NOT EXISTS reminders_1h BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE tg_connections ADD COLUMN IF NOT EXISTS reminders_1d BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS telegram_webhook_events (
  event_id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  response JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_user_type ON folders(user_id,entity_type);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_folder ON tasks(folder_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date) WHERE completed=FALSE;
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_user ON habit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);
CREATE INDEX IF NOT EXISTS idx_tg_connections_chat ON tg_connections(chat_id);
