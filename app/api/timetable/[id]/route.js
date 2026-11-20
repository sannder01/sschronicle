import { api, json, readJson } from '@/lib/api'
import { deleteTimetableEntry, updateTimetableEntry } from '@/lib/timetable'

export const dynamic = 'force-dynamic'

export const PATCH = api(async (req, { params }, { user }) =>
  json(await updateTimetableEntry(user.id, params.id, await readJson(req, 8192))),
)

export const DELETE = api(async (req, { params }, { user }) =>
  json(await deleteTimetableEntry(user.id, params.id)),
)
