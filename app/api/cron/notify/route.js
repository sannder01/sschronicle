import { query } from '@/lib/db'

// This route is called by Vercel Cron every hour
// Vercel.json config: {"crons": [{"path": "/api/cron/notify", "schedule": "0 * * * *"}]}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

async function sendTgMessage(chatId, text) {
  if (!BOT_TOKEN) return
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })
}

export async function GET(req) {
  // Verify cron secret to prevent abuse
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const now = new Date()

    // Find tasks due in ~1 hour (between 50 and 70 minutes from now)
    const oneHourSoon = await query(`
      SELECT t.*, u.email, tc.chat_id
      FROM tasks t
      JOIN users u ON t.user_id = u.id
      JOIN tg_connections tc ON tc.user_id = t.user_id
      WHERE t.completed = false
        AND t.due_date IS NOT NULL
        AND t.due_date > NOW() + INTERVAL '50 minutes'
        AND t.due_date < NOW() + INTERVAL '70 minutes'
        AND (t.notified_1h IS NULL OR t.notified_1h = false)
    `)

    for (const task of oneHourSoon.rows) {
      await sendTgMessage(task.chat_id,
        `⚠️ <b>Дедлайн через 1 час!</b>\n\n` +
        `📌 <b>${task.title}</b>\n` +
        `🕐 Срок: ${new Date(task.due_date).toLocaleString('ru-RU')}\n\n` +
        `🔗 <a href="${process.env.NEXTAUTH_URL}/app">Открыть Chronicle</a>`
      )
      await query(
        'UPDATE tasks SET notified_1h = true WHERE id = $1',
        [task.id]
      )
    }

    // Find tasks due in ~24 hours (between 23h and 25h from now)
    const oneDaySoon = await query(`
      SELECT t.*, u.email, tc.chat_id
      FROM tasks t
      JOIN users u ON t.user_id = u.id
      JOIN tg_connections tc ON tc.user_id = t.user_id
      WHERE t.completed = false
        AND t.due_date IS NOT NULL
        AND t.due_date > NOW() + INTERVAL '23 hours'
        AND t.due_date < NOW() + INTERVAL '25 hours'
        AND (t.notified_1d IS NULL OR t.notified_1d = false)
    `)

    for (const task of oneDaySoon.rows) {
      await sendTgMessage(task.chat_id,
        `🔶 <b>Дедлайн завтра!</b>\n\n` +
        `📌 <b>${task.title}</b>\n` +
        `📅 Срок: ${new Date(task.due_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}\n\n` +
        `🔗 <a href="${process.env.NEXTAUTH_URL}/app">Открыть Chronicle</a>`
      )
      await query(
        'UPDATE tasks SET notified_1d = true WHERE id = $1',
        [task.id]
      )
    }

    return Response.json({
      success: true,
      notified_1h: oneHourSoon.rows.length,
      notified_1d: oneDaySoon.rows.length,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    console.error('Cron notify error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
