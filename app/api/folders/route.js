import { api, json, readJson } from '@/lib/api'
import { query } from '@/lib/db'
import { text, oneOf, hexColor } from '@/lib/validation'
export const dynamic = 'force-dynamic'
export const GET = api(async (req, context, { user }) => {
  const params = new URL(req.url).searchParams
  const type = oneOf(
    params.get('type') || params.get('entity_type') || 'task',
    ['task', 'note'],
    'type',
  )
  const { rows } = await query(
    'SELECT * FROM folders WHERE user_id=$1 AND entity_type=$2 ORDER BY created_at,id',
    [user.id, type],
  )
  return json(rows.map((row) => ({ ...row, icon: row.emoji })))
})
export const POST = api(async (req, context, { user }) => {
  const body = await readJson(req, 8192)
  const name = text(body.name, { field: 'name', max: 100 })
  const emoji = text(body.emoji ?? body.icon ?? '📁', { field: 'icon', max: 20 })
  const color = hexColor(body.color ?? '#007aff')
  const type = oneOf(body.entity_type ?? body.entityType ?? 'task', ['task', 'note'], 'entity_type')
  const { rows } = await query(
    'INSERT INTO folders(user_id,name,emoji,color,entity_type) VALUES($1,$2,$3,$4,$5) RETURNING *',
    [user.id, name, emoji, color, type],
  )
  return json({ ...rows[0], icon: rows[0].emoji }, 201)
})
