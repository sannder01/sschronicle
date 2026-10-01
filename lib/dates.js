/** Calendar dates are strings. Never convert a local day through toISOString(). */
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validTimezone(value) {
  if (typeof value !== 'string' || value.length > 100 || /^[+-]/.test(value)) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format()
    return true
  } catch {
    return false
  }
}

export function todayInZone(timezone = 'UTC', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type) => parts.find((p) => p.type === type).value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function addDays(day, count) {
  if (!validDate(day) || !Number.isInteger(count)) throw new Error('Invalid calendar date')
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

export function daysBetween(from, to) {
  if (!validDate(from) || !validDate(to)) throw new Error('Invalid calendar date')
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000)
}

/** Monday is 0, Sunday is 6, matching Chronicle's original habit schedules. */
export function weekday(day) {
  if (!validDate(day)) throw new Error('Invalid calendar date')
  return (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7
}

export function displayDate(day, language = 'ru', options = {}) {
  if (!validDate(day)) return ''
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    ...options,
  }).format(new Date(`${day}T12:00:00Z`))
}
