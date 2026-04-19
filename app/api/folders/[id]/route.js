import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, emoji, color } = await req.json()
  const result = await query(
    'UPDATE folders SET name=$1, emoji=$2, color=$3 WHERE id=$4 AND user_id=$5 RETURNING *',
    [name, emoji, color, params.id, session.user.id]
  )
  return Response.json(result.rows[0])
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Remove folder_id from tasks in that folder
  await query(
    'UPDATE tasks SET folder_id = NULL WHERE folder_id = $1 AND user_id = $2',
    [params.id, session.user.id]
  )
  await query(
    'DELETE FROM folders WHERE id = $1 AND user_id = $2',
    [params.id, session.user.id]
  )
  return Response.json({ success: true })
}
