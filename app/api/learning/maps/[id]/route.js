import { api, json, readJson } from '@/lib/api'
import { transaction } from '@/lib/db'
import { id, ownerMap, getMap, patchMap } from '@/lib/learning'
export const dynamic = 'force-dynamic'
export const GET = api(async (req, { params }, { user }) => json(await getMap(user.id, params.id)))
export const PATCH = api(async (req, { params }, { user }) =>
  json(await patchMap(user.id, params.id, await readJson(req, 8192))),
)
export const DELETE = api(async (req, { params }, { user }) => {
  await transaction(async (client) => {
    await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id])
    await ownerMap(client, user.id, params.id, true)
    await client.query('DELETE FROM learning_maps WHERE id=$1 AND user_id=$2', [
      id(params.id),
      user.id,
    ])
  })
  return json({ ok: true })
})
