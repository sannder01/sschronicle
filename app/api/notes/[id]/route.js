import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { title, content } = await req.json()
    const result = await query(
      `UPDATE notes SET title=$1, content=$2, updated_at=NOW()
       WHERE id=$3 AND user_id=$4 RETURNING *`,
      [title || '', content || '', params.id, session.user.id]
    )
    if (!result.rows.length) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(result.rows[0])
  } catch (err) {
    console.error('[PUT /api/notes/:id]', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await query(
      'DELETE FROM notes WHERE id=$1 AND user_id=$2',
      [params.id, session.user.id]
    )
    return Response.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/notes/:id]', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}
