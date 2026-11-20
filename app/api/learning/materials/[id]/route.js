import { api, json, readJson } from '@/lib/api'
import { transaction } from '@/lib/db'
import { id } from '@/lib/learning'
import { text } from '@/lib/validation'
import { ApiError } from '@/lib/api-error.js'
export const dynamic = 'force-dynamic'
export const PATCH = api(async (req, { params }, { user }) => {
  const b = await readJson(req, 8192)
  const row = await transaction(async (c) => {
    await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id])
    const old = (
      await c.query('SELECT * FROM learning_materials WHERE id=$1 AND user_id=$2', [
        id(params.id),
        user.id,
      ])
    ).rows[0]
    if (!old) throw new ApiError(404, 'Material not found.', 'NOT_FOUND')
    const title = b.title === undefined ? old.title : text(b.title, { field: 'title', max: 160 })
    const body =
      b.body === undefined ? old.body : text(b.body, { field: 'body', max: 4000, min: 0 })
    const url = b.url === undefined ? old.url : b.url
    if (
      old.kind === 'link' &&
      (typeof url !== 'string' || url.length > 2000 || !/^https?:\/\//i.test(url))
    )
      throw new ApiError(400, 'Invalid url.', 'VALIDATION_ERROR')
    if (old.kind === 'note' && url !== null)
      throw new ApiError(400, 'Invalid url.', 'VALIDATION_ERROR')
    return (
      await c.query(
        'UPDATE learning_materials SET title=$1,body=$2,url=$3 WHERE id=$4 RETURNING *',
        [title, body, url, old.id],
      )
    ).rows[0]
  })
  return json(row)
})
export const DELETE = api(async (req, { params }, { user }) => {
  await transaction(async (c) => {
    await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id])
    const r = await c.query('DELETE FROM learning_materials WHERE id=$1 AND user_id=$2', [
      id(params.id),
      user.id,
    ])
    if (!r.rowCount) throw new ApiError(404, 'Material not found.', 'NOT_FOUND')
  })
  return json({ ok: true })
})
