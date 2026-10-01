import { api, json, readJson, assertOwnerFolder, ApiError } from '@/lib/api'
import { query } from '@/lib/db'
import { positiveId } from '@/lib/validation'
import { validateDocument, legacyDocument, documentText } from '@/lib/notes/format.mjs'

export const GET = api(async (_req, _context, { user }) => {
  const result = await query(
    'SELECT * FROM notes WHERE user_id=$1 ORDER BY pinned DESC, updated_at DESC',
    [user.id],
  )
  return json(result.rows)
})

export const POST = api(async (req, _context, { user }) => {
  const body = await readJson(req, 400000)
  const title = body.title ?? ''
  if (typeof title !== 'string' || title.length > 500)
    throw new ApiError(400, 'Title must be at most 500 characters', 'INVALID_TITLE')
  let document
  try {
    document = validateDocument(body.document ?? legacyDocument(body.content ?? ''))
  } catch (error) {
    throw new ApiError(400, error.message, 'INVALID_DOCUMENT')
  }
  const suppliedFolder = body.folder_id ?? body.folderId ?? null
  const folderId = suppliedFolder === null ? null : positiveId(suppliedFolder)
  await assertOwnerFolder(user.id, folderId, 'note')
  const result = await query(
    `INSERT INTO notes(user_id,folder_id,title,content,document)
    VALUES($1,$2,$3,$4,$5::jsonb) RETURNING *`,
    [user.id, folderId, title, documentText(document), JSON.stringify(document)],
  )
  return json(result.rows[0], 201)
})
