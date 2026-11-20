// Pure helpers for the weekly timetable (shared by the page and the editor).
export { fmt, parseTime } from './time'

export const DAYS = [
  { n: 1, ru: 'Пн', en: 'Mon', ruFull: 'Понедельник', enFull: 'Monday' },
  { n: 2, ru: 'Вт', en: 'Tue', ruFull: 'Вторник', enFull: 'Tuesday' },
  { n: 3, ru: 'Ср', en: 'Wed', ruFull: 'Среда', enFull: 'Wednesday' },
  { n: 4, ru: 'Чт', en: 'Thu', ruFull: 'Четверг', enFull: 'Thursday' },
  { n: 5, ru: 'Пт', en: 'Fri', ruFull: 'Пятница', enFull: 'Friday' },
  { n: 6, ru: 'Сб', en: 'Sat', ruFull: 'Суббота', enFull: 'Saturday' },
  { n: 7, ru: 'Вс', en: 'Sun', ruFull: 'Воскресенье', enFull: 'Sunday' },
]
export const KINDS = [
  { value: 'lecture', ru: 'Лекция', en: 'Lecture' },
  { value: 'practice', ru: 'Практика', en: 'Practice' },
  { value: 'lab', ru: 'Лаба', en: 'Lab' },
  { value: 'seminar', ru: 'Семинар', en: 'Seminar' },
  { value: 'other', ru: 'Другое', en: 'Other' },
]
export const kindLabel = (value, t) => {
  const k = KINDS.find((x) => x.value === value) || KINDS[4]
  return t(k.ru, k.en)
}

/** Weekday (1 = Monday … 7 = Sunday) and minutes since midnight in a time zone. */
export function todayInZone(timezone = 'UTC') {
  let zone = timezone
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone })
  } catch {
    zone = 'UTC'
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type) => parts.find((p) => p.type === type)?.value
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1
  return { weekday: weekday || 1, minutes: Number(get('hour')) * 60 + Number(get('minute')) }
}

/** "20 мин", "1 ч 10 мин" */
export function breakLabel(min, t) {
  const h = Math.floor(min / 60),
    m = min % 60
  if (!h) return t(`${m} мин`, `${m} min`)
  if (!m) return t(`${h} ч`, `${h} h`)
  return t(`${h} ч ${m} мин`, `${h} h ${m} min`)
}

/**
 * Side-by-side lanes for overlapping classes in one day: Map(id -> {index, count}).
 * Classes that overlap (directly or through a chain) share the width of their group.
 */
export function entryLanes(list) {
  const sorted = [...list].sort((a, b) => a.start_min - b.start_min || a.end_min - b.end_min)
  const out = new Map()
  let group = [],
    groupEnd = -1
  const flush = () => {
    const laneEnds = []
    for (const e of group) {
      let lane = laneEnds.findIndex((end) => end <= e.start_min)
      if (lane < 0) lane = laneEnds.length
      laneEnds[lane] = e.end_min
      out.set(e.id, { index: lane, count: 0 })
    }
    for (const e of group) out.get(e.id).count = laneEnds.length
    group = []
  }
  for (const e of sorted) {
    if (group.length && e.start_min >= groupEnd) flush()
    group.push(e)
    groupEnd = Math.max(groupEnd, e.end_min)
  }
  if (group.length) flush()
  return out
}

/** Classes of the same days that overlap the given time (for the editor's warning). */
export function overlaps(entries, weekdays, start, end, exceptId) {
  return entries.filter(
    (e) =>
      e.id !== exceptId && weekdays.includes(e.weekday) && e.start_min < end && start < e.end_min,
  )
}
