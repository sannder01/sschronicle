import { api, json, readJson } from '@/lib/api'
import { query } from '@/lib/db'
import { listMaps, createMap } from '@/lib/learning'
export const dynamic = 'force-dynamic'
export const GET = api(async (req, ctx, { user }) => json(await listMaps(user.id)))
export const POST = api(async (req, ctx, { user }) =>
  json(await createMap(user.id, await readJson(req, 8192)), 201),
)
