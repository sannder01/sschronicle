import { api, json } from '@/lib/api'
import { transaction } from '@/lib/db'
import { id } from '@/lib/learning'
import { ApiError } from '@/lib/api-error.js'
export const dynamic = 'force-dynamic'
export const DELETE = api(async (req, { params }, { user }) => {
  await transaction(async (c) => {
    await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id])
    const r = await c.query('DELETE FROM learning_edges WHERE id=$1 AND user_id=$2', [
      id(params.id),
      user.id,
    ])
    if (!r.rowCount) throw new ApiError(404, 'Edge not found.', 'NOT_FOUND')
  })
  return json({ ok: true })
})
