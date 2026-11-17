import { api, json } from '@/lib/api'
import { deleteFolderLink } from '@/lib/folder-tree'

export const DELETE = api(async (req, { params }, { user }) =>
  json(await deleteFolderLink(user.id, params.id)),
)
