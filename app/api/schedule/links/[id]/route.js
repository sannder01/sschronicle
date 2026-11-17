import { api, json } from '@/lib/api'
import { deleteScheduleLink } from '@/lib/schedule'

export const DELETE = api(async (req, { params }, { user }) =>
  json(await deleteScheduleLink(user.id, params.id)),
)
