import { createHash } from 'node:crypto'
import { api, json, readJson, ApiError } from '@/lib/api'
import { transaction } from '@/lib/db'
import { createTask, updateTask, deleteTask } from '@/lib/tasks'
import { secretMatches } from '@/lib/telegram'
import { text } from '@/lib/validation'

export const POST = api(
  async (req) => {
    if (!secretMatches(req.headers.get('x-webhook-secret'), process.env.TG_WEBHOOK_SECRET))
      throw new ApiError(401, 'Unauthorized.', 'UNAUTHORIZED')
    const body = await readJson(req, 16384)
    const chatId = String(body.chat_id ?? '')
    if (!/^-?\d{1,20}$/.test(chatId)) throw new ApiError(400, 'Invalid chat_id.')
    if (body.action === 'account_linked') {
      const token = text(body.token, { field: 'token', max: 100 })
      const hash = createHash('sha256')
        .update(token.replace(/^link_/, ''))
        .digest('hex')
      await transaction(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['telegram:' + chatId])
        const { rows } = await client.query(
          'DELETE FROM telegram_link_tokens WHERE token_hash=$1 AND expires_at>NOW() RETURNING user_id',
          [hash],
        )
        if (!rows.length)
          throw new ApiError(410, 'This link has expired or has already been used.', 'LINK_EXPIRED')
        const userId = rows[0].user_id
        const other = await client.query(
          'SELECT user_id FROM tg_connections WHERE chat_id=$1 AND user_id<>$2',
          [chatId, userId],
        )
        if (other.rows.length)
          throw new ApiError(
            409,
            'This Telegram account is connected to another Chronicle account.',
            'ALREADY_CONNECTED',
          )
        await client.query(
          'INSERT INTO tg_connections(user_id,chat_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET chat_id=EXCLUDED.chat_id,updated_at=NOW()',
          [userId, chatId],
        )
      })
      return json({ ok: true, connected: true })
    }
    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT user_id FROM tg_connections WHERE chat_id=$1', [
        chatId,
      ])
      if (rows.length !== 1)
        throw new ApiError(
          404,
          'Unknown or ambiguous chat_id. Reconnect Telegram.',
          'NOT_CONNECTED',
        )
      const userId = rows[0].user_id
      let eventKey = null
      if (body.event_id !== undefined) {
        eventKey = userId + ':' + text(String(body.event_id), { field: 'event_id', max: 120 })
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [eventKey])
        const previous = await client.query(
          'SELECT response FROM telegram_webhook_events WHERE event_id=$1 AND user_id=$2',
          [eventKey, userId],
        )
        if (previous.rows.length) return previous.rows[0].response
      }
      let response
      switch (body.action) {
        case 'task_created':
          response = {
            ok: true,
            task: await createTask(userId, body.task ?? {}, 'telegram', client),
          }
          break
        case 'task_updated':
          response = {
            ok: true,
            task: await updateTask(userId, body.task?.id, body.task ?? {}, client),
          }
          break
        case 'task_deleted':
          response = await deleteTask(userId, body.task?.id, client)
          break
        default:
          throw new ApiError(400, 'Unsupported action.')
      }
      if (eventKey)
        await client.query(
          'INSERT INTO telegram_webhook_events(event_id,user_id,response) VALUES($1,$2,$3)',
          [eventKey, userId, JSON.stringify(response)],
        )
      return response
    })
    return json(result, body.action === 'task_created' ? 201 : 200)
  },
  { auth: false, csrf: false },
)
