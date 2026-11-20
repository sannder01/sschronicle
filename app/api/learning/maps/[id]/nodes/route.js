import { api, json, readJson } from '@/lib/api'
import { createNode } from '@/lib/learning'
export const dynamic = 'force-dynamic'
export const POST = api(async (req, { params }, { user }) =>
  json(await createNode(user.id, params.id, await readJson(req, 8192)), 201),
)
