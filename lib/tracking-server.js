import { api, ApiError } from '@/lib/api';
import { query } from '@/lib/db';
import { TrackingError } from '@/lib/tracking-validation';
import { challengeStats } from '@/lib/challenges';
import { habitStats } from '@/lib/habits';
import { validTimezone } from '@/lib/dates';

export function trackingRoute(handler) { return api(async (...args) => { try { return await handler(...args); } catch (error) { if (error instanceof TrackingError) throw new ApiError(error.status, error.message, 'TRACKING_INVALID'); throw error; } }); }
export async function userTimezone(userId) {
  const result = await query("SELECT settings->>'timezone' AS timezone FROM users WHERE id=$1", [userId]);
  return validTimezone(result.rows[0]?.timezone) ? result.rows[0].timezone : 'UTC';
}
export async function challengeDetail(userId, id, attemptId) {
  const challenge = (await query('SELECT * FROM challenges WHERE id=$1 AND user_id=$2', [id, userId])).rows[0];
  if (!challenge) throw new TrackingError('Challenge not found', 404);
  const attempts = (await query('SELECT a.*, a.start_date::text AS start_date FROM challenge_attempts a WHERE challenge_id=$1 AND user_id=$2 ORDER BY id DESC', [id, userId])).rows;
  const attempt = attemptId ? attempts.find(row => row.id === attemptId) : attempts[0];
  if (!attempt) throw new TrackingError('Attempt not found', 404);
  const entries = (await query('SELECT e.*, entry_date::text AS entry_date FROM challenge_entries e WHERE attempt_id=$1 AND user_id=$2 ORDER BY entry_date DESC', [attempt.id, userId])).rows;
  return { challenge, attempts, attempt, entries, stats: challengeStats(attempt, entries) };
}
export async function listHabits(userId) {
  const [habits, entries] = await Promise.all([
    query('SELECT h.*, start_date::text AS start_date FROM habits h WHERE user_id=$1 ORDER BY sort_order, id', [userId]),
    query('SELECT l.*, logged_at::text AS logged_at FROM habit_logs l WHERE user_id=$1 ORDER BY logged_at DESC', [userId]),
  ]);
  const logs = new Map();
  for (const entry of entries.rows) { if (!logs.has(entry.habit_id)) logs.set(entry.habit_id, []); logs.get(entry.habit_id).push(entry); }
  return habits.rows.map(habit => ({ ...habit, logs: logs.get(habit.id) || [], ...habitStats(habit, logs.get(habit.id) || []) }));
}
