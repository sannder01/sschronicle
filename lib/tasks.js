import { query, transaction } from './db'
import { ApiError, assertOwnerFolder } from './api'
import { text, positiveId, oneOf, boolean, date, time } from './validation'

export function validateTask(body, partial = false) {
  const values = {}
  if (!partial || body.title !== undefined) values.title = text(body.title, { field: 'title', max: 500 })
  if (!partial || body.priority !== undefined) values.priority = oneOf(body.priority ?? 'medium', ['low','medium','high'], 'priority')
  if (!partial || body.due_date !== undefined) values.due_date = date(body.due_date, 'due_date')
  if (!partial || body.due_time !== undefined) values.due_time = time(body.due_time, 'due_time')
  if (!partial || body.folder_id !== undefined) values.folder_id = body.folder_id == null || body.folder_id === '' ? null : positiveId(body.folder_id, 'folder_id')
  if (body.completed !== undefined) {
    values.completed = boolean(body.completed, 'completed')
    values.status = values.completed ? 'done' : 'todo'
  }
  if (partial && !Object.keys(values).length) throw new ApiError(400, 'Nothing to update.')
  return values
}

export async function createTask(userId, body, source = 'web', suppliedClient) {
  const values = validateTask(body)
  const work = async client => {
    await assertOwnerFolder(userId, values.folder_id, 'task', client)
    if (values.due_time && !values.due_date) throw new ApiError(400, 'A time requires a due date.')
    const { rows } = await client.query(
      'INSERT INTO tasks(user_id,title,due_date,due_time,priority,folder_id,source,completed,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [userId,values.title,values.due_date,values.due_time,values.priority,values.folder_id,source,values.completed ?? false,values.status ?? 'todo'])
    return rows[0]
  }
  return suppliedClient ? work(suppliedClient) : transaction(work)
}

export async function updateTask(userId, id, body, suppliedClient) {
  id = positiveId(id)
  const updates = validateTask(body, true)
  const work = async client => {
    const existing = (await client.query('SELECT * FROM tasks WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,userId])).rows[0]
    if (!existing) throw new ApiError(404, 'Task not found.', 'NOT_FOUND')
    if (updates.folder_id !== undefined) await assertOwnerFolder(userId, updates.folder_id, 'task', client)
    const merged = { ...existing,...updates }
    if (!merged.due_date) updates.due_time = null
    if (merged.due_time && !merged.due_date && body.due_time) throw new ApiError(400, 'A time requires a due date.')
    if ((updates.due_date !== undefined && updates.due_date !== existing.due_date) ||
        (updates.due_time !== undefined && updates.due_time !== existing.due_time)) {
      updates.notified_1h = false
      updates.notified_1d = false
    }
    const values = Object.values(updates)
    const assignments = Object.keys(updates).map((key,index) => key + '=$' + (index + 1))
    values.push(id,userId)
    const sql = 'UPDATE tasks SET ' + assignments.join(',') + ',updated_at=NOW() WHERE id=$' + (values.length-1) + ' AND user_id=$' + values.length + ' RETURNING *'
    return (await client.query(sql,values)).rows[0]
  }
  return suppliedClient ? work(suppliedClient) : transaction(work)
}

export async function deleteTask(userId, id, client = { query }) {
  const { rows } = await client.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2 RETURNING id',[positiveId(id),userId])
  if (!rows.length) throw new ApiError(404,'Task not found.','NOT_FOUND')
  return { ok:true }
}
