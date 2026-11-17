export const DAY = 1440

export const fmt = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
export const parseTime = (value) => {
  const [h, m] = String(value || '')
    .split(':')
    .map(Number)
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null
}
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export const snap = (min, step = 15) => Math.round(min / step) * step
export const round5 = (min) => Math.round(min / 5) * 5

export function nowMinutes(timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  return get('hour') * 60 + get('minute')
}

export function durationLabel(min, t) {
  const h = Math.floor(min / 60),
    m = min % 60
  if (!h) return t(`${m} мин`, `${m} min`)
  if (!m) return t(`${h} ч`, `${h} h`)
  return t(`${h} ч ${m} мин`, `${h} h ${m} min`)
}
