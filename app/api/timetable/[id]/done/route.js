import { api, json, readJson } from '@/lib/api'
import { setDone } from '@/lib/timetable'

export const dynamic = 'force-dynamic'

export const PUT = api(async (req, { params }, { user }) =>
  json(await setDone(user.id, params.id, await readJson(req, 2048))),
)
