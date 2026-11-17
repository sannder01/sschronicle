import { api, json, readJson } from '@/lib/api'
import { query, transaction } from '@/lib/db'
import { text, oneOf, hexColor } from '@/lib/validation'
import { validateFolderParent } from '@/lib/folder-tree'
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
  const row = await transaction(async (client) => {
    // Only task folders nest; note folders stay flat.
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id])
    const parent =
      type === 'task' ? await validateFolderParent(client, user.id, body.parent_id) : null
    const { rows } = await client.query(
      'INSERT INTO folders(user_id,name,emoji,color,entity_type,parent_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [user.id, name, emoji, color, type, parent],
    )
    return rows[0]
  })
  return json({ ...row, icon: row.emoji }, 201)
})
