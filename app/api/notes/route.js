import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await query(
      'SELECT * FROM notes WHERE user_id = $1 ORDER BY updated_at DESC',
      [session.user.id]
    )
    return Response.json(result.rows)
  } catch (err) {
    console.error('[GET /api/notes]', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { folderId, title, content } = await req.json()

    const result = await query(
      `INSERT INTO notes (user_id, folder_id, title, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [session.user.id, folderId || null, title || '', content || '']
    )
    return Response.json(result.rows[0], { status: 201 })
  } catch (err) {
    console.error('[POST /api/notes]', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}
