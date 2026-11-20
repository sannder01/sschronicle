import { api, json, readJson } from '@/lib/api'
import { createTimetableEntries, listTimetable } from '@/lib/timetable'

export const dynamic = 'force-dynamic'

export const GET = api(async (req, context, { user }) => json(await listTimetable(user.id)))

export const POST = api(async (req, context, { user }) =>
  json(await createTimetableEntries(user.id, await readJson(req, 8192)), 201),
)
