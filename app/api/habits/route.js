// app/api/habits/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

async function calculateStreak(habitId, client) {
  const q = client || { query: (sql, params) => query(sql, params) }
  const result = await q.query(
    'SELECT logged_at FROM habit_logs WHERE habit_id = $1 ORDER BY logged_at DESC',
    [habitId]
  )
  const rows = result.rows
  if (!rows.length) return 0

  const logs = new Set(rows.map(r => {
    const d = r.logged_at
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)
  }))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const yesterday = new Date(today - 86400000)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  if (!logs.has(todayStr) && !logs.has(yesterdayStr)) return 0

  let checkDate = logs.has(todayStr) ? new Date(today) : new Date(yesterday)
  let streak = 0

  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10)
    if (logs.has(dateStr)) {
      streak++
      checkDate = new Date(checkDate - 86400000)
    } else {
      break
    }
  }
  return streak
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Ensure tables exist
  await query(`
    CREATE TABLE IF NOT EXISTS habits (
      id          SERIAL PRIMARY KEY,
      user_id     TEXT NOT NULL,
      name        TEXT NOT NULL,
      description TEXT,
      frequency   TEXT DEFAULT 'daily',
      color       TEXT DEFAULT '#8B5CF6',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})

  await query(`
    CREATE TABLE IF NOT EXISTS habit_logs (
      id         SERIAL PRIMARY KEY,
      habit_id   INTEGER NOT NULL,
      user_id    TEXT NOT NULL,
      logged_at  DATE NOT NULL DEFAULT CURRENT_DATE,
      UNIQUE(habit_id, logged_at)
    )
  `).catch(() => {})

  const result = await query(`
    SELECT
      h.*,
      EXISTS(
        SELECT 1 FROM habit_logs hl
        WHERE hl.habit_id = h.id AND hl.logged_at = CURRENT_DATE
      ) AS done_today,
      COALESCE(
        (SELECT COUNT(*) FROM habit_logs hl WHERE hl.habit_id = h.id), 0
      ) AS total_logs
    FROM habits h
    WHERE h.user_id = $1
    ORDER BY h.created_at ASC
  `, [session.user.id])

  const habits = await Promise.all(result.rows.map(async h => ({
    ...h,
    streak: await calculateStreak(h.id),
  })))

  return Response.json(habits)
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, frequency, color } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

  const result = await query(`
    INSERT INTO habits (user_id, name, description, frequency, color)
    VALUES ($1, $2, $3, $4, $5) RETURNING *
  `, [session.user.id, name.trim(), description || null, frequency || 'daily', color || '#8B5CF6'])

  return Response.json({ ...result.rows[0], done_today: false, streak: 0, total_logs: 0 }, { status: 201 })
}
