import { api, json, readJson } from '@/lib/api'
import { createTaskLink, listTaskLinks } from '@/lib/task-board'

export const dynamic = 'force-dynamic'

export const GET = api(async (req, context, { user }) => json(await listTaskLinks(user.id)))

export const POST = api(async (req, context, { user }) => {
  const result = await createTaskLink(user.id, await readJson(req, 8192))
  return json(result.link, result.status)
})
