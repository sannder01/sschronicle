import { api, json, ApiError } from '@/lib/api'
import { currentSessionToken } from '@/lib/auth'
import { query } from '@/lib/db'
export const DELETE = api(async (req, context, { user }) => {
  const token = await currentSessionToken()
  if (!token) throw new ApiError(401, 'Please sign in again.', 'UNAUTHORIZED')
  const result = await query('DELETE FROM sessions WHERE user_id=$1 AND session_token<>$2', [
    user.id,
    token,
  ])
  return json({ ok: true, revoked: result.rowCount })
})
