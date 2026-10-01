import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, validDate, validTimezone, todayInZone, weekday } from '../lib/dates.js';
import { challengeStats, canMarkChallengeDate } from '../lib/challenges.js';
import { habitStats, scheduledDays, isScheduled } from '../lib/habits.js';
import { attemptInput, challengeInput, habitInput, trackingId } from '../lib/tracking-validation.js';

const instant = day => new Date(`${day}T12:00:00Z`);
const attempt = (overrides = {}) => ({ start_date: '2026-03-01', duration: 30, timezone: 'UTC', ...overrides });
const mark = (entry_date, status = 'success', note = '') => ({ entry_date, status, note });
const habit = (overrides = {}) => ({ start_date: '2026-03-02', timezone: 'UTC', frequency: 'custom', days: [0, 2, 4], ...overrides });
const log = (logged_at, completed = true) => ({ logged_at, completed });

test('calendar validation rejects normalized impossible dates, timestamps and offsets', () => {
  assert.equal(validDate('2024-02-29'), true);
  for (const value of ['2026-02-29', '2026-04-31', '2026-2-01', '2026-01-01T00:00:00Z', null]) assert.equal(validDate(value), false);
  assert.equal(validTimezone('America/New_York'), true);
  assert.equal(validTimezone('Asia/Qyzylorda'), true);
  assert.equal(validTimezone('UTC'), true);
  assert.equal(validTimezone('+05:00'), false);
  assert.equal(validTimezone('Not/A_Zone'), false);
});

test('calendar addition crosses leap days, year boundaries and DST without hour arithmetic', () => {
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2024-02-28', 2), '2024-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(addDays('2026-11-01', -1), '2026-10-31');
  assert.equal(daysBetween('2026-03-01', '2026-03-30'), 29);
  assert.equal(weekday('2026-03-02'), 0);
  assert.equal(weekday('2026-03-08'), 6);
  assert.throws(() => addDays('2026-02-30', 1));
});

test('today uses each attempt timezone through local midnight and DST transitions', () => {
  assert.equal(todayInZone('Asia/Qyzylorda', new Date('2026-09-30T18:59:59Z')), '2026-09-30');
  assert.equal(todayInZone('Asia/Qyzylorda', new Date('2026-09-30T19:00:00Z')), '2026-10-01');
  assert.equal(todayInZone('America/New_York', new Date('2026-03-08T04:59:59Z')), '2026-03-07');
  assert.equal(todayInZone('America/New_York', new Date('2026-03-08T05:00:00Z')), '2026-03-08');
  assert.equal(todayInZone('America/New_York', new Date('2026-03-08T07:01:00Z')), '2026-03-08');
  assert.equal(todayInZone('Pacific/Kiritimati', new Date('2026-01-01T10:00:00Z')), '2026-01-02');
});

test('30 days include the start date and end exactly 29 calendar days later', () => {
  const stats = challengeStats(attempt(), [], instant('2026-03-01'));
  assert.equal(stats.end_date, '2026-03-30');
  assert.equal(stats.current_day, 1);
  assert.equal(stats.percentage, 0);
  assert.equal(stats.period_ended, false);
  assert.equal(challengeStats(attempt(), [], instant('2026-03-30')).period_ended, false);
  assert.equal(challengeStats(attempt(), [], instant('2026-03-31')).period_ended, true);
  assert.equal(challengeStats(attempt(), [], instant('2026-02-28')).current_day, 0);
  assert.equal(challengeStats(attempt(), [], instant('2026-02-28')).upcoming, true);
});

test('future and out-of-period dates cannot be marked; previous and final days can', () => {
  const current = attempt();
  assert.equal(canMarkChallengeDate(current, '2026-03-10', instant('2026-03-10')), true);
  assert.equal(canMarkChallengeDate(current, '2026-03-01', instant('2026-03-10')), true);
  assert.equal(canMarkChallengeDate(current, '2026-03-11', instant('2026-03-10')), false);
  assert.equal(canMarkChallengeDate(current, '2026-02-28', instant('2026-03-10')), false);
  assert.equal(canMarkChallengeDate(current, '2026-03-31', instant('2026-04-02')), false);
  assert.equal(canMarkChallengeDate(current, '2026-03-30', instant('2026-04-02')), true);
  assert.equal(canMarkChallengeDate(current, 'bad date', instant('2026-03-10')), false);
});

test('an unmarked today preserves the streak, an unmarked yesterday breaks it', () => {
  const marks = [mark('2026-03-01'), mark('2026-03-02')];
  assert.equal(challengeStats(attempt(), marks, instant('2026-03-03')).current_streak, 2);
  assert.equal(challengeStats(attempt(), [...marks, mark('2026-03-03', 'unset', 'Still trying')], instant('2026-03-03')).current_streak, 2);
  assert.equal(challengeStats(attempt(), marks, instant('2026-03-04')).current_streak, 0);
  assert.equal(challengeStats(attempt(), marks, instant('2026-03-04')).best_streak, 2);
});

test('explicit failure interrupts a challenge streak and correcting a past date restores it', () => {
  const marks = [mark('2026-03-01'), mark('2026-03-02', 'failed', 'Hard day'), mark('2026-03-03')];
  const before = challengeStats(attempt(), marks, instant('2026-03-04'));
  assert.equal(before.current_streak, 1);
  assert.equal(before.successful_days, 2);
  const corrected = marks.map(entry => entry.entry_date === '2026-03-02' ? { ...entry, status: 'success' } : entry);
  assert.equal(corrected[1].note, 'Hard day');
  const after = challengeStats(attempt(), corrected, instant('2026-03-04'));
  assert.equal(after.current_streak, 3);
  assert.equal(after.best_streak, 3);
  assert.equal(after.percentage, 10);
  assert.equal(challengeStats(attempt(), [...corrected, mark('2026-03-04', 'failed')], instant('2026-03-04')).current_streak, 0);
});

test('24/30 is 80 percent, a completed period is distinct from achieving the goal', () => {
  const marks = Array.from({ length: 24 }, (_, i) => mark(addDays('2026-03-01', i)));
  const stats = challengeStats(attempt(), marks, instant('2026-04-01'));
  assert.equal(stats.percentage, 80);
  assert.equal(stats.period_ended, true);
  assert.equal(stats.goal_completed, false);
  const complete = challengeStats(attempt(), Array.from({ length: 30 }, (_, i) => mark(addDays('2026-03-01', i))), instant('2026-03-30'));
  assert.equal(complete.goal_completed, true);
  assert.equal(complete.period_ended, false);
  assert.equal(complete.percentage, 100);
});

test('duplicate same-day marks never increase success count; a new attempt starts at zero', () => {
  const marks = [mark('2026-03-01'), mark('2026-03-01')];
  assert.equal(challengeStats(attempt(), marks, instant('2026-03-01')).successful_days, 1);
  assert.equal(challengeStats(attempt({ start_date: '2026-04-01' }), marks, instant('2026-04-01')).successful_days, 0);
  assert.equal(marks.length, 2);
});

test('the timezone stored in an attempt determines eligibility around midnight', () => {
  const inNewYork = attempt({ timezone: 'America/New_York' });
  const now = new Date('2026-03-02T02:00:00Z');
  assert.equal(challengeStats(inNewYork, [], now).today, '2026-03-01');
  assert.equal(canMarkChallengeDate(inNewYork, '2026-03-02', now), false);
  assert.equal(canMarkChallengeDate(attempt({ timezone: 'Asia/Qyzylorda' }), '2026-03-02', now), true);
});

test('scheduled habits bridge rest days; missing a scheduled day breaks the current streak', () => {
  const current = habit();
  const logs = [log('2026-03-02'), log('2026-03-04'), log('2026-03-06')];
  assert.deepEqual(scheduledDays(current), [0, 2, 4]);
  assert.equal(isScheduled(current, '2026-03-07'), false);
  assert.equal(habitStats(current, logs, instant('2026-03-08')).streak, 3);
  assert.equal(habitStats(current, logs, instant('2026-03-09')).streak, 3);
  assert.equal(habitStats(current, logs, instant('2026-03-10')).streak, 0);
  assert.equal(habitStats(current, logs, instant('2026-03-10')).best_streak, 3);
});

test('explicit habit state and duplicate rows do not inflate totals; correction restores a streak', () => {
  const current = habit();
  const logs = [log('2026-03-02'), log('2026-03-02'), log('2026-03-04', false), log('2026-03-06')];
  const stats = habitStats(current, logs, instant('2026-03-06'));
  assert.equal(stats.total_logs, 2);
  assert.equal(stats.streak, 1);
  assert.equal(stats.done_today, true);
  const corrected = logs.map(entry => entry.logged_at === '2026-03-04' ? { ...entry, completed: true } : entry);
  assert.equal(habitStats(current, corrected, instant('2026-03-06')).streak, 3);
});

test('schedule edits preserve historic completion totals without counting rest days in streaks', () => {
  const current = habit({ days: [0] });
  const stats = habitStats(current, [log('2026-03-02'), log('2026-03-04'), log('2026-03-06')], instant('2026-03-08'));
  assert.equal(stats.total_logs, 3);
  assert.equal(stats.streak, 1);
  assert.equal(stats.scheduled_today, false);
});

test('habit timezone uses local today and does not count future or pre-creation logs', () => {
  const current = habit({ frequency: 'daily', timezone: 'America/New_York' });
  const stats = habitStats(current, [log('2026-03-01'), log('2026-03-02'), log('2026-03-03')], new Date('2026-03-03T02:00:00Z'));
  assert.equal(stats.today, '2026-03-02');
  assert.equal(stats.streak, 1);
  assert.equal(stats.total_logs, 1);
});

test('tracking validation enforces bounded periods, text, colors, ids and nonempty schedules', () => {
  assert.deepEqual(attemptInput({ start_date: '2026-03-01', duration: 30 }, 'UTC'), attempt());
  for (const duration of [0, 367, 1.5, '30']) assert.throws(() => attemptInput({ start_date: '2026-03-01', duration }, 'UTC'));
  assert.throws(() => attemptInput({ start_date: '9999-12-31', duration: 30 }, 'UTC'));
  assert.throws(() => challengeInput({ title: ' ', color: '#ffffff' }));
  assert.throws(() => challengeInput({ title: 'Goal', color: 'url(evil)' }));
  assert.throws(() => habitInput({ name: 'Read', frequency: 'custom', days: [] }));
  assert.throws(() => habitInput({ name: 'Read', frequency: 'custom', days: [1, 1] }));
  assert.throws(() => habitInput({ name: 'Read', frequency: 'custom', days: [7] }));
  assert.equal(habitInput({ name: ' Read ', frequency: 'daily' }).name, 'Read');
  for (const id of ['bad', -1, 0, 1.5]) assert.throws(() => trackingId(id));
});
