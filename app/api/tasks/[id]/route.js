import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const fields = []
  const values = []
  let idx = 1

  if (body.completed !== undefined) { fields.push(`completed = $${idx++}`); values.push(body.completed) }
  if (body.title !== undefined)     { fields.push(`title = $${idx++}`);     values.push(body.title) }
  if (body.due_date !== undefined)  { fields.push(`due_date = $${idx++}`);  values.push(body.due_date) }
  if (body.priority !== undefined)  { fields.push(`priority = $${idx++}`);  values.push(body.priority) }
  if (body.folder_id !== undefined) { fields.push(`folder_id = $${idx++}`); values.push(body.folder_id) }

  // Reset notification flags when task is uncompleted or due_date changes
  if (body.completed === false || body.due_date !== undefined) {
    fields.push(`notified_1h = false`, `notified_1d = false`)
  }

  if (fields.length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 })

  values.push(params.id, session.user.id)
  const result = await query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx+1} RETURNING *`,
    values
  )
  return Response.json(result.rows[0])
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  await query(
    'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
    [params.id, session.user.id]
  )
  return Response.json({ success: true })
}
