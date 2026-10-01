import { api, json, readJson } from '@/lib/api'
import { query } from '@/lib/db'
import { profileFor, validateProfile } from '@/lib/profile'
export const dynamic = 'force-dynamic'
export const GET = api(async (req, context, { user }) => json(await profileFor(user.id)))
export const PATCH = api(async (req, context, { user }) => {
  const updates = validateProfile(await readJson(req,8192))
  const fields = [], values = []
  for (const [key,value] of Object.entries(updates)) {
    values.push(key === 'settings' ? JSON.stringify(value) : value)
    fields.push(key === 'settings' ? 'settings=settings || $'+values.length+'::jsonb' : key+'=$'+values.length)
  }
  if (updates.avatar_id === null) fields.push('image=google_image')
  values.push(user.id)
  await query('UPDATE users SET '+fields.join(',')+' WHERE id=$'+values.length,values)
  return json(await profileFor(user.id))
})
