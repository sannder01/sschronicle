// app/api/habits/[id]/log/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// POST — toggle today's log for a habit
export async function POST(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verify ownership
  const habit = await query('SELECT id FROM habits WHERE id = $1 AND user_id = $2', [id, session.user.id])
  if (!habit.rows.length) return Response.json({ error: 'Not found' }, { status: 404 })

  // Check if already logged today
  const existing = await query(
    'SELECT id FROM habit_logs WHERE habit_id = $1 AND logged_at = CURRENT_DATE',
    [id]
  )

  if (existing.rows.length) {
    // Un-log
    await query('DELETE FROM habit_logs WHERE habit_id = $1 AND logged_at = CURRENT_DATE', [id])
    return Response.json({ done: false })
  } else {
    // Log
    await query(
      'INSERT INTO habit_logs (habit_id, user_id, logged_at) VALUES ($1, $2, CURRENT_DATE) ON CONFLICT DO NOTHING',
      [id, session.user.id]
    )
    return Response.json({ done: true })
  }
}

// GET — get last 30 days history for a habit
export async function GET(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const habit = await query('SELECT id FROM habits WHERE id = $1 AND user_id = $2', [id, session.user.id])
  if (!habit.rows.length) return Response.json({ error: 'Not found' }, { status: 404 })

  const result = await query(
    'SELECT logged_at FROM habit_logs WHERE habit_id = $1 ORDER BY logged_at DESC LIMIT 90',
    [id]
  )

  const dates = result.rows.map(r => {
    const d = r.logged_at
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)
  })

  return Response.json({ dates })
}
