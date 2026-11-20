import { api, json, readJson } from '@/lib/api'
import { applySuggestion } from '@/lib/learning'
export const dynamic = 'force-dynamic'
export const POST = api(async (req, { params }, { user }) =>
  json(await applySuggestion(user.id, params.id, await readJson(req, 32768)), 201),
)
