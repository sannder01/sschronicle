import { query } from './db'

// Fixed-window limiter stored in PostgreSQL so every serverless instance shares one count.
export async function consumeRateLimit(key, limit, windowSeconds, client = { query }) {
  const { rows } = await client.query(
    `INSERT INTO rate_limits(key, window_start, count)
     VALUES ($1, to_timestamp(floor(extract(epoch FROM NOW()) / $2) * $2), 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limits.count + 1
     RETURNING count`,
    [key, windowSeconds],
  )
  if (Math.random() < 0.02)
    await client.query("DELETE FROM rate_limits WHERE window_start < NOW() - INTERVAL '1 day'")
  return { allowed: rows[0].count <= limit, count: rows[0].count }
}
