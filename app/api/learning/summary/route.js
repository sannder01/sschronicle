import { api, json } from '@/lib/api'
import { learningSummary } from '@/lib/learning'
export const dynamic = 'force-dynamic'
export const GET = api(async (req, ctx, { user }) => json(await learningSummary(user.id)))
