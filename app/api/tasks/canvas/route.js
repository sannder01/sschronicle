import { api, json, readJson } from '@/lib/api'
import { saveTaskCanvas } from '@/lib/task-board'

export const dynamic = 'force-dynamic'

export const PUT = api(async (req, context, { user }) => {
  const body = await readJson(req, 16384)
  return json(await saveTaskCanvas(user.id, body.positions))
})
