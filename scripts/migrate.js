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
        priority    TEXT DEFAULT 'medium',
        folder_id   INTEGER REFERENCES folders(id) ON DELETE SET NULL,
        notified_1h BOOLEAN DEFAULT FALSE,
        notified_1d BOOLEAN DEFAULT FALSE,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `)
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
