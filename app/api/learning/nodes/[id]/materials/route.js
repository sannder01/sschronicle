import { api, json, readJson } from '@/lib/api'
import { transaction } from '@/lib/db'
import { id, ownerNode } from '@/lib/learning'
import { text, oneOf } from '@/lib/validation'
import { ApiError } from '@/lib/api-error.js'
export const dynamic = 'force-dynamic'
export const POST = api(async (req, { params }, { user }) => {
  const b = await readJson(req, 8192)
  const kind = oneOf(b.kind, ['note', 'link'], 'kind'),
    title = text(b.title, { field: 'title', max: 160 }),
    body = b.body === undefined ? '' : text(b.body, { field: 'body', max: 4000, min: 0 })
  let url = b.url ?? null
  if (kind === 'link') {
    if (typeof url !== 'string' || url.length > 2000 || !/^https?:\/\//i.test(url))
      throw new ApiError(400, 'Invalid url.', 'VALIDATION_ERROR')
  } else if (url !== null) throw new ApiError(400, 'Invalid url.', 'VALIDATION_ERROR')
  const row = await transaction(async (c) => {
    await c.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id])
    const n = await ownerNode(c, user.id, params.id)
    const count = Number(
      (await c.query('SELECT COUNT(*)::int AS n FROM learning_materials WHERE node_id=$1', [n.id]))
        .rows[0].n,
    )
    if (count >= 30) throw new ApiError(400, 'Material limit reached.', 'LIMIT_REACHED')
    return (
      await c.query(
        'INSERT INTO learning_materials(user_id,node_id,kind,title,url,body,position) VALUES($1,$2,$3,$4,$5,$6,COALESCE((SELECT MAX(position)+1 FROM learning_materials WHERE node_id=$2),0)) RETURNING *',
        [user.id, n.id, kind, title, url, body],
      )
    ).rows[0]
  })
  return json(row, 201)
})
