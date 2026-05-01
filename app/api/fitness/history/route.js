// app/api/fitness/history/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error:'Unauthorized' }, { status:401 })
  const { searchParams } = new URL(req.url)
  // Clamp days to a safe integer to prevent SQL injection via string interpolation
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30', 10) || 30, 1), 365)

  const [cal, wt] = await Promise.all([
    query(`
      SELECT date::text, SUM(calories) as calories
      FROM fitness_meals WHERE user_id=$1 AND date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
      GROUP BY date ORDER BY date ASC
    `, [session.user.id, days]).catch(()=>({rows:[]})),
    query(`
      SELECT date::text, weight FROM fitness_weight
      WHERE user_id=$1 AND date >= CURRENT_DATE - ($2 || ' days')::INTERVAL ORDER BY date ASC
    `, [session.user.id, days]).catch(()=>({rows:[]})),
  ])

  // Merge by date
  const map = {}
  cal.rows.forEach(r => { map[r.date] = { date: r.date, calories: Number(r.calories)||0 } })
  wt.rows.forEach(r => {
    if (!map[r.date]) map[r.date] = { date: r.date, calories: 0 }
    map[r.date].weight = Number(r.weight)
  })
  return Response.json(Object.values(map).sort((a,b)=>a.date.localeCompare(b.date)))
}
