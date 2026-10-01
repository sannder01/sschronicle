import { api, json, readJson, ApiError } from '@/lib/api'
import { currentSessionToken } from '@/lib/auth'
import { transaction } from '@/lib/db'
export const DELETE = api(async (req, context, { user }) => {
  const body = await readJson(req, 4096)
  if (body.confirmation !== 'DELETE')
    throw new ApiError(400, 'Type DELETE to confirm account deletion.', 'CONFIRMATION_REQUIRED')
  const token = await currentSessionToken()
  await transaction(async (client) => {
    const { rows } = await client.query(
      "SELECT id FROM sessions WHERE user_id=$1 AND session_token=$2 AND expires>NOW() AND authenticated_at>NOW()-INTERVAL '10 minutes' FOR UPDATE",
      [user.id, token],
    )
    if (!rows.length)
      throw new ApiError(
        403,
        'Sign in with Google again before deleting your account.',
        'REAUTHENTICATION_REQUIRED',
      )
    // Legacy tables created by older runtime endpoints may have lacked foreign keys.
    // Delete only this account's rows, including retained historical fitness data.
    for (const table of [
      'fitness_meals',
      'fitness_weight',
      'fitness_water',
      'fitness_config',
      'habit_logs',
      'habits',
    ]) {
      const exists = (await client.query('SELECT to_regclass($1) AS name', [table])).rows[0].name
      if (exists) await client.query('DELETE FROM ' + table + ' WHERE user_id=$1', [user.id])
    }
    await client.query('DELETE FROM users WHERE id=$1', [user.id])
  })
  const response = json({ ok: true })
  const secure = req.url.startsWith('https:') || process.env.NEXTAUTH_URL?.startsWith('https:')
  response.headers.append(
    'Set-Cookie',
    'next-auth.session-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  )
  if (secure)
    response.headers.append(
      'Set-Cookie',
      '__Secure-next-auth.session-token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    )
  return response
})
