import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { name, emoji, color } = await req.json()
    if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })
    const result = await query(
      'UPDATE folders SET name=$1, emoji=$2, color=$3 WHERE id=$4 AND user_id=$5 RETURNING *',
      [name.trim(), emoji, color, params.id, session.user.id]
    )
    if (!result.rows.length) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(result.rows[0])
  } catch (err) {
    console.error('[PATCH /api/folders/:id]', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Unlink both tasks AND notes that belong to this folder
    await query('UPDATE tasks SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2', [params.id, session.user.id])
    await query('UPDATE notes SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2', [params.id, session.user.id])  // ← ADD
    await query('DELETE FROM folders WHERE id = $1 AND user_id = $2', [params.id, session.user.id])
    return Response.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/folders/:id]', err)
    return Response.json({ error: 'Database error' }, { status: 500 })
  }
}
