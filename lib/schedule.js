import { query, transaction } from './db.js'
import { ApiError } from './api-error.js'
import { positiveId, date, text, oneOf, boolean } from './validation.js'

const colors = ['accent', 'blue', 'indigo', 'teal', 'green', 'orange', 'red', 'pink', 'graphite']

function minutes(value, field, min, max) {
  if (!Number.isInteger(value) || value < min || value > max || value % 5 !== 0)
    throw new ApiError(400, 'Invalid ' + field + '.', 'VALIDATION_ERROR')
  return value
}

export function validateScheduleBlock(body, partial = false) {
  const values = {}
  if (!partial || body.day !== undefined) {
    values.day = date(body.day, 'day')
    if (!values.day) throw new ApiError(400, 'Invalid day.', 'VALIDATION_ERROR')
  }
  if (!partial || body.start_min !== undefined)
    values.start_min = minutes(body.start_min, 'start_min', 0, 1439)
  if (!partial || body.end_min !== undefined)
    values.end_min = minutes(body.end_min, 'end_min', 1, 1440)
  if (!partial || body.title !== undefined)
    values.title = text(body.title, { field: 'title', max: 120 })
  if (!partial || body.note !== undefined)
    values.note =
      body.note == null || body.note === '' ? null : text(body.note, { field: 'note', max: 1000 })
  if (!partial || body.color !== undefined)
    values.color = oneOf(body.color ?? 'accent', colors, 'color')
  if (body.done !== undefined) values.done = boolean(body.done, 'done')
  if (partial && !Object.keys(values).length) throw new ApiError(400, 'Nothing to update.')
  if (
    values.start_min !== undefined &&
    values.end_min !== undefined &&
    values.end_min <= values.start_min
  )
    throw new ApiError(400, 'End time must be after start time.', 'VALIDATION_ERROR')
  return values
}

function block(row) {
  return {
    id: Number(row.id),
    day:
      row.day instanceof Date ? row.day.toISOString().slice(0, 10) : String(row.day).slice(0, 10),
    start_min: Number(row.start_min),
    end_min: Number(row.end_min),
    title: row.title,
    note: row.note,
    color: row.color,
    done: row.done,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function listSchedule(userId, day) {
  const parsedDay = date(day, 'day')
  if (!parsedDay) throw new ApiError(400, 'Invalid day.', 'VALIDATION_ERROR')
  const { rows } = await query(
    'SELECT * FROM schedule_blocks WHERE user_id=$1 AND day=$2 ORDER BY start_min,id',
    [userId, parsedDay],
  )
  return rows.map(block)
}

export async function createScheduleBlock(userId, body) {
  const values = validateScheduleBlock(body)
  return transaction(async (client) => {
    // Serialize creates for this account so the daily cap holds under concurrency.
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const count = (
      await client.query(
        'SELECT COUNT(*)::int AS count FROM schedule_blocks WHERE user_id=$1 AND day=$2',
        [userId, values.day],
      )
    ).rows[0].count
    if (count >= 60) throw new ApiError(400, 'A day can have at most 60 schedule blocks.')
    const row = (
      await client.query(
        'INSERT INTO schedule_blocks(user_id,day,start_min,end_min,title,note,color) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
        [
          userId,
          values.day,
          values.start_min,
          values.end_min,
          values.title,
          values.note ?? null,
          values.color,
        ],
      )
    ).rows[0]
    return block(row)
  })
}

export async function updateScheduleBlock(userId, id, body) {
  id = positiveId(id)
  const updates = validateScheduleBlock(body, true)
  return transaction(async (client) => {
    const existing = (
      await client.query('SELECT * FROM schedule_blocks WHERE id=$1 AND user_id=$2 FOR UPDATE', [
        id,
        userId,
      ])
    ).rows[0]
    if (!existing) throw new ApiError(404, 'Schedule block not found.', 'NOT_FOUND')
    const merged = { ...existing, ...updates }
    if (merged.end_min <= merged.start_min)
      throw new ApiError(400, 'End time must be after start time.', 'VALIDATION_ERROR')
    const keys = Object.keys(updates)
    const values = keys.map((key) => updates[key])
    const assignments = keys.map((key, index) => key + '=$' + (index + 1))
    values.push(id, userId)
    const row = (
      await client.query(
        'UPDATE schedule_blocks SET ' +
          assignments.join(',') +
          ',updated_at=NOW() WHERE id=$' +
          (values.length - 1) +
          ' AND user_id=$' +
          values.length +
          ' RETURNING *',
        values,
      )
    ).rows[0]
    return block(row)
  })
}

export async function deleteScheduleBlock(userId, id, client = { query }) {
  const { rows } = await client.query(
    'DELETE FROM schedule_blocks WHERE id=$1 AND user_id=$2 RETURNING id',
    [positiveId(id), userId],
  )
  if (!rows.length) throw new ApiError(404, 'Schedule block not found.', 'NOT_FOUND')
  return { ok: true }
}
