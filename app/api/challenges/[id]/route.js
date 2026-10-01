import { json, readJson } from '@/lib/api';
import { transaction } from '@/lib/db';
import { trackingRoute, challengeDetail } from '@/lib/tracking-server';
import { trackingId, challengeInput, attemptInput, TrackingError } from '@/lib/tracking-validation';
import { todayInZone } from '@/lib/dates';

export const GET = trackingRoute(async (req, { params }, { user }) => {
  const selected = new URL(req.url).searchParams.get('attempt');
  return json(await challengeDetail(user.id, trackingId(params.id), selected ? trackingId(selected) : undefined));
});
export const PATCH = trackingRoute(async (req, { params }, { user }) => {
  const id = trackingId(params.id), body = await readJson(req);
  await transaction(async client => {
    const existing = (await client.query('SELECT * FROM challenges WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, user.id])).rows[0];
    if (!existing) throw new TrackingError('Challenge not found', 404);
    if (Object.hasOwn(body, 'archived')) {
      if (typeof body.archived !== 'boolean') throw new TrackingError('Invalid archive state');
      await client.query('UPDATE challenges SET archived_at=CASE WHEN $3 THEN now() ELSE NULL END, updated_at=now() WHERE id=$1 AND user_id=$2', [id, user.id, body.archived]);
    } else {
      const challenge = challengeInput(body);
      await client.query('UPDATE challenges SET title=$3,description=$4,icon=$5,color=$6,updated_at=now() WHERE id=$1 AND user_id=$2', [id, user.id, challenge.title, challenge.description, challenge.icon, challenge.color]);
      if (body.start_date !== undefined || body.duration !== undefined) {
        const attempt = (await client.query('SELECT a.*,start_date::text AS start_date FROM challenge_attempts a WHERE challenge_id=$1 AND user_id=$2 ORDER BY id DESC LIMIT 1 FOR UPDATE', [id, user.id])).rows[0];
        const next = attemptInput(body, attempt.timezone);
        if (next.start_date !== attempt.start_date || next.duration !== attempt.duration) {
          if (attempt.start_date <= todayInZone(attempt.timezone)) throw new TrackingError('A started attempt keeps its original period. Restart instead.', 409);
          await client.query('UPDATE challenge_attempts SET start_date=$3,duration=$4 WHERE id=$1 AND user_id=$2', [attempt.id, user.id, next.start_date, next.duration]);
        }
      }
    }
  });
  return json(await challengeDetail(user.id, id));
});
export const DELETE = trackingRoute(async (_req, { params }, { user }) => {
  await transaction(async client => {
    const deleted = await client.query('DELETE FROM challenges WHERE id=$1 AND user_id=$2 RETURNING id', [trackingId(params.id), user.id]);
    if (!deleted.rowCount) throw new TrackingError('Challenge not found', 404);
  });
  return json({ ok: true });
});
