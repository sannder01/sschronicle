import { api, json, ApiError } from '@/lib/api'
import { transaction } from '@/lib/db'
import { secretMatches, sendTelegramMessage } from '@/lib/telegram'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export const GET = api(async req => {
  if (!process.env.CRON_SECRET || !secretMatches(req.headers.get('authorization'),'Bearer '+process.env.CRON_SECRET)) throw new ApiError(401,'Unauthorized.','UNAUTHORIZED')
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new ApiError(503,'Telegram is not configured.','TELEGRAM_UNAVAILABLE')
  const totals = {notified_1h:0,notified_1d:0,failed:0}
  const started = Date.now()
  const attempted = []
  // Commit each acknowledged delivery separately. A later failure must not
  // roll back flags for messages already delivered earlier in this invocation.
  for (const kind of ['1h','1d']) {
    for (let index=0; index<20 && Date.now()-started<45000; index++) {
      const found = await transaction(async client => {
        const flag = kind === '1h' ? 'notified_1h' : 'notified_1d'
        const pref = kind === '1h' ? 'reminders_1h' : 'reminders_1d'
        const interval = kind === '1h' ? '1 hour' : '24 hours'
        const minimum = kind === '1h' ? "NOW()" : "NOW()+INTERVAL '1 hour'"
        const sql = "SELECT t.*,tc.chat_id,u.settings->>'language' AS language,COALESCE(u.settings->>'timezone','UTC') AS timezone FROM tasks t JOIN users u ON u.id=t.user_id JOIN tg_connections tc ON tc.user_id=t.user_id CROSS JOIN LATERAL (SELECT (t.due_date+CASE WHEN t.due_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN t.due_time::time ELSE TIME '09:00' END) AT TIME ZONE COALESCE(u.settings->>'timezone','UTC') AS deadline) d WHERE NOT t.completed AND t.due_date IS NOT NULL AND NOT COALESCE(t."+flag+",FALSE) AND tc."+pref+" AND d.deadline>"+minimum+" AND d.deadline<=NOW()+INTERVAL '"+interval+"' AND NOT(t.id=ANY($1::int[])) ORDER BY d.deadline LIMIT 1 FOR UPDATE OF t SKIP LOCKED"
        const {rows} = await client.query(sql,[attempted])
        const task = rows[0]
        if (!task) return false
        attempted.push(task.id)
        const en = task.language === 'en'
        const heading = kind === '1h' ? (en?'Due within one hour':'Срок в течение часа') : (en?'Due within 24 hours':'Срок в течение 24 часов')
        const text = heading+'\n\n'+task.title+'\n'+task.due_date+' '+(task.due_time || '09:00')+' ('+task.timezone+')\n'+(process.env.NEXTAUTH_URL || '')+'/app/tasks'
        try {
          await sendTelegramMessage(task.chat_id,text)
        } catch (error) {
          console.error('[Telegram reminder]',error.name)
          totals.failed++
          return true
        }
        await client.query('UPDATE tasks SET '+flag+'=TRUE WHERE id=$1',[task.id])
        totals[flag]++
        return true
      })
      if (!found) break
    }
  }
  return json({ok:true,...totals})
},{auth:false,csrf:false})
