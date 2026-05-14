import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await query(
      'SELECT * FROM folders WHERE user_id = $1 ORDER BY created_at ASC',
      [session.user.id]
    )
    // normalize: return `icon` field (alias for emoji) for NotesPage compatibility
    const rows = result.rows.map(r => ({ ...r, icon: r.emoji || '📁' }))
    return Response.json(rows)
  } catch (err) {
    console.error('[GET /api/folders]', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // accept both `emoji` and `icon` for compatibility
    const body = await req.json()
    const { name, color } = body
    const emoji = body.emoji || body.icon || '📁'

    if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

    const result = await query(
      'INSERT INTO folders (user_id, name, emoji, color) VALUES ($1,$2,$3,$4) RETURNING *',
      [session.user.id, name.trim(), emoji, color || '#8B5CF6']
    )
    const row = result.rows[0]
    return Response.json({ ...row, icon: row.emoji }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/folders]', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}
