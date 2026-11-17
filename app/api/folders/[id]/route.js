import { api, json, readJson, ApiError } from '@/lib/api'
import { transaction } from '@/lib/db'
import { text, positiveId, hexColor } from '@/lib/validation'
import { validateFolderParent } from '@/lib/folder-tree'

export const PATCH = api(async (req, { params }, { user }) => {
  const body = await readJson(req, 8192)
  const id = positiveId(params.id)
  const changes = {}
  if (body.name !== undefined) changes.name = text(body.name, { field: 'name', max: 100 })
  if (body.emoji !== undefined || body.icon !== undefined)
    changes.emoji = text(body.emoji ?? body.icon, { field: 'icon', max: 20 })
  if (body.color !== undefined) changes.color = hexColor(body.color)
  const row = await transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id])
    const current = (
      await client.query('SELECT * FROM folders WHERE id=$1 AND user_id=$2', [id, user.id])
    ).rows[0]
    if (!current) throw new ApiError(404, 'Folder not found.', 'NOT_FOUND')
    if (body.parent_id !== undefined) {
      if (current.entity_type !== 'task')
        throw new ApiError(400, 'Only task folders can be nested.', 'VALIDATION_ERROR')
      changes.parent_id = await validateFolderParent(client, user.id, body.parent_id, id)
    }
    if (!Object.keys(changes).length) throw new ApiError(400, 'Nothing to update.')
    const values = Object.values(changes)
    const fields = Object.keys(changes).map((key, index) => key + '=$' + (index + 1))
    values.push(id, user.id)
    const { rows } = await client.query(
      'UPDATE folders SET ' +
        fields.join(',') +
        ' WHERE id=$' +
        (values.length - 1) +
        ' AND user_id=$' +
        values.length +
        ' RETURNING *',
      values,
    )
    return rows[0]
  })
  return json({ ...row, icon: row.emoji })
})
export const DELETE = api(async (req, { params }, { user }) => {
  const id = positiveId(params.id)
  await transaction(async (client) => {
    const { rows } = await client.query(
      'SELECT id,parent_id FROM folders WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [id, user.id],
    )
    if (!rows.length) throw new ApiError(404, 'Folder not found.', 'NOT_FOUND')
    // Nothing inside is lost: tasks and subfolders move up to the deleted folder's parent.
    const parent = rows[0].parent_id
    await client.query(
      'UPDATE tasks SET folder_id=$1,updated_at=NOW() WHERE folder_id=$2 AND user_id=$3',
      [parent, id, user.id],
    )
    await client.query('UPDATE folders SET parent_id=$1 WHERE parent_id=$2 AND user_id=$3', [
      parent,
      id,
      user.id,
    ])
    await client.query(
      'UPDATE notes SET folder_id=NULL,updated_at=NOW(),version=version+1 WHERE folder_id=$1 AND user_id=$2',
      [id, user.id],
    )
    await client.query('DELETE FROM folders WHERE id=$1 AND user_id=$2', [id, user.id])
  })
  return json({ ok: true })
})
