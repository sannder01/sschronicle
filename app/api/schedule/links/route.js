import { api, json, readJson } from '@/lib/api'
import { createScheduleLink, listScheduleLinks } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export const GET = api(async (req, context, { user }) =>
  json(await listScheduleLinks(user.id, new URL(req.url).searchParams.get('day'))),
)

export const POST = api(async (req, context, { user }) => {
  const result = await createScheduleLink(user.id, await readJson(req, 8192))
  return json(result.link, result.status)
})
