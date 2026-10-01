import { json, readJson } from '@/lib/api';
import { query, transaction } from '@/lib/db';
import { trackingRoute } from '@/lib/tracking-server';
import { trackingId, TrackingError } from '@/lib/tracking-validation';
import { todayInZone, validDate } from '@/lib/dates';
import { isScheduled } from '@/lib/habits';

export const PUT = trackingRoute(async (req, { params }, { user }) => {
  const id = trackingId(params.id), body = await readJson(req);
  if (typeof body.completed !== 'boolean' || !validDate(body.date)) throw new TrackingError('Provide an explicit date and completed boolean.');
  const result = await transaction(async client => {
    const habit = (await client.query('SELECT h.*,start_date::text AS start_date FROM habits h WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, user.id])).rows[0];
    if (!habit) throw new TrackingError('Habit not found', 404);
    if (body.date < habit.start_date || body.date > todayInZone(habit.timezone)) throw new TrackingError('Choose today or a past date since this habit was created.');
    if (body.completed && !isScheduled(habit, body.date)) throw new TrackingError('This habit is not scheduled for that weekday.');
    return (await client.query('INSERT INTO habit_logs(habit_id,user_id,logged_at,completed) VALUES($1,$2,$3,$4) ON CONFLICT(habit_id,logged_at) DO UPDATE SET completed=EXCLUDED.completed,updated_at=now() RETURNING *,logged_at::text AS logged_at', [id, user.id, body.date, body.completed])).rows[0];
  });
  return json(result);
});
// Legacy URL remains, but ambiguous toggles are rejected by the explicit contract.
export const POST = PUT;
export const GET = trackingRoute(async (_req, { params }, { user }) => {
  const id = trackingId(params.id);
  if (!(await query('SELECT id FROM habits WHERE id=$1 AND user_id=$2', [id, user.id])).rowCount) throw new TrackingError('Habit not found', 404);
  const logs = (await query('SELECT l.*,logged_at::text AS logged_at FROM habit_logs l WHERE habit_id=$1 AND user_id=$2 ORDER BY logged_at DESC', [id, user.id])).rows;
  return json({ logs, dates: logs.filter(log => log.completed).map(log => log.logged_at) });
});
