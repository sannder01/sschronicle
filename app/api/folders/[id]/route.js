import { api, json, readJson, ApiError } from '@/lib/api'
import { query, transaction } from '@/lib/db'
import { text, positiveId, hexColor } from '@/lib/validation'

export const PATCH = api(async (req, { params }, { user }) => {
  const body = await readJson(req, 8192)
  const changes = {}
  if (body.name !== undefined) changes.name = text(body.name, { field: 'name', max: 100 })
  if (body.emoji !== undefined || body.icon !== undefined)
    changes.emoji = text(body.emoji ?? body.icon, { field: 'icon', max: 20 })
  if (body.color !== undefined) changes.color = hexColor(body.color)
  if (!Object.keys(changes).length) throw new ApiError(400, 'Nothing to update.')
  const values = Object.values(changes)
  const fields = Object.keys(changes).map((key, index) => key + '=$' + (index + 1))
  values.push(positiveId(params.id), user.id)
  const { rows } = await query(
    'UPDATE folders SET ' +
      fields.join(',') +
      ' WHERE id=$' +
      (values.length - 1) +
      ' AND user_id=$' +
      values.length +
      ' RETURNING *',
    values,
  )
  if (!rows.length) throw new ApiError(404, 'Folder not found.', 'NOT_FOUND')
  return json({ ...rows[0], icon: rows[0].emoji })
})
export const DELETE = api(async (req, { params }, { user }) => {
  const id = positiveId(params.id)
  await transaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id FROM folders WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [id, user.id],
    )
    if (!rows.length) throw new ApiError(404, 'Folder not found.', 'NOT_FOUND')
    await client.query(
      'UPDATE tasks SET folder_id=NULL,updated_at=NOW() WHERE folder_id=$1 AND user_id=$2',
      [id, user.id],
    )
    await client.query(
      'UPDATE notes SET folder_id=NULL,updated_at=NOW(),version=version+1 WHERE folder_id=$1 AND user_id=$2',
      [id, user.id],
    )
    await client.query('DELETE FROM folders WHERE id=$1 AND user_id=$2', [id, user.id])
  })
  return json({ ok: true })
})
