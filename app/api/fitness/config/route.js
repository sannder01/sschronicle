// app/api/fitness/config/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error:'Unauthorized' }, { status:401 })
  const r = await query('SELECT * FROM fitness_config WHERE user_id=$1', [session.user.id]).catch(()=>({rows:[]}))
  return Response.json(r.rows[0] || { calorie_goal:2000, target_weight:null })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error:'Unauthorized' }, { status:401 })
  const { calorie_goal, target_weight } = await req.json()
  await query(`
    INSERT INTO fitness_config (user_id,calorie_goal,target_weight) VALUES ($1,$2,$3)
    ON CONFLICT (user_id) DO UPDATE SET calorie_goal=$2, target_weight=$3
  `, [session.user.id, calorie_goal||2000, target_weight||null]).catch(()=>{})
  return Response.json({ ok:true })
}
