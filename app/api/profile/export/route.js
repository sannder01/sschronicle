import { api } from '@/lib/api'
import { transaction } from '@/lib/db'
export const dynamic = 'force-dynamic'
export const GET = api(async (req, context, { user }) => {
  const data = await transaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const profile = (await client.query('SELECT id,email,name,image,google_image,avatar_id,settings,created_at FROM users WHERE id=$1',[user.id])).rows[0]
    const result = {format:'chronicle-export',version:1,exported_at:new Date().toISOString(),profile}
    for (const table of ['tasks','folders','notes','habits','habit_logs','challenges','challenge_attempts','challenge_entries']) {
      result[table] = (await client.query('SELECT * FROM '+table+' WHERE user_id=$1 ORDER BY id',[user.id])).rows
    }
    result.telegram = (await client.query('SELECT reminders_1h,reminders_1d,created_at FROM tg_connections WHERE user_id=$1',[user.id])).rows[0] ?? null
    // Removed features remain exportable when historical tables exist.
    for (const table of ['fitness_meals','fitness_weight','fitness_water','fitness_config']) {
      if ((await client.query('SELECT to_regclass($1) AS name',[table])).rows[0].name) {
        result[table] = (await client.query('SELECT * FROM '+table+' WHERE user_id=$1',[user.id])).rows
      }
    }
    return result
  })
  return new Response(JSON.stringify(data,null,2),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="chronicle-data.json"','Cache-Control':'no-store, private'}})
})
