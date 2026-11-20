import { api, json, readJson } from '@/lib/api'
import { transaction } from '@/lib/db'
import { id, ownerNode, patchNode } from '@/lib/learning'
export const dynamic = 'force-dynamic'
export const PATCH = api(async (req, { params }, { user }) =>
  json(await patchNode(user.id, params.id, await readJson(req, 8192))),
)
export const DELETE = api(async (req, { params }, { user }) => {
  await transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id])
    const node = await ownerNode(client, user.id, params.id, true)
    await client.query('UPDATE learning_nodes SET parent_id=$1 WHERE parent_id=$2 AND map_id=$3', [
      node.parent_id,
      node.id,
      node.map_id,
    ])
    await client.query('DELETE FROM learning_nodes WHERE id=$1 AND user_id=$2', [
      id(params.id),
      user.id,
    ])
  })
  return json({ ok: true })
})
