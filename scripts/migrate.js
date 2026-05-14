// scripts/migrate.js
// Run: node scripts/migrate.js
// Creates ALL tables from scratch (safe: uses IF NOT EXISTS)

const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
})

async function migrate() {
  const client = await pool.connect()
  try {
    console.log('🚀 Running Chronicle full migration...')

    // ── NextAuth: Users ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        email      TEXT UNIQUE NOT NULL,
        name       TEXT,
        image      TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    console.log('✅ users table ready')

    // ── NextAuth: Accounts ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type                TEXT NOT NULL,
        provider            TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        refresh_token       TEXT,
        access_token        TEXT,
        expires_at          BIGINT,
        token_type          TEXT,
        scope               TEXT,
        id_token            TEXT,
        UNIQUE(provider, provider_account_id)
      )
    `)
    console.log('✅ accounts table ready')

    // ── NextAuth: Sessions ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_token TEXT UNIQUE NOT NULL,
        expires       TIMESTAMPTZ NOT NULL
      )
    `)
    console.log('✅ sessions table ready')

    // ── NextAuth: Verification tokens ────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_tokens (
        identifier TEXT NOT NULL,
        token      TEXT NOT NULL,
        expires    TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (identifier, token)
      )
    `)
    console.log('✅ verification_tokens table ready')

    // ── Folders ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS folders (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        emoji      TEXT DEFAULT '📁',
        color      TEXT DEFAULT '#8B5CF6',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    console.log('✅ folders table ready')

    // ── Tasks ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        completed   BOOLEAN DEFAULT FALSE,
        due_date    DATE,
        due_time    TEXT,
        priority    TEXT DEFAULT 'medium',
        folder_id   INTEGER REFERENCES folders(id) ON DELETE SET NULL,
        notified_1h BOOLEAN DEFAULT FALSE,
        notified_1d BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    // Add due_time to existing tables if missing
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time TEXT`)
    console.log('✅ tasks table ready')

    // ── Telegram connections ─────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS tg_connections (
        user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        chat_id    TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    console.log('✅ tg_connections table ready')

    // ── Indexes ──────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_token  ON sessions(session_token);
      CREATE INDEX IF NOT EXISTS idx_accounts_user   ON accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_user      ON tasks(user_id);
      CREATE INDEX IF NOT EXISTS idx_folders_user    ON folders(user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_folder    ON tasks(folder_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_due       ON tasks(due_date) WHERE completed = false;
    `)
    console.log('✅ Indexes created')

    // ── Habits ───────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS habits (
        id          SERIAL PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        description TEXT,
        frequency   TEXT DEFAULT 'daily',
        color       TEXT DEFAULT '#8B5CF6',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    console.log('✅ habits table ready')

    // ── Habit logs ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS habit_logs (
        id         SERIAL PRIMARY KEY,
        habit_id   INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        logged_at  DATE NOT NULL DEFAULT CURRENT_DATE,
        UNIQUE(habit_id, logged_at)
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id);
      CREATE INDEX IF NOT EXISTS idx_habit_logs_user  ON habit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_habits_user      ON habits(user_id);
    `)
    console.log('✅ habit_logs table ready')

    // ── Fitness ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fitness_meals (
        id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL DEFAULT CURRENT_DATE, meal_type TEXT DEFAULT 'lunch',
        name TEXT NOT NULL, calories INTEGER DEFAULT 0,
        protein NUMERIC(6,1) DEFAULT 0, fat NUMERIC(6,1) DEFAULT 0, carbs NUMERIC(6,1) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS fitness_weight (
        id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL, weight NUMERIC(5,1) NOT NULL, UNIQUE(user_id, date)
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS fitness_water (
        id SERIAL PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL, water_ml INTEGER DEFAULT 0, UNIQUE(user_id, date)
      )
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS fitness_config (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        calorie_goal INTEGER DEFAULT 2000, target_weight NUMERIC(5,1)
      )
    `)
    console.log('✅ fitness tables ready')

    // ── Notes ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS notes (
        id         SERIAL PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        folder_id  INTEGER REFERENCES folders(id) ON DELETE SET NULL,
        title      TEXT DEFAULT '',
        content    TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notes_user   ON notes(user_id);
      CREATE INDEX IF NOT EXISTS idx_notes_folder ON notes(folder_id);
    `)
    console.log('✅ notes table ready')

    console.log('\n🎉 Migration complete! All tables are ready.')
  } catch (err) {
    console.error('❌ Migration error:', err.message)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
