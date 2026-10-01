import { api, json, readJson, assertOwnerFolder, ApiError } from '@/lib/api'
import { query, transaction } from '@/lib/db'
import { positiveId } from '@/lib/validation'
import { validateDocument, documentText } from '@/lib/notes/format.mjs'

export const GET = api(async (_req, { params }, { user }) => {
  const result = await query('SELECT * FROM notes WHERE id=$1 AND user_id=$2', [positiveId(params.id), user.id])
  if (!result.rows.length) throw new ApiError(404, 'Note not found', 'NOT_FOUND')
  return json(result.rows[0])
})

export const PATCH = api(async (req, { params }, { user }) => {
  const body = await readJson(req, 400000)
  if (!Number.isInteger(body.version) || body.version < 1) throw new ApiError(400, 'A note version is required', 'VERSION_REQUIRED')
  return transaction(async client => {
    const result = await client.query('SELECT * FROM notes WHERE id=$1 AND user_id=$2 FOR UPDATE', [positiveId(params.id), user.id])
    const current = result.rows[0]
    if (!current) throw new ApiError(404, 'Note not found', 'NOT_FOUND')
    if (current.version !== body.version) throw new ApiError(409, 'This note changed on another device', 'VERSION_CONFLICT', { current })
    if (current.deleted_at && body.deleted !== false) throw new ApiError(409, 'Restore the note before editing', 'NOTE_DELETED', { current })
    if (body.title !== undefined && (typeof body.title !== 'string' || body.title.length > 500)) throw new ApiError(400, 'Title must be at most 500 characters', 'INVALID_TITLE')
    for (const field of ['deleted', 'pinned']) {
      if (body[field] !== undefined && typeof body[field] !== 'boolean') throw new ApiError(400, `Invalid ${field}`, 'INVALID_FIELD')
    }
    let document = current.document
    if (body.document !== undefined) {
      try { document = validateDocument(body.document) } catch (error) { throw new ApiError(400, error.message, 'INVALID_DOCUMENT') }
    }
    const suppliedFolder = Object.hasOwn(body, 'folder_id') ? body.folder_id : current.folder_id
    const folderId = suppliedFolder === null ? null : positiveId(suppliedFolder)
    await assertOwnerFolder(user.id, folderId, 'note', client)
    const saved = await client.query(`UPDATE notes SET title=$1, document=$2::jsonb, content=$3,
      folder_id=$4, pinned=$5, deleted_at=$6, version=version+1, updated_at=NOW()
      WHERE id=$7 AND user_id=$8 AND version=$9 RETURNING *`, [
      body.title ?? current.title, JSON.stringify(document), documentText(document), folderId,
      body.pinned ?? current.pinned, body.deleted === true ? new Date() : body.deleted === false ? null : current.deleted_at,
      current.id, user.id, body.version,
    ])
    return json(saved.rows[0])
  })
})

// Unguarded writes from old clients deliberately fail instead of losing text.
export const PUT = PATCH

export const DELETE = api(async (req, { params }, { user }) => {
  const body = await readJson(req)
  if (!Number.isInteger(body.version) || body.version < 1) throw new ApiError(400, 'A note version is required', 'VERSION_REQUIRED')
  return transaction(async client => {
    const result = await client.query('SELECT * FROM notes WHERE id=$1 AND user_id=$2 FOR UPDATE', [positiveId(params.id), user.id])
    const current = result.rows[0]
    if (!current) throw new ApiError(404, 'Note not found', 'NOT_FOUND')
    if (current.version !== body.version) throw new ApiError(409, 'This note changed on another device', 'VERSION_CONFLICT', { current })
    if (!current.deleted_at || body.confirm !== 'DELETE') throw new ApiError(400, 'Move the note to Recently Deleted and confirm first', 'CONFIRM_REQUIRED')
    await client.query('DELETE FROM notes WHERE id=$1 AND user_id=$2 AND version=$3', [current.id, user.id, current.version])
    return json({ success: true })
  })
})
