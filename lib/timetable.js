import { query, transaction } from './db.js'
import { ApiError } from './api-error.js'
import { positiveId, text, oneOf, date, boolean } from './validation.js'
import { colors } from './schedule.js'
import { daysBetween, todayInZone, validTimezone, weekday as dateWeekday } from './dates.js'

const kinds = ['study', 'work', 'sport', 'food', 'rest', 'other']

function minutes(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max || value % 5 !== 0)
    throw new ApiError(400, 'Invalid ' + field + '.', 'VALIDATION_ERROR')
  return value
}

function weekday(value) {
  if (!Number.isInteger(value) || value < 1 || value > 7)
    throw new ApiError(400, 'Invalid weekday.', 'VALIDATION_ERROR')
  return value
}

export function validateTimetableEntry(body, partial = false) {
  const values = {}
  if (!partial && body.weekdays !== undefined) {
    if (
      !Array.isArray(body.weekdays) ||
      body.weekdays.length < 1 ||
      body.weekdays.length > 7 ||
      body.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7) ||
      new Set(body.weekdays).size !== body.weekdays.length
    )
      throw new ApiError(400, 'Invalid weekdays.', 'VALIDATION_ERROR')
    values.weekdays = body.weekdays
  } else if (!partial || body.weekday !== undefined) values.weekday = weekday(body.weekday)
  if (!partial || body.start_min !== undefined)
    values.start_min = minutes(body.start_min, 'start_min', 0, 1435)
  if (!partial || body.end_min !== undefined)
    values.end_min = minutes(body.end_min, 'end_min', 5, 1440)
  if (!partial || body.title !== undefined)
    values.title = text(body.title, { field: 'title', max: 120 })
  if (!partial || body.kind !== undefined) values.kind = oneOf(body.kind ?? 'other', kinds, 'kind')
  if (!partial || body.room !== undefined)
    values.room = body.room == null ? '' : text(body.room, { field: 'room', max: 60, min: 0 })
  if (!partial || body.teacher !== undefined)
    values.teacher =
      body.teacher == null ? '' : text(body.teacher, { field: 'teacher', max: 80, min: 0 })
  if (!partial || body.note !== undefined)
    values.note = body.note == null ? '' : text(body.note, { field: 'note', max: 500, min: 0 })
  if (!partial || body.color !== undefined)
    values.color = oneOf(body.color ?? 'accent', colors, 'color')
  if (partial && !Object.keys(values).length) throw new ApiError(400, 'Nothing to update.')
  if (
    values.start_min !== undefined &&
    values.end_min !== undefined &&
    values.end_min <= values.start_min
  )
    throw new ApiError(400, 'End time must be after start time.', 'VALIDATION_ERROR')
  return values
}

function entry(row) {
  return {
    id: Number(row.id),
    weekday: Number(row.weekday),
    start_min: Number(row.start_min),
    end_min: Number(row.end_min),
    title: row.title,
    kind: row.kind,
    room: row.room,
    teacher: row.teacher,
    note: row.note,
    color: row.color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listTimetable(userId) {
  const { rows } = await query(
    'SELECT * FROM timetable_entries WHERE user_id=$1 ORDER BY weekday,start_min,id',
    [userId],
  )
  return rows.map(entry)
}

export async function createTimetableEntries(userId, body) {
  const values = validateTimetableEntry(body)
  if (values.weekdays === undefined)
    throw new ApiError(400, 'Invalid weekdays.', 'VALIDATION_ERROR')
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const counts = (
      await client.query('SELECT COUNT(*)::int AS total FROM timetable_entries WHERE user_id=$1', [
        userId,
      ])
    ).rows[0]
    if (counts.total + values.weekdays.length > 150)
      throw new ApiError(400, 'A user can have at most 150 timetable entries.', 'LIMIT_REACHED')
    for (const day of values.weekdays) {
      const count = (
        await client.query(
          'SELECT COUNT(*)::int AS count FROM timetable_entries WHERE user_id=$1 AND weekday=$2',
          [userId, day],
        )
      ).rows[0].count
      if (count >= 30)
        throw new ApiError(400, 'A weekday can have at most 30 timetable entries.', 'LIMIT_REACHED')
    }
    const rows = []
    for (const day of values.weekdays) {
      const result = await client.query(
        'INSERT INTO timetable_entries(user_id,weekday,start_min,end_min,title,kind,room,teacher,note,color) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
        [
          userId,
          day,
          values.start_min,
          values.end_min,
          values.title,
          values.kind,
          values.room,
          values.teacher,
          values.note,
          values.color,
        ],
      )
      rows.push(entry(result.rows[0]))
    }
    return rows
  })
}

export async function updateTimetableEntry(userId, id, body) {
  id = positiveId(id)
  const updates = validateTimetableEntry(body, true)
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const existing = (
      await client.query('SELECT * FROM timetable_entries WHERE id=$1 AND user_id=$2 FOR UPDATE', [
        id,
        userId,
      ])
    ).rows[0]
    if (!existing) throw new ApiError(404, 'Timetable entry not found.', 'NOT_FOUND')
    const merged = { ...existing, ...updates }
    if (merged.end_min <= merged.start_min)
      throw new ApiError(400, 'End time must be after start time.', 'VALIDATION_ERROR')
    if (updates.weekday !== undefined && updates.weekday !== Number(existing.weekday)) {
      const count = (
        await client.query(
          'SELECT COUNT(*)::int AS count FROM timetable_entries WHERE user_id=$1 AND weekday=$2 AND id<>$3',
          [userId, updates.weekday, id],
        )
      ).rows[0].count
      if (count >= 30)
        throw new ApiError(400, 'A weekday can have at most 30 timetable entries.', 'LIMIT_REACHED')
    }
    const keys = Object.keys(updates)
    const values = keys.map((key) => updates[key])
    const assignments = keys.map((key, index) => key + '=$' + (index + 1))
    values.push(id, userId)
    const row = (
      await client.query(
        'UPDATE timetable_entries SET ' +
          assignments.join(',') +
          ',updated_at=NOW() WHERE id=$' +
          (values.length - 1) +
          ' AND user_id=$' +
          values.length +
          ' RETURNING *',
        values,
      )
    ).rows[0]
    return entry(row)
  })
}

export async function deleteTimetableEntry(userId, id) {
  const { rows } = await query(
    'DELETE FROM timetable_entries WHERE id=$1 AND user_id=$2 RETURNING id',
    [positiveId(id), userId],
  )
  if (!rows.length) throw new ApiError(404, 'Timetable entry not found.', 'NOT_FOUND')
  return { ok: true }
}

export function validateDoneDate(dayValue, entryWeekday, timezone = 'UTC', now = new Date()) {
  const day = date(dayValue, 'day')
  if (!day) throw new ApiError(400, 'Invalid day.', 'VALIDATION_ERROR')
  const zone = validTimezone(timezone) ? timezone : 'UTC'
  const today = todayInZone(zone, now)
  if (dateWeekday(day) + 1 !== Number(entryWeekday))
    throw new ApiError(400, 'Day does not match the timetable entry weekday.', 'VALIDATION_ERROR')
  const offset = daysBetween(today, day)
  if (offset < -30 || offset > 1)
    throw new ApiError(
      400,
      'Day must be within 30 days in the past and 1 day in the future.',
      'VALIDATION_ERROR',
    )
  return day
}

export async function listDone(userId, dayValue) {
  const day = date(dayValue, 'day')
  if (!day) throw new ApiError(400, 'Invalid day.', 'VALIDATION_ERROR')
  const { rows } = await query(
    'SELECT entry_id FROM timetable_done WHERE user_id=$1 AND day=$2 ORDER BY entry_id',
    [userId, day],
  )
  return { day, entry_ids: rows.map((row) => Number(row.entry_id)) }
}

export async function setDone(userId, entryId, body) {
  const id = positiveId(entryId)
  const day = date(body.day, 'day')
  if (!day) throw new ApiError(400, 'Invalid day.', 'VALIDATION_ERROR')
  const done = boolean(body.done, 'done')
  const result = await query(
    "SELECT e.weekday, u.settings->>'timezone' AS timezone FROM timetable_entries e JOIN users u ON u.id=e.user_id WHERE e.id=$1 AND e.user_id=$2",
    [id, userId],
  )
  const entryRow = result.rows[0]
  if (!entryRow) throw new ApiError(404, 'Timetable entry not found.', 'NOT_FOUND')
  validateDoneDate(day, entryRow.weekday, entryRow.timezone)
  if (done) {
    await query(
      'INSERT INTO timetable_done(entry_id,user_id,day) VALUES($1,$2,$3) ON CONFLICT(entry_id,day) DO NOTHING',
      [id, userId, day],
    )
  } else {
    await query('DELETE FROM timetable_done WHERE entry_id=$1 AND user_id=$2 AND day=$3', [
      id,
      userId,
      day,
    ])
  }
  return { day, entry_id: id, done }
}
