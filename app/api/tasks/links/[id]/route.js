import { api, json } from '@/lib/api'
import { deleteTaskLink } from '@/lib/task-board'

export const DELETE = api(async (req, { params }, { user }) =>
  json(await deleteTaskLink(user.id, params.id)),
)
