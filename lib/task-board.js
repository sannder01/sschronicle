import { query, transaction } from './db.js'
import { ApiError } from './api-error.js'
import { positiveId } from './validation.js'
import { validateCanvasPositions, validateScheduleLinkBody } from './schedule.js'

const MAX_TASK_LINKS = 500

export function validateTaskCanvasPositions(value) {
  return validateCanvasPositions(value, 200)
}

export function validateTaskLinkBody(body) {
  return validateScheduleLinkBody(body)
}

export async function saveTaskCanvas(userId, positions) {
  const validated = validateTaskCanvasPositions(positions)
  return transaction(async (client) => {
    const ids = [...new Set(validated.map(({ id }) => id))]
    const found = await client.query(
      'SELECT id FROM tasks WHERE user_id=$1 AND id=ANY($2::int[]) ORDER BY id FOR UPDATE',
      [userId, ids],
    )
    if (found.rows.length !== ids.length) throw new ApiError(404, 'Task not found.', 'NOT_FOUND')
    for (const position of validated)
      await client.query('UPDATE tasks SET canvas_x=$1,canvas_y=$2 WHERE id=$3 AND user_id=$4', [
        position.x,
        position.y,
        position.id,
        userId,
      ])
    return { ok: true }
  })
}

function taskLink(row) {
  return { id: Number(row.id), from_id: Number(row.from_id), to_id: Number(row.to_id) }
}

export async function listTaskLinks(userId) {
  const { rows } = await query(
    'SELECT l.id,l.from_id,l.to_id FROM task_links l JOIN tasks f ON f.id=l.from_id JOIN tasks t ON t.id=l.to_id WHERE l.user_id=$1 AND f.user_id=$1 AND t.user_id=$1 ORDER BY l.id',
    [userId],
  )
  return rows.map(taskLink)
}

export async function createTaskLink(userId, body) {
  const ids = validateTaskLinkBody(body)
  return transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [userId])
    const { rows: tasks } = await client.query(
      'SELECT id FROM tasks WHERE id=ANY($1::int[]) AND user_id=$2 ORDER BY id FOR UPDATE',
      [[ids.from_id, ids.to_id], userId],
    )
    if (tasks.length !== 2) throw new ApiError(404, 'Task not found.', 'NOT_FOUND')
    const existing = await client.query(
      'SELECT id,from_id,to_id FROM task_links WHERE user_id=$1 AND from_id=$2 AND to_id=$3',
      [userId, ids.from_id, ids.to_id],
    )
    if (existing.rows.length) return { status: 200, link: taskLink(existing.rows[0]) }
    const count = (
      await client.query('SELECT COUNT(*)::int AS count FROM task_links WHERE user_id=$1', [userId])
    ).rows[0].count
    if (count >= MAX_TASK_LINKS) throw new ApiError(400, 'A user can have at most 500 task links.')
    const created = await client.query(
      'INSERT INTO task_links(user_id,from_id,to_id) VALUES($1,$2,$3) RETURNING id,from_id,to_id',
      [userId, ids.from_id, ids.to_id],
    )
    return { status: 201, link: taskLink(created.rows[0]) }
  })
}

export async function deleteTaskLink(userId, id) {
  const { rows } = await query('DELETE FROM task_links WHERE id=$1 AND user_id=$2 RETURNING id', [
    positiveId(id),
    userId,
  ])
  if (!rows.length) throw new ApiError(404, 'Task link not found.', 'NOT_FOUND')
  return { ok: true }
}
