// app/api/tg-webhook/route.js
// ╔═══════════════════════════════════════════════════════════════════╗
// ║  CHRONICLE — Telegram → Web webhook receiver                      ║
// ║  Bot calls this endpoint when tasks are created/updated/deleted   ║
// ╚═══════════════════════════════════════════════════════════════════╝

import { query } from '@/lib/db'
import { NextResponse } from 'next/server'

// Secret shared between bot .env and web .env.local
const WEBHOOK_SECRET = process.env.TG_WEBHOOK_SECRET || ''

// ── Verify the secret header sent by the bot
function isAuthorized(req) {
  if (!WEBHOOK_SECRET) return false
  const header = req.headers.get('x-webhook-secret') || ''
  return header === WEBHOOK_SECRET
}

// ── POST /api/tg-webhook
export async function POST(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, chat_id, task } = body

  // ── Resolve user from tg_connections table
  const connResult = await query(
    'SELECT user_id FROM tg_connections WHERE chat_id = $1',
    [String(chat_id)]
  )
  if (!connResult.rows.length) {
    return NextResponse.json({ error: 'Unknown chat_id — user not linked' }, { status: 404 })
  }
  const userId = connResult.rows[0].user_id

  switch (action) {

    // ── Bot created a new task ──────────────────────────────────────
    case 'task_created': {
      const { title, due_date, priority } = task || {}
      if (!title?.trim()) return NextResponse.json({ error: 'title required' }, { status: 400 })

      const res = await query(
        `INSERT INTO tasks (user_id, title, due_date, priority, completed, source)
         VALUES ($1, $2, $3, $4, false, 'telegram') RETURNING *`,
        [
          userId,
          title.trim(),
          due_date || null,
          priority || 'medium',
        ]
      )
      return NextResponse.json({ ok: true, task: res.rows[0] }, { status: 201 })
    }

    // ── Bot updated a task ─────────────────────────────────────────
    case 'task_updated': {
      const { id, title, due_date, priority, completed } = task || {}
      if (!id) return NextResponse.json({ error: 'task id required' }, { status: 400 })

      // Build dynamic UPDATE so only provided fields change
      const fields = []
      const vals   = []
      let idx = 1

      if (title     !== undefined) { fields.push(`title = $${idx++}`);     vals.push(title.trim()) }
      if (due_date  !== undefined) { fields.push(`due_date = $${idx++}`);  vals.push(due_date || null) }
      if (priority  !== undefined) { fields.push(`priority = $${idx++}`);  vals.push(priority) }
      if (completed !== undefined) { fields.push(`completed = $${idx++}`); vals.push(completed) }

      if (!fields.length) return NextResponse.json({ ok: true, note: 'nothing to update' })

      fields.push(`updated_at = NOW()`)
      vals.push(id, userId)

      const res = await query(
        `UPDATE tasks SET ${fields.join(', ')}
         WHERE id = $${idx} AND user_id = $${idx + 1}
         RETURNING *`,
        vals
      )
      if (!res.rows.length) return NextResponse.json({ error: 'Task not found or not owned' }, { status: 404 })
      return NextResponse.json({ ok: true, task: res.rows[0] })
    }

    // ── Bot deleted a task ─────────────────────────────────────────
    case 'task_deleted': {
      const { id } = task || {}
      if (!id) return NextResponse.json({ error: 'task id required' }, { status: 400 })

      await query(
        'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
        [id, userId]
      )
      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  }
}
