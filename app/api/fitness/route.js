// app/api/fitness/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { query } from '@/lib/db'

async function ensureTables() {
  await query(`CREATE TABLE IF NOT EXISTS fitness_meals (
    id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, date DATE NOT NULL DEFAULT CURRENT_DATE,
    meal_type TEXT DEFAULT 'lunch', name TEXT NOT NULL, calories INTEGER DEFAULT 0,
    protein NUMERIC(6,1) DEFAULT 0, fat NUMERIC(6,1) DEFAULT 0, carbs NUMERIC(6,1) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`).catch(()=>{})
  await query(`CREATE TABLE IF NOT EXISTS fitness_weight (
    id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, date DATE NOT NULL, weight NUMERIC(5,1) NOT NULL,
    UNIQUE(user_id, date)
  )`).catch(()=>{})
  await query(`CREATE TABLE IF NOT EXISTS fitness_water (
    id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, date DATE NOT NULL, water_ml INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
  )`).catch(()=>{})
  await query(`CREATE TABLE IF NOT EXISTS fitness_config (
    user_id TEXT PRIMARY KEY, calorie_goal INTEGER DEFAULT 2000, target_weight NUMERIC(5,1)
  )`).catch(()=>{})
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error:'Unauthorized' }, { status:401 })
  await ensureTables()
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().slice(0,10)
  const [m,w,wa] = await Promise.all([
    query('SELECT * FROM fitness_meals WHERE user_id=$1 AND date=$2 ORDER BY created_at ASC',[session.user.id,date]),
    query('SELECT weight FROM fitness_weight WHERE user_id=$1 AND date=$2',[session.user.id,date]),
    query('SELECT water_ml FROM fitness_water WHERE user_id=$1 AND date=$2',[session.user.id,date]),
  ])
  return Response.json({ meals:m.rows, weight:w.rows[0]?.weight||null, water_ml:wa.rows[0]?.water_ml||0 })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error:'Unauthorized' }, { status:401 })
  await ensureTables()
  const body = await req.json()
  const { type, date } = body
  const d = date || new Date().toISOString().slice(0,10)
  if (type === 'meal') {
    const { name, meal_type, calories, protein, fat, carbs } = body
    const r = await query(
      `INSERT INTO fitness_meals (user_id,date,meal_type,name,calories,protein,fat,carbs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [session.user.id,d,meal_type||'lunch',name,calories||0,protein||0,fat||0,carbs||0]
    )
    return Response.json(r.rows[0], { status:201 })
  }
  if (type === 'weight') {
    await query(
      `INSERT INTO fitness_weight (user_id,date,weight) VALUES ($1,$2,$3) ON CONFLICT (user_id,date) DO UPDATE SET weight=$3`,
      [session.user.id,d,body.weight]
    )
    return Response.json({ ok:true })
  }
  if (type === 'water') {
    await query(
      `INSERT INTO fitness_water (user_id,date,water_ml) VALUES ($1,$2,$3) ON CONFLICT (user_id,date) DO UPDATE SET water_ml=$3`,
      [session.user.id,d,body.water_ml]
    )
    return Response.json({ ok:true })
  }
  return Response.json({ error:'Unknown type' }, { status:400 })
}
