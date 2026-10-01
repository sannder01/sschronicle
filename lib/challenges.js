import { addDays, daysBetween, todayInZone, validDate } from './dates.js'

export function challengeStats(attempt, entries = [], now = new Date()) {
  const today = todayInZone(attempt.timezone, now)
  const end = addDays(attempt.start_date, attempt.duration - 1)
  const marks = new Map(entries.map((entry) => [entry.entry_date, entry.status]))
  let successes = 0,
    best = 0,
    run = 0
  for (let offset = 0; offset < attempt.duration; offset += 1) {
    const date = addDays(attempt.start_date, offset)
    if (date > today) break
    if (marks.get(date) === 'success') {
      successes += 1
      run += 1
      best = Math.max(best, run)
    } else run = 0
  }
  // Today's empty slot is still available. An explicit failure does break a streak.
  let cursor = today < end ? today : end
  if (cursor === today && (!marks.has(cursor) || marks.get(cursor) === 'unset'))
    cursor = addDays(cursor, -1)
  let current = 0
  while (cursor >= attempt.start_date && marks.get(cursor) === 'success') {
    current += 1
    cursor = addDays(cursor, -1)
  }
  return {
    today,
    end_date: end,
    successful_days: successes,
    percentage: Math.round((successes / attempt.duration) * 100),
    current_streak: current,
    best_streak: best,
    current_day: Math.min(
      attempt.duration,
      Math.max(0, daysBetween(attempt.start_date, today) + 1),
    ),
    period_ended: today > end,
    goal_completed: successes === attempt.duration,
    upcoming: today < attempt.start_date,
  }
}

export function canMarkChallengeDate(attempt, date, now = new Date()) {
  return (
    validDate(date) &&
    date >= attempt.start_date &&
    date <= addDays(attempt.start_date, attempt.duration - 1) &&
    date <= todayInZone(attempt.timezone, now)
  )
}
