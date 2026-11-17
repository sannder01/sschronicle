import { query, transaction } from './db.js'
import { ApiError } from './api-error.js'
import { positiveId } from './validation.js'
import { validateCanvasPositions, validateScheduleLinkBody } from './schedule.js'

const MAX_FOLDER_LINKS = 500
export const MAX_FOLDER_DEPTH = 8
export { wouldCreateCycle, folderDepths, folderTree, descendantIds } from './folder-shape.mjs'
import { wouldCreateCycle, folderDepths } from './folder-shape.mjs'

/** Validates a parent for a task folder of this user; returns the id or null. */
export async function validateFolderParent(client, userId, parentId, folderId = null) {
  if (parentId == null || parentId === '') return null
  const parent = positiveId(parentId, 'parent_id')
  const { rows } = await client.query(
    "SELECT id,parent_id FROM folders WHERE user_id=$1 AND entity_type='task'",
    [userId],
  )
  if (!rows.some((f) => Number(f.id) === parent))
    throw new ApiError(404, 'Parent folder not found.', 'NOT_FOUND')
  if (folderId != null && wouldCreateCycle(rows, folderId, parent))
    throw new ApiError(400, 'A folder cannot be moved inside itself.', 'FOLDER_CYCLE')
  const depth = folderDepths(rows).get(parent) ?? 0
  if (depth + 1 >= MAX_FOLDER_DEPTH)
    throw new ApiError(400, 'Folders can be nested at most 8 levels deep.', 'FOLDER_TOO_DEEP')
  return parent
}

export async function saveFolderCanvas(userId, positions) {
  const validated = validateCanvasPositions(positions, 200)
  return transaction(async (client) => {
    const ids = [...new Set(validated.map(({ id }) => id))]
    const found = await client.query(
      "SELECT id FROM folders WHERE user_id=$1 AND entity_type='task' AND id=ANY($2::int[]) ORDER BY id FOR UPDATE",
      [userId, ids],
    )
    if (found.rows.length !== ids.length) throw new ApiError(404, 'Folder not found.', 'NOT_FOUND')
    for (const position of validated)
      await client.query('UPDATE folders SET canvas_x=$1,canvas_y=$2 WHERE id=$3 AND user_id=$4', [
        position.x,
        position.y,
        position.id,
        userId,
      ])
    return { ok: true }
  })
}

const folderLink = (row) => ({
  id: Number(row.id),
  from_id: Number(row.from_id),
  to_id: Number(row.to_id),
})

export async function listFolderLinks(userId) {
  const { rows } = await query(
    'SELECT l.id,l.from_id,l.to_id FROM folder_links l JOIN folders f ON f.id=l.from_id JOIN folders t ON t.id=l.to_id WHERE l.user_id=$1 AND f.user_id=$1 AND t.user_id=$1 ORDER BY l.id',
    [userId],
  )
  return rows.map(folderLink)
}

export async function createFolderLink(userId, body) {
  const ids = validateScheduleLinkBody(body)
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const { rows } = await client.query(
      "SELECT id FROM folders WHERE id=ANY($1::int[]) AND user_id=$2 AND entity_type='task' ORDER BY id FOR UPDATE",
      [[ids.from_id, ids.to_id], userId],
    )
    if (rows.length !== 2) throw new ApiError(404, 'Folder not found.', 'NOT_FOUND')
    const existing = await client.query(
      'SELECT id,from_id,to_id FROM folder_links WHERE user_id=$1 AND from_id=$2 AND to_id=$3',
      [userId, ids.from_id, ids.to_id],
    )
    if (existing.rows.length) return { status: 200, link: folderLink(existing.rows[0]) }
    const count = (
      await client.query('SELECT COUNT(*)::int AS count FROM folder_links WHERE user_id=$1', [
        userId,
      ])
    ).rows[0].count
    if (count >= MAX_FOLDER_LINKS)
      throw new ApiError(400, 'A user can have at most 500 folder links.')
    const created = await client.query(
      'INSERT INTO folder_links(user_id,from_id,to_id) VALUES($1,$2,$3) RETURNING id,from_id,to_id',
      [userId, ids.from_id, ids.to_id],
    )
    return { status: 201, link: folderLink(created.rows[0]) }
  })
}

export async function deleteFolderLink(userId, id) {
  const { rows } = await query('DELETE FROM folder_links WHERE id=$1 AND user_id=$2 RETURNING id', [
    positiveId(id),
    userId,
  ])
  if (!rows.length) throw new ApiError(404, 'Folder link not found.', 'NOT_FOUND')
  return { ok: true }
}
