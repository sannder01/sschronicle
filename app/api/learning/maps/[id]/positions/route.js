import { api, json, readJson } from '@/lib/api'
import { savePositions } from '@/lib/learning'
export const dynamic = 'force-dynamic'
export const PUT = api(async (req, { params }, { user }) =>
  json(await savePositions(user.id, params.id, (await readJson(req, 65536)).positions)),
)
