import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { query } from './db'
import { ApiError } from './api-error.js'
export { ApiError } from './api-error.js'

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store, private', 'Vary': 'Cookie' } })
}

export async function requireUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new ApiError(401, 'Please sign in again.', 'UNAUTHORIZED')
  return { user: session.user, session }
}

export function checkOrigin(req) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return
  const origin = req.headers.get('origin')
  const expected = new URL(process.env.NEXTAUTH_URL || req.url).origin
  if (origin ? origin !== expected : req.headers.get('sec-fetch-site') !== 'same-origin') {
    throw new ApiError(403, 'This request must come from Chronicle.', 'INVALID_ORIGIN')
  }
}

export async function readJson(req, maxBytes = 262144) {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'Expected a JSON request.', 'INVALID_CONTENT_TYPE')
  }
  if (Number(req.headers.get('content-length')) > maxBytes) throw new ApiError(413, 'Request is too large.', 'BODY_TOO_LARGE')
  const reader = req.body?.getReader()
  if (!reader) throw new ApiError(400, 'Request body is required.')
  const chunks = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) { await reader.cancel(); throw new ApiError(413, 'Request is too large.', 'BODY_TOO_LARGE') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  let body
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new ApiError(400, 'Invalid JSON.', 'INVALID_JSON') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Expected a JSON object.')
  return body
}

export function api(handler, { auth = true, csrf = true } = {}) {
  return async (req, context = {}) => {
    try {
      if (csrf) checkOrigin(req)
      const identity = auth ? await requireUser() : {}
      const resolvedContext = context.params ? { ...context, params: await context.params } : context
      return await handler(req, resolvedContext, identity)
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message, code: error.code, ...error.details }, error.status)
      console.error('[API]', error?.code || error?.name || 'Error')
      return json({ error: 'Unable to complete this request. Please try again.', code: 'SERVER_ERROR' }, 500)
    }
  }
}

export async function assertOwnerFolder(userId, folderId, entityType, client = { query }) {
  if (folderId == null) return
  if (!/^\d+$/.test(String(folderId)) || !Number.isSafeInteger(Number(folderId)) || Number(folderId)<1 || Number(folderId)>2147483647) {
    throw new ApiError(400,'Invalid folder_id.','VALIDATION_ERROR')
  }
  const { rows } = await client.query('SELECT id FROM folders WHERE id=$1 AND user_id=$2 AND entity_type=$3', [folderId, userId, entityType])
  if (!rows.length) throw new ApiError(404, 'Folder not found.', 'NOT_FOUND')
}
