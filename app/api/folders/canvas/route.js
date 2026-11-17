import { api, json, readJson } from '@/lib/api'
import { saveFolderCanvas } from '@/lib/folder-tree'

export const dynamic = 'force-dynamic'

export const PUT = api(async (req, context, { user }) => {
  const body = await readJson(req, 16384)
  return json(await saveFolderCanvas(user.id, body.positions))
})
