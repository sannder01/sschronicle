import { api, json, readJson } from '@/lib/api'
import { updateScheduleBlock, deleteScheduleBlock } from '@/lib/schedule'

export const PATCH = api(async (req, { params }, { user }) =>
  json(await updateScheduleBlock(user.id, params.id, await readJson(req, 8192))),
)

export const DELETE = api(async (req, { params }, { user }) =>
  json(await deleteScheduleBlock(user.id, params.id)),
)
