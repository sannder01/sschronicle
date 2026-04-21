// app/api/tasks/[id]/route.js  — ПОЛНАЯ ЗАМЕНА
// Синхронизация с Telegram при изменении статуса задачи

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

// ── Notify Telegram on task status change
async function notifyTelegramCompleted(userId, task) {
  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
    if (!BOT_TOKEN) return

    const conn = await query('SELECT chat_id FROM tg_connections WHERE user_id = $1', [userId])
    const chatId = conn.rows[0]?.chat_id
    if (!chatId) return

    if (!task.completed) return // Only notify on completion

    const text = `✅ *Задача выполнена!*\n\n📋 ${task.title}\n+${task.priority === 'high' ? 50 : task.priority === 'medium' ? 25 : 10} XP`

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    })
  } catch {}
}

export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const updates = await req.json()

  const allowed = ['completed', 'title', 'due_date', 'priority', 'folder_id']
  const fields = []
  const vals = []
  let idx = 1

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = $${idx++}`)
      vals.push(updates[key])
    }
  }

  if (!fields.length) return Response.json({ error: 'Nothing to update' }, { status: 400 })

  // updated_at column does not exist in schema — removed
  vals.push(id, session.user.id)

  const result = await query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING *`,
    vals
  )

  if (!result.rows.length) return Response.json({ error: 'Not found' }, { status: 404 })
  const updated = result.rows[0]

  // Fire-and-forget notify
  notifyTelegramCompleted(session.user.id, updated)

  return Response.json(updated)
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  await query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [id, session.user.id])
  return Response.json({ ok: true })
}
