import { json, readJson } from '@/lib/api';
import { query, transaction } from '@/lib/db';
import { trackingRoute, userTimezone } from '@/lib/tracking-server';
import { challengeInput, attemptInput } from '@/lib/tracking-validation';
import { challengeStats } from '@/lib/challenges';

export const GET = trackingRoute(async (_req, _context, { user }) => {
  const [challenges, attempts, entries] = await Promise.all([
    query('SELECT * FROM challenges WHERE user_id=$1 ORDER BY created_at DESC', [user.id]),
    query('SELECT DISTINCT ON (challenge_id) a.*, start_date::text AS start_date FROM challenge_attempts a WHERE user_id=$1 ORDER BY challenge_id,id DESC', [user.id]),
    query('SELECT e.*, entry_date::text AS entry_date FROM challenge_entries e WHERE user_id=$1 AND attempt_id IN (SELECT max(id) FROM challenge_attempts WHERE user_id=$1 GROUP BY challenge_id)', [user.id]),
  ]);
  const byChallenge = new Map(attempts.rows.map(row => [row.challenge_id, row]));
  const byAttempt = new Map();
  for (const entry of entries.rows) { if (!byAttempt.has(entry.attempt_id)) byAttempt.set(entry.attempt_id, []); byAttempt.get(entry.attempt_id).push(entry); }
  return json(challenges.rows.map(challenge => { const attempt = byChallenge.get(challenge.id); return { ...challenge, attempt, stats: challengeStats(attempt, byAttempt.get(attempt.id) || []) }; }));
});

export const POST = trackingRoute(async (req, _context, { user }) => {
  const body = await readJson(req), challenge = challengeInput(body), attempt = attemptInput(body, await userTimezone(user.id));
  const result = await transaction(async client => {
    const created = (await client.query('INSERT INTO challenges(user_id,title,description,icon,color) VALUES($1,$2,$3,$4,$5) RETURNING *', [user.id, challenge.title, challenge.description, challenge.icon, challenge.color])).rows[0];
    await client.query('INSERT INTO challenge_attempts(challenge_id,user_id,start_date,duration,timezone) VALUES($1,$2,$3,$4,$5)', [created.id, user.id, attempt.start_date, attempt.duration, attempt.timezone]);
    return created;
  });
  return json(result, 201);
});
