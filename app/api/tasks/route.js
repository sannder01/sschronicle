import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await query(
    `SELECT * FROM tasks WHERE user_id = $1 ORDER BY completed ASC, due_date ASC NULLS LAST, created_at DESC`,
    [session.user.id]
  )
  return Response.json(result.rows)
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, due_date, priority, folder_id } = await req.json()
  if (!title?.trim()) return Response.json({ error: 'Title required' }, { status: 400 })

  const result = await query(
    `INSERT INTO tasks (user_id, title, due_date, priority, folder_id, completed)
     VALUES ($1, $2, $3, $4, $5, false) RETURNING *`,
    [
      session.user.id,
      title.trim(),
      due_date || null,
      priority || 'medium',
      folder_id || null,
    ]
  )
  return Response.json(result.rows[0], { status: 201 })
}
