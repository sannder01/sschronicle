import { Pool, types } from 'pg'

// Calendar dates are not instants. Keep DATE values stable across server timezones.
types.setTypeParser(1082, (value) => value)
const localDatabase = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(
  (() => {
    try {
      return new URL(process.env.DATABASE_URL).hostname
    } catch {
      return ''
    }
  })(),
)
const ssl =
  process.env.DATABASE_SSL === 'false' || localDatabase
    ? false
    : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }

export const pool =
  globalThis._chroniclePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
    max: 10,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  })
if (process.env.NODE_ENV !== 'production') globalThis._chroniclePool = pool

export async function query(sql, params = []) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')
  return pool.query(sql, params)
}

export async function transaction(work) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
