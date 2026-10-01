import { api, json, readJson } from '@/lib/api'
import { query } from '@/lib/db'
import { createTask } from '@/lib/tasks'
export const dynamic = 'force-dynamic'
export const GET = api(async (req, context, { user }) => json((await query('SELECT * FROM tasks WHERE user_id=$1 ORDER BY created_at DESC,id DESC',[user.id])).rows))
export const POST = api(async (req, context, { user }) => json(await createTask(user.id,await readJson(req,8192)),201))
