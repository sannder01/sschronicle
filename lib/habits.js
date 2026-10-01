import { addDays, todayInZone, weekday } from './dates.js';

export function scheduledDays(habit) {
  return habit.frequency === 'custom' && Array.isArray(habit.days) && habit.days.length ? habit.days : [0, 1, 2, 3, 4, 5, 6];
}

export function isScheduled(habit, date) { return scheduledDays(habit).includes(weekday(date)); }

export function habitStats(habit, logs = [], now = new Date()) {
  const today = todayInZone(habit.timezone || 'UTC', now);
  const completed = new Set(logs.filter(log => log.completed !== false).map(log => log.logged_at));
  const start = habit.start_date || today;
  let current = 0, best = 0, run = 0;
  const total = [...completed].filter(day => day >= start && day <= today).length;
  for (let day = start; day <= today; day = addDays(day, 1)) {
    if (!isScheduled(habit, day)) continue;
    if (completed.has(day)) { run += 1; best = Math.max(best, run); }
    else if (day !== today) run = 0;
  }
  current = run;
  return { today, streak: current, best_streak: best, total_logs: total, done_today: completed.has(today), scheduled_today: isScheduled(habit, today) };
}
