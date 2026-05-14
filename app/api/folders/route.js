import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// GET — add ?type=note or ?type=task query param
export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('type') || 'task'   // default to 'task' for PlannerClient compat

  try {
    const result = await query(
      'SELECT * FROM folders WHERE user_id = $1 AND entity_type = $2 ORDER BY created_at ASC',
      [session.user.id, entityType]
    )
    const rows = result.rows.map(r => ({ ...r, icon: r.emoji || '📁' }))
    return Response.json(rows)
  } catch (err) {
    console.error('[GET /api/folders]', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}

// POST — accept entityType from body
export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { name, color } = body
    const emoji = body.emoji || body.icon || '📁'
    const entityType = body.entityType || 'task'   // ← ADD THIS

    if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

    const result = await query(
      'INSERT INTO folders (user_id, name, emoji, color, entity_type) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [session.user.id, name.trim(), emoji, color || '#8B5CF6', entityType]
    )
    const row = result.rows[0]
    return Response.json({ ...row, icon: row.emoji }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/folders]', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}
