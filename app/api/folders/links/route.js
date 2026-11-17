import { api, json, readJson } from '@/lib/api'
import { createFolderLink, listFolderLinks } from '@/lib/folder-tree'

export const dynamic = 'force-dynamic'

export const GET = api(async (req, context, { user }) => json(await listFolderLinks(user.id)))

export const POST = api(async (req, context, { user }) => {
  const result = await createFolderLink(user.id, await readJson(req, 8192))
  return json(result.link, result.status)
})
