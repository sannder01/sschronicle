import { createHash, randomBytes } from 'node:crypto'
import { api, json, readJson, ApiError } from '@/lib/api'
import { query, transaction } from '@/lib/db'
import { profileFor } from '@/lib/profile'
import { boolean } from '@/lib/validation'
export const dynamic = 'force-dynamic'
export const GET = api(async (req, context, { user }) => json((await profileFor(user.id)).telegram))
export const POST = api(async (req, context, { user }) => {
  if (
    !process.env.TELEGRAM_BOT_TOKEN ||
    !process.env.TG_WEBHOOK_SECRET ||
    !process.env.TELEGRAM_BOT_USERNAME
  )
    throw new ApiError(503, 'Telegram is not configured on this server.', 'TELEGRAM_UNAVAILABLE')
  const token = randomBytes(24).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  const expires = new Date(Date.now() + 10 * 60 * 1000)
  await transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id])
    await client.query('DELETE FROM telegram_link_tokens WHERE user_id=$1 OR expires_at<NOW()', [
      user.id,
    ])
    await client.query(
      'INSERT INTO telegram_link_tokens(token_hash,user_id,expires_at) VALUES($1,$2,$3)',
      [hash, user.id, expires],
    )
  })
  return json({
    url:
      'https://t.me/' +
      process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, '') +
      '?start=link_' +
      token,
    expires_at: expires.toISOString(),
  })
})
export const PATCH = api(async (req, context, { user }) => {
  const body = await readJson(req, 4096)
  const values = [],
    fields = []
  for (const key of ['reminders_1h', 'reminders_1d'])
    if (body[key] !== undefined) {
      values.push(boolean(body[key], key))
      fields.push(key + '=$' + values.length)
    }
  if (!fields.length) throw new ApiError(400, 'Nothing to update.')
  values.push(user.id)
  const result = await query(
    'UPDATE tg_connections SET ' +
      fields.join(',') +
      ',updated_at=NOW() WHERE user_id=$' +
      values.length,
    values,
  )
  if (!result.rowCount) throw new ApiError(404, 'Connect Telegram first.', 'NOT_FOUND')
  return json((await profileFor(user.id)).telegram)
})
export const DELETE = api(async (req, context, { user }) => {
  await transaction(async (client) => {
    await client.query('DELETE FROM tg_connections WHERE user_id=$1', [user.id])
    await client.query('DELETE FROM telegram_link_tokens WHERE user_id=$1', [user.id])
  })
  return json({ ok: true })
})
