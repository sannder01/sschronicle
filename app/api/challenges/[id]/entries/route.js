import { json, readJson } from '@/lib/api'
import { transaction } from '@/lib/db'
import { trackingRoute } from '@/lib/tracking-server'
import { trackingId, trackingText, TrackingError } from '@/lib/tracking-validation'
import { canMarkChallengeDate } from '@/lib/challenges'

export const PUT = trackingRoute(async (req, { params }, { user }) => {
  const id = trackingId(params.id),
    body = await readJson(req),
    attemptId = trackingId(body.attempt_id)
  if (!['success', 'failed', 'unset'].includes(body.status))
    throw new TrackingError('Invalid day status')
  const note = trackingText(body.note ?? '', 2000)
  const result = await transaction(async (client) => {
    const challenge = (
      await client.query(
        'SELECT id,archived_at FROM challenges WHERE id=$1 AND user_id=$2 FOR UPDATE',
        [id, user.id],
      )
    ).rows[0]
    if (!challenge) throw new TrackingError('Challenge not found', 404)
    if (challenge.archived_at)
      throw new TrackingError('Restore this challenge before editing its history.', 409)
    const attempt = (
      await client.query(
        'SELECT a.*,start_date::text AS start_date FROM challenge_attempts a WHERE id=$1 AND challenge_id=$2 AND user_id=$3 FOR UPDATE',
        [attemptId, id, user.id],
      )
    ).rows[0]
    if (!attempt) throw new TrackingError('Attempt not found', 404)
    if (!canMarkChallengeDate(attempt, body.date))
      throw new TrackingError('Choose today or a past date within this attempt.')
    return (
      await client.query(
        'INSERT INTO challenge_entries(attempt_id,user_id,entry_date,status,note) VALUES($1,$2,$3,$4,$5) ON CONFLICT(attempt_id,entry_date) DO UPDATE SET status=EXCLUDED.status,note=EXCLUDED.note,updated_at=now() RETURNING *,entry_date::text AS entry_date',
        [attemptId, user.id, body.date, body.status, note],
      )
    ).rows[0]
  })
  return json(result)
})
