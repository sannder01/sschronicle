import { json, readJson } from '@/lib/api';
import { transaction } from '@/lib/db';
import { trackingRoute, userTimezone } from '@/lib/tracking-server';
import { trackingId, attemptInput, TrackingError } from '@/lib/tracking-validation';

export const POST = trackingRoute(async (req, { params }, { user }) => {
  const id = trackingId(params.id), body = await readJson(req), attempt = attemptInput(body, await userTimezone(user.id));
  const result = await transaction(async client => {
    const challenge = (await client.query('SELECT id FROM challenges WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, user.id])).rows[0];
    if (!challenge) throw new TrackingError('Challenge not found', 404);
    // The previous-attempt precondition prevents concurrent or retried restarts creating duplicates.
    const latest = (await client.query('SELECT id FROM challenge_attempts WHERE challenge_id=$1 AND user_id=$2 ORDER BY id DESC LIMIT 1', [id, user.id])).rows[0];
    if (trackingId(body.previous_attempt_id) !== latest.id) throw new TrackingError('The challenge already has a newer attempt. Refresh to see it.', 409);
    const row = (await client.query('INSERT INTO challenge_attempts(challenge_id,user_id,start_date,duration,timezone) VALUES($1,$2,$3,$4,$5) RETURNING *,start_date::text AS start_date', [id, user.id, attempt.start_date, attempt.duration, attempt.timezone])).rows[0];
    await client.query('UPDATE challenges SET archived_at=NULL,updated_at=now() WHERE id=$1 AND user_id=$2', [id, user.id]);
    return row;
  });
  return json(result, 201);
});
