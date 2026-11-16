import { randomInt } from 'node:crypto'
import { api, json } from '@/lib/api'
import { query, transaction } from '@/lib/db'
import { linkCodeHash } from '@/lib/integrations/chronicle.mjs'
export const dynamic = 'force-dynamic'

// Unambiguous alphabet: no 0/O or 1/I/L, so the code is easy to read aloud or retype.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

async function status(userId) {
  const { rows } = await query('SELECT email,created_at FROM chatgpt_links WHERE user_id=$1', [
    userId,
  ])
  return rows[0]
    ? { connected: true, email: rows[0].email, linked_at: rows[0].created_at }
    : { connected: false }
}

export const GET = api(async (req, context, { user }) => json(await status(user.id)))

export const POST = api(async (req, context, { user }) => {
  const raw = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
  const code = raw.slice(0, 5) + '-' + raw.slice(5)
  const expires = new Date(Date.now() + 10 * 60 * 1000)
  await transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id])
    await client.query('DELETE FROM chatgpt_link_codes WHERE user_id=$1 OR expires_at<NOW()', [
      user.id,
    ])
    await client.query(
      'INSERT INTO chatgpt_link_codes(code_hash,user_id,expires_at) VALUES($1,$2,$3)',
      [linkCodeHash(code), user.id, expires],
    )
  })
  return json({ code, expires_at: expires.toISOString() })
})

export const DELETE = api(async (req, context, { user }) => {
  await transaction(async (client) => {
    await client.query('DELETE FROM chatgpt_links WHERE user_id=$1', [user.id])
    await client.query('DELETE FROM chatgpt_link_codes WHERE user_id=$1', [user.id])
  })
  return json({ connected: false })
})
