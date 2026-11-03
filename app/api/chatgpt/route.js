import { createHash, timingSafeEqual } from 'node:crypto'
import { query, transaction } from '@/lib/db'
import { execute, BridgeError } from '@/lib/integrations/chronicle.mjs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const buckets = new Map()
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store, private' } })
const digest = (value) => createHash('sha256').update(value).digest()
const adapter = (client) => ({ unsafe: async (sql, values) => (await client.query(sql, values)).rows })
const database = { ...adapter({ query }), begin: (work) => transaction((client) => work(adapter(client))) }

// This endpoint accepts only our private bridge credential, never a caller-supplied user ID.
// The Site obtains the verified email from ChatGPT's platform identity headers.
export async function POST(req) {
  const secret = process.env.CHRONICLE_BRIDGE_TOKEN
  if (!secret || !timingSafeEqual(digest(req.headers.get('authorization') || ''), digest('Bearer ' + secret)))
    return json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, 401)
  const email = req.headers.get('x-chronicle-verified-email')
  if (!email || email.length > 320) return json({ error: 'Verified email is required', code: 'UNAUTHORIZED' }, 401)
  const now = Date.now()
  for (const [key, value] of buckets) if (value.reset < now) buckets.delete(key)
  const bucket = buckets.get(email) || { count: 0, reset: now + 60000 }
  bucket.count++
  buckets.set(email, bucket)
  if (bucket.count > 60) return json({ error: 'Rate limit reached', code: 'RATE_LIMITED' }, 429)
  try {
    if (!req.headers.get('content-type')?.startsWith('application/json'))
      return json({ error: 'Expected JSON', code: 'INVALID_ARGUMENT' }, 415)
    const reader = req.body?.getReader()
    if (!reader) return json({ error: 'Expected JSON', code: 'INVALID_ARGUMENT' }, 400)
    const chunks = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > 200000) { await reader.cancel(); return json({ error: 'Request too large' }, 413) }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    let body
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) }
    catch { return json({ error: 'Invalid JSON', code: 'INVALID_ARGUMENT' }, 400) }
    const result = await execute(database, body?.name, body?.arguments ?? {}, email)
    return json({ result })
  } catch (error) {
    if (error instanceof BridgeError) return json({ error: error.message, code: error.code }, 400)
    console.error('[Chronicle integration]', error?.code || error?.name)
    return json({ error: 'Chronicle could not complete this request', code: 'SERVER_ERROR' }, 500)
  }
}
