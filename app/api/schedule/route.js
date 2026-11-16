import { api, json, readJson } from '@/lib/api'
import { createScheduleBlock, listSchedule } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export const GET = api(async (req, context, { user }) =>
  json(await listSchedule(user.id, new URL(req.url).searchParams.get('day'))),
)

export const POST = api(async (req, context, { user }) =>
  json(await createScheduleBlock(user.id, await readJson(req, 8192)), 201),
)
