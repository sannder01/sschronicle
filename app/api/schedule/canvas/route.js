import { api, json, readJson } from '@/lib/api'
import { saveScheduleCanvas } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

export const PUT = api(async (req, context, { user }) => {
  const body = await readJson(req, 16384)
  return json(await saveScheduleCanvas(user.id, body.day, body.positions))
})
