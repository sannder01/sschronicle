import { query, transaction } from './db.js'
import { ApiError } from './api-error.js'
import { positiveId, date, text, oneOf, boolean } from './validation.js'

export const colors = [
  'accent',
  'blue',
  'indigo',
  'teal',
  'green',
  'orange',
  'red',
  'pink',
  'graphite',
]

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
  if (body.canvas_x !== undefined) values.canvas_x = canvasCoordinate(body.canvas_x, 'canvas_x')
  if (body.canvas_y !== undefined) values.canvas_y = canvasCoordinate(body.canvas_y, 'canvas_y')
  if (partial && !Object.keys(values).length) throw new ApiError(400, 'Nothing to update.')
  if (
    values.start_min !== undefined &&
    values.end_min !== undefined &&
    values.end_min <= values.start_min
  )
    throw new ApiError(400, 'End time must be after start time.', 'VALIDATION_ERROR')
  return values
}

export function canvasCoordinate(value, field = 'position') {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < -50000 || value > 50000)
    throw new ApiError(400, 'Invalid ' + field + '.', 'VALIDATION_ERROR')
  return value
}

export function validateCanvasPositions(value, maxPositions = 60) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxPositions)
    throw new ApiError(400, 'Invalid positions.', 'VALIDATION_ERROR')
  return value.map((position) => {
    if (!position || typeof position !== 'object' || Array.isArray(position))
      throw new ApiError(400, 'Invalid position.', 'VALIDATION_ERROR')
    return {
      id: positiveId(position.id),
      x:
        typeof position.x === 'number' ? canvasCoordinate(position.x, 'x') : invalidCoordinate('x'),
      y:
        typeof position.y === 'number' ? canvasCoordinate(position.y, 'y') : invalidCoordinate('y'),
    }
  })
}

function invalidCoordinate(field) {
  throw new ApiError(400, 'Invalid ' + field + '.', 'VALIDATION_ERROR')
}

export function validateScheduleLinkBody(body) {
  const first = positiveId(body?.from_id, 'from_id')
  const second = positiveId(body?.to_id, 'to_id')
  if (first === second) throw new ApiError(400, 'A block cannot be linked to itself.')
  return { from_id: Math.min(first, second), to_id: Math.max(first, second) }
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
    canvas_x: row.canvas_x == null ? null : Number(row.canvas_x),
    canvas_y: row.canvas_y == null ? null : Number(row.canvas_y),
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

export async function saveScheduleCanvas(userId, day, positions) {
  const parsedDay = date(day, 'day')
  if (!parsedDay) throw new ApiError(400, 'Invalid day.', 'VALIDATION_ERROR')
  const validated = validateCanvasPositions(positions)
  return transaction(async (client) => {
    const ids = [...new Set(validated.map(({ id }) => id))]
    const found = await client.query(
      'SELECT id FROM schedule_blocks WHERE user_id=$1 AND day=$2 AND id=ANY($3::int[])',
      [userId, parsedDay, ids],
    )
    if (found.rows.length !== ids.length)
      throw new ApiError(404, 'Schedule block not found.', 'NOT_FOUND')
    for (const position of validated)
      await client.query(
        'UPDATE schedule_blocks SET canvas_x=$1,canvas_y=$2 WHERE id=$3 AND user_id=$4 AND day=$5',
        [position.x, position.y, position.id, userId, parsedDay],
      )
    return { ok: true }
  })
}

function link(row) {
  return { id: Number(row.id), from_id: Number(row.from_id), to_id: Number(row.to_id) }
}

export async function listScheduleLinks(userId, day) {
  const parsedDay = date(day, 'day')
  if (!parsedDay) throw new ApiError(400, 'Invalid day.', 'VALIDATION_ERROR')
  const { rows } = await query(
    'SELECT l.id,l.from_id,l.to_id FROM schedule_links l JOIN schedule_blocks f ON f.id=l.from_id JOIN schedule_blocks t ON t.id=l.to_id WHERE l.user_id=$1 AND f.user_id=$1 AND t.user_id=$1 AND f.day=$2 AND t.day=$2 ORDER BY l.id',
    [userId, parsedDay],
  )
  return rows.map(link)
}

export async function createScheduleLink(userId, body) {
  const ids = validateScheduleLinkBody(body)
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const { rows: blocks } = await client.query(
      'SELECT id,day FROM schedule_blocks WHERE id=ANY($1::int[]) AND user_id=$2 ORDER BY id FOR UPDATE',
      [[ids.from_id, ids.to_id], userId],
    )
    if (blocks.length !== 2) throw new ApiError(404, 'Schedule block not found.', 'NOT_FOUND')
    if (String(blocks[0].day).slice(0, 10) !== String(blocks[1].day).slice(0, 10))
      throw new ApiError(400, 'Blocks must be on the same day.', 'VALIDATION_ERROR')
    const existing = await client.query(
      'SELECT id,from_id,to_id FROM schedule_links WHERE user_id=$1 AND from_id=$2 AND to_id=$3',
      [userId, ids.from_id, ids.to_id],
    )
    if (existing.rows.length) return { status: 200, link: link(existing.rows[0]) }
    const count = (
      await client.query(
        'SELECT COUNT(*)::int AS count FROM schedule_links l JOIN schedule_blocks f ON f.id=l.from_id JOIN schedule_blocks t ON t.id=l.to_id WHERE l.user_id=$1 AND f.day=$2 AND t.day=$2',
        [userId, blocks[0].day],
      )
    ).rows[0].count
    if (count >= 200) throw new ApiError(400, 'A day can have at most 200 schedule links.')
    const created = await client.query(
      'INSERT INTO schedule_links(user_id,from_id,to_id) VALUES($1,$2,$3) RETURNING id,from_id,to_id',
      [userId, ids.from_id, ids.to_id],
    )
    return { status: 201, link: link(created.rows[0]) }
  })
}

export async function deleteScheduleLink(userId, id) {
  const { rows } = await query(
    'DELETE FROM schedule_links WHERE id=$1 AND user_id=$2 RETURNING id',
    [positiveId(id), userId],
  )
  if (!rows.length) throw new ApiError(404, 'Schedule link not found.', 'NOT_FOUND')
  return { ok: true }
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
    if (updates.day !== undefined && String(existing.day).slice(0, 10) !== updates.day)
      await client.query('DELETE FROM schedule_links WHERE from_id=$1 OR to_id=$1', [id])
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
