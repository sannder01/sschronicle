const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { Pool } = require('pg')
require('dotenv').config({ path: '.env.local' })

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before applying migrations.')
  const host = new URL(process.env.DATABASE_URL).hostname
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
      process.env.DATABASE_SSL === 'false' || ['localhost', '127.0.0.1', '[::1]'].includes(host)
        ? false
        : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
  })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(734913, 1)')
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
    )
    const directory = path.join(__dirname, '..', 'migrations')
    const files = (await fs.readdir(directory))
      .filter((name) => /^\d+_[a-z0-9_]+\.sql$/.test(name))
      .sort()
    for (const version of files) {
      const sql = await fs.readFile(path.join(directory, version), 'utf8')
      // A checkout on Windows must have the same identity as a Linux deployment.
      const canonical = sql.replace(/\r\n/g, '\n')
      const checksum = crypto.createHash('sha256').update(canonical).digest('hex')
      const windowsChecksum = crypto
        .createHash('sha256')
        .update(canonical.replace(/\n/g, '\r\n'))
        .digest('hex')
      const { rows } = await client.query(
        'SELECT checksum FROM schema_migrations WHERE version=$1',
        [version],
      )
      if (rows.length) {
        if (rows[0].checksum !== checksum && rows[0].checksum !== windowsChecksum)
          throw new Error(
            'Applied migration changed: ' + version + '. Restore it and add a new migration.',
          )
        if (rows[0].checksum !== checksum)
          await client.query('UPDATE schema_migrations SET checksum=$1 WHERE version=$2', [
            checksum,
            version,
          ])
        console.log('Already applied: ' + version)
        continue
      }
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (version,checksum) VALUES ($1,$2)', [
        version,
        checksum,
      ])
      console.log('Applied: ' + version)
    }
    await client.query('COMMIT')
    console.log('Migration complete.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}
migrate().catch((error) => {
  console.error('Migration failed:', error.message)
  process.exitCode = 1
})
