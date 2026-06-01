'use client'
// ╔══════════════════════════════════════════════════════════════════╗
// ║  CHRONICLE — WEIGHT LOSS PAGE                                    ║
// ║  Apple Health / Fitness+ style · Кольца · Графики · Статистика  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

// ── Utils ──────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10) }
function fmtDate(iso, lang = 'ru') {
  return new Date(iso + 'T00:00:00').toLocaleDateString(
    lang === 'en' ? 'en-US' : 'ru-RU',
    { day: '2-digit', month: 'short' }
  )
}
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── AI calorie lookup — calls server-side /api/ai/food ───────────
async function aiLookupFood(query, lang = 'ru') {
  const res = await fetch('/api/ai/food', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, lang }),
  })
  if (!res.ok) throw new Error('AI error')
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

// ── Data ───────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { key: 'breakfast', labelRu: 'Завтрак', labelEn: 'Breakfast', emoji: '◐' },
  { key: 'lunch',     labelRu: 'Обед',    labelEn: 'Lunch',     emoji: '◉' },
  { key: 'dinner',    labelRu: 'Ужин',    labelEn: 'Dinner',    emoji: '◑' },
  { key: 'snack',     labelRu: 'Перекус', labelEn: 'Snack',     emoji: '◇' },
]

const WORKOUT_TYPES = [
  { key: 'cardio',    labelRu: 'Кардио',    labelEn: 'Cardio',    emoji: '◎', calPerMin: 8  },
  { key: 'strength',  labelRu: 'Силовая',   labelEn: 'Strength',  emoji: '◈', calPerMin: 6  },
  { key: 'yoga',      labelRu: 'Йога',      labelEn: 'Yoga',      emoji: '◌', calPerMin: 3  },
  { key: 'walking',   labelRu: 'Ходьба',    labelEn: 'Walking',   emoji: '◷', calPerMin: 4  },
  { key: 'cycling',   labelRu: 'Велосипед', labelEn: 'Cycling',   emoji: '◶', calPerMin: 9  },
  { key: 'swimming',  labelRu: 'Плавание',  labelEn: 'Swimming',  emoji: '◵', calPerMin: 10 },
  { key: 'other',     labelRu: 'Другое',    labelEn: 'Other',     emoji: '◻', calPerMin: 5  },
]

const QUICK_FOODS = [
  { name: 'Куриная грудка 100г', cal: 165, p: 31,  f: 3.6, c: 0   },
  { name: 'Овсянка 100г',        cal: 371, p: 13,  f: 7,   c: 67  },
  { name: 'Яйцо варёное',        cal: 78,  p: 6,   f: 5,   c: 0.6 },
  { name: 'Рис варёный 100г',    cal: 130, p: 2.7, f: 0.3, c: 28  },
  { name: 'Банан',               cal: 89,  p: 1.1, f: 0.3, c: 23  },
  { name: 'Творог 5% 100г',      cal: 121, p: 17,  f: 5,   c: 3   },
  { name: 'Гречка варёная 100г', cal: 92,  p: 3.4, f: 0.6, c: 20  },
  { name: 'Лосось 100г',         cal: 208, p: 20,  f: 13,  c: 0   },
  { name: 'Греческий йогурт',    cal: 59,  p: 10,  f: 0.4, c: 3.6 },
  { name: 'Авокадо',             cal: 160, p: 2,   f: 15,  c: 9   },
]

const MOTIVATIONAL = [
  'Каждый день — шаг вперёд. Даже маленький шаг считается.',
  'Дисциплина — это мост между целью и достижением.',
  'Ты не проигрываешь, если не сдаёшься.',
  'Тело достигает того, во что верит разум.',
  'Прогресс, а не совершенство.',
  'Один день за раз. Одна тренировка за раз.',
  'Ты сильнее, чем думаешь.',
  'Изменения начинаются там, где заканчивается комфорт.',
  'Стань лучшей версией себя — не чьей-то копией.',
  'Результат приходит к тем, кто не останавливается.',
]

const MOTIVATIONAL_EN = [
  'Every day is a step forward. Even a small step counts.',
  'Discipline is the bridge between goals and achievement.',
  "You are not losing if you don't give up.",
  'The body achieves what the mind believes.',
  'Progress, not perfection.',
  'One day at a time. One workout at a time.',
  'You are stronger than you think.',
  'Change begins where comfort ends.',
  'Become the best version of yourself — not a copy of someone else.',
  "Results come to those who don't stop.",
]

// ── Portal ─────────────────────────────────────────────────────────
function Portal({ children }) {
  const [m, setM] = useState(false)
  useEffect(() => { setM(true) }, [])
  if (!m) return null
  return createPortal(children, document.body)
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ACTIVITY RING                                                   ║
// ╚══════════════════════════════════════════════════════════════════╝
function ActivityRing({ value, max, color, label, unit, size = 90, strokeWidth = 9 }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const dashArr = `${pct * circ} ${circ}`
  const cx = size / 2
  const cy = size / 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={color} strokeWidth={strokeWidth + 2} opacity={0.06} />
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={`${color}22`} strokeWidth={strokeWidth} />
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={dashArr}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)' }}
          />
          {pct > 0.02 && (
            <circle
              cx={cx + r * Math.cos((pct * 2 * Math.PI) - Math.PI / 2)}
              cy={cy + r * Math.sin((pct * 2 * Math.PI) - Math.PI / 2)}
              r={strokeWidth / 2}
              fill={color}
              style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            />
          )}
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: size > 80 ? 16 : 13,
            fontWeight: 800,
            color: '#fff',
            fontFamily: 'var(--font-display)',
            lineHeight: 1,
          }}>
            {Math.round(value)}
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{unit}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.3 }}>
        {label}
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  WEIGHT CHART                                                    ║
// ╚══════════════════════════════════════════════════════════════════╝
function WeightChart({ history, targetWeight, lang = 'ru' }) {
  const width = 340
  const height = 100
  const pad = { top: 16, bottom: 24, left: 6, right: 6 }

  const pts = history
    .filter(h => h.weight)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)

  if (pts.length < 2) {
    return (
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '28px 0', fontSize: 13 }}>
        {lang === 'en' ? 'Add at least 2 weight measurements for a chart' : 'Добавь хотя бы 2 измерения веса для графика'}
      </div>
    )
  }

  const weights = pts.map(p => p.weight)
  let minW = Math.min(...weights) - 0.5
  let maxW = Math.max(...weights) + 0.5
  if (targetWeight) {
    minW = Math.min(minW, targetWeight - 0.5)
    maxW = Math.max(maxW, targetWeight + 0.5)
  }
  const rangeW = maxW - minW || 1

  const toX = i => pad.left + (i / (pts.length - 1)) * (width - pad.left - pad.right)
  const toY = w => pad.top + (1 - (w - minW) / rangeW) * (height - pad.top - pad.bottom)

  const linePts = pts.map((p, i) => `${toX(i)},${toY(p.weight)}`).join(' ')
  const areaPath =
    `M${toX(0)},${toY(pts[0].weight)} ` +
    pts.slice(1).map((p, i) => `L${toX(i + 1)},${toY(p.weight)}`).join(' ') +
    ` L${toX(pts.length - 1)},${height - pad.bottom} L${toX(0)},${height - pad.bottom} Z`

  const first = pts[0].weight
  const last  = pts[pts.length - 1].weight
  const diff  = (last - first).toFixed(1)
  const gradId = 'wlp-grad'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {fmtDate(pts[0].date, lang)} → {fmtDate(pts[pts.length - 1].date, lang)}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)',
          background: 'rgba(255,255,255,0.08)', borderRadius: 8,
          padding: '3px 10px', border: '1px solid rgba(255,255,255,0.15)',
        }}>
          {diff > 0 ? `+${diff}` : diff} кг
        </div>
      </div>

      <div style={{ overflow: 'hidden', borderRadius: 8 }}>
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', overflow: 'hidden' }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255)" stopOpacity="0.1" />
              <stop offset="100%" stopColor="rgba(255,255,255)" stopOpacity="0.01" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f}
              x1={pad.left} y1={pad.top + f * (height - pad.top - pad.bottom)}
              x2={width - pad.right} y2={pad.top + f * (height - pad.top - pad.bottom)}
              stroke="rgba(255,255,255,0.05)" strokeWidth={1}
            />
          ))}
          {targetWeight && targetWeight >= minW && targetWeight <= maxW && (
            <>
              <line
                x1={pad.left} y1={toY(targetWeight)}
                x2={width - pad.right} y2={toY(targetWeight)}
                stroke="rgba(255,255,255,0.6)" strokeWidth={1} strokeDasharray="4 3" opacity={0.6}
              />
              <text x={width - pad.right - 2} y={toY(targetWeight) - 4}
                fill="rgba(255,255,255,0.6)" fontSize={9} textAnchor="end" opacity={0.8}>
                {lang === 'en' ? `goal ${targetWeight}` : `цель ${targetWeight}`}
              </text>
            </>
          )}
          <path d={areaPath} fill={`url(#${gradId})`} />
          <polyline
            points={linePts}
            fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2}
            strokeLinejoin="round" strokeLinecap="round"
            style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' }}
          />
          <circle
            cx={toX(pts.length - 1)} cy={toY(last)}
            r={4} fill="rgba(255,255,255,0.7)"
            style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.5))' }}
          />
          <text x={toX(pts.length - 1)} y={toY(last) - 8}
            fill="#fff" fontSize={10} fontWeight={700} textAnchor="middle">
            {last}
          </text>
          <text x={toX(0)} y={height} fill="rgba(255,255,255,0.3)" fontSize={9} textAnchor="start">
            {fmtDate(pts[0].date, lang)}
          </text>
          <text x={toX(pts.length - 1)} y={height} fill="rgba(255,255,255,0.3)" fontSize={9} textAnchor="end">
            {fmtDate(pts[pts.length - 1].date, lang)}
          </text>
        </svg>
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  WEEKLY STATS BAR CHART                                         ║
// ╚══════════════════════════════════════════════════════════════════╝
function WeeklyStats({ history, calorieGoal, lang = 'ru' }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })

  const dayLabels = lang === 'en'
    ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
    : ['Вс','Пн','Вт','Ср','Чт','Пт','Сб']

  const data = days.map(date => {
    const entry = history.find(h => h.date === date) || {}
    return {
      date,
      cal: entry.total_calories || 0,
      weight: entry.weight || null,
      workoutMin: entry.workout_minutes || 0,
      label: dayLabels[new Date(date + 'T00:00:00').getDay()],
      isToday: date === todayISO(),
    }
  })

  const maxCal = Math.max(...data.map(d => d.cal), calorieGoal, 1)
  const avgCal = Math.round(data.filter(d => d.cal > 0).reduce((s, d) => s + d.cal, 0) / (data.filter(d => d.cal > 0).length || 1))
  const totalWorkout = data.reduce((s, d) => s + d.workoutMin, 0)
  const daysLogged = data.filter(d => d.cal > 0).length

  const bdr = 'rgba(255,255,255,0.08)'
  const sub = 'rgba(255,255,255,0.4)'

  return (
    <div>
      {/* Summary row */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 16 }}>
        {[
          { v: avgCal,        u: lang === 'en' ? 'avg kcal' : 'ср. ккал' },
          { v: daysLogged,    u: lang === 'en' ? 'days logged' : 'дней записей' },
          { v: totalWorkout,  u: lang === 'en' ? 'min active' : 'мин актив.' },
        ].map((item, i) => (
          <div key={i} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
              {item.v}
            </div>
            <div style={{ fontSize: 10, color: sub, marginTop: 3 }}>{item.u}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {data.map((d, i) => {
          const pct = d.cal > 0 ? Math.min(d.cal / maxCal, 1) : 0
          const overGoal = d.cal > calorieGoal
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
              <div style={{
                width: '100%',
                height: `${Math.max(pct * 64, d.cal > 0 ? 4 : 0)}px`,
                borderRadius: '4px 4px 2px 2px',
                background: d.isToday
                  ? '#ffffff'
                  : overGoal
                    ? 'rgba(255,255,255,0.35)'
                    : 'rgba(255,255,255,0.18)',
                transition: 'height 0.5s ease',
                position: 'relative',
              }}>
                {/* Goal line marker */}
                {calorieGoal > 0 && (
                  <div style={{
                    position: 'absolute',
                    bottom: `${(calorieGoal / maxCal) * 64 - (pct * 64)}px`,
                    left: 0, right: 0,
                    height: 1,
                    background: 'rgba(255,255,255,0.3)',
                    display: pct > 0 && Math.abs(d.cal - calorieGoal) / calorieGoal < 0.15 ? 'block' : 'none',
                  }} />
                )}
              </div>
              {/* Workout dot */}
              {d.workoutMin > 0 && (
                <div style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.6)',
                  flexShrink: 0,
                }} />
              )}
              <div style={{ fontSize: 9, color: d.isToday ? '#fff' : sub, fontWeight: d.isToday ? 700 : 400 }}>
                {d.label}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ fontSize: 10, color: sub, marginTop: 8, textAlign: 'center' }}>
        {lang === 'en' ? '• dot = workout logged' : '• точка = тренировка записана'}
      </div>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  SKELETON                                                        ║
// ╚══════════════════════════════════════════════════════════════════╝
function Skeleton({ height = 80, radius = 20, style = {} }) {
  return (
    <div style={{
      height,
      borderRadius: radius,
      background: 'rgba(255,255,255,0.05)',
      animation: 'wlp-pulse 1.6s ease-in-out infinite',
      ...style,
    }} />
  )
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  MAIN COMPONENT                                                  ║
// ╚══════════════════════════════════════════════════════════════════╝
export default function WeightLossPage({ lang = 'ru', tr = {}, session }) {
  // ── State ────────────────────────────────────────────────────────
  const [meals, setMeals]               = useState([])
  const [workouts, setWorkouts]         = useState([])
  const [weight, setWeight]             = useState(null)
  const [waterMl, setWaterMl]           = useState(0)
  const [calorieGoal, setCalorieGoal]   = useState(2000)
  const [proteinGoal, setProteinGoal]   = useState(150)
  const [targetWeight, setTargetWeight] = useState(null)
  const [history, setHistory]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [streak, setStreak]             = useState(0)
  const [activeTab, setActiveTab]       = useState('today') // 'today' | 'week' | 'workouts'

  const [showSheet, setShowSheet]             = useState(false)
  const [showWeightForm, setShowWeightForm]   = useState(false)
  const [showSettings, setShowSettings]       = useState(false)
  const [showWorkoutSheet, setShowWorkoutSheet] = useState(false)

  const [mealForm, setMealForm]         = useState({ name: '', meal_type: 'lunch', calories: '', protein: '', fat: '', carbs: '' })
  const [weightInput, setWeightInput]   = useState('')
  const [settingsForm, setSettingsForm] = useState({ calorie_goal: 2000, target_weight: '', protein_goal: 150 })
  const [quickSearch, setQuickSearch]   = useState('')
  const [sheetMounted, setSheetMounted] = useState(false)
  const [workoutSheetMounted, setWorkoutSheetMounted] = useState(false)

  // AI food search state
  const [aiQuery, setAiQuery]         = useState('')
  const [aiLoading, setAiLoading]     = useState(false)
  const [aiResult, setAiResult]       = useState(null)
  const [aiError, setAiError]         = useState('')

  // Workout form state
  const [workoutForm, setWorkoutForm] = useState({ type: 'cardio', duration: '', note: '' })

  const motArr = lang === 'en' ? MOTIVATIONAL_EN : MOTIVATIONAL
  const quote = useRef(motArr[Math.floor(Math.random() * motArr.length)]).current

  // ── Load ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const today = todayISO()
    try {
      const [dayData, hist, cfg] = await Promise.all([
        apiFetch(`/api/fitness?date=${today}`).catch(() => ({ meals: [], weight: null, water_ml: 0, workouts: [] })),
        apiFetch('/api/fitness/history?days=30').catch(() => []),
        apiFetch('/api/fitness/config').catch(() => ({ calorie_goal: 2000, target_weight: null })),
      ])
      setMeals(Array.isArray(dayData.meals) ? dayData.meals : [])
      setWorkouts(Array.isArray(dayData.workouts) ? dayData.workouts : [])
      setWeight(dayData.weight)
      setWaterMl(dayData.water_ml || 0)
      setHistory(hist)

      const goal  = cfg.calorie_goal || 2000
      const tgt   = cfg.target_weight ?? null
      const pGoal = cfg.protein_goal || 150
      setCalorieGoal(goal)
      setTargetWeight(tgt)
      setProteinGoal(pGoal)
      setSettingsForm({ calorie_goal: goal, target_weight: tgt ?? '', protein_goal: pGoal })

      const sorted = [...hist].filter(h => h.weight).sort((a, b) => b.date.localeCompare(a.date))
      let s = 0
      let cursor = new Date(today)
      for (const h of sorted) {
        const d = new Date(h.date + 'T00:00:00')
        const diff = Math.round((cursor - d) / 86400000)
        if (diff <= 1) { s++; cursor = d } else break
      }
      setStreak(s)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (showSheet) requestAnimationFrame(() => setSheetMounted(true))
    else setSheetMounted(false)
  }, [showSheet])

  useEffect(() => {
    if (showWorkoutSheet) requestAnimationFrame(() => setWorkoutSheetMounted(true))
    else setWorkoutSheetMounted(false)
  }, [showWorkoutSheet])

  // ── Derived ──────────────────────────────────────────────────────
  const today      = todayISO()
  const totalCal   = meals.reduce((s, m) => s + (Number(m.calories) || 0), 0)
  const totalP     = meals.reduce((s, m) => s + (Number(m.protein)  || 0), 0)
  const totalF     = meals.reduce((s, m) => s + (Number(m.fat)      || 0), 0)
  const totalC     = meals.reduce((s, m) => s + (Number(m.carbs)    || 0), 0)
  const totalWorkoutMin = workouts.reduce((s, w) => s + (Number(w.duration) || 0), 0)
  const totalWorkoutCal = workouts.reduce((s, w) => {
    const wt = WORKOUT_TYPES.find(t => t.key === w.type)
    return s + ((wt?.calPerMin || 5) * (Number(w.duration) || 0))
  }, 0)

  const lastWeight = history.filter(h => h.weight).sort((a, b) => b.date.localeCompare(a.date))[0]?.weight
  const currentW   = weight || lastWeight

  const weightProgress = (() => {
    if (!currentW || !targetWeight) return 0
    const wPts = history.filter(h => h.weight).sort((a, b) => a.date.localeCompare(b.date))
    const startW = wPts[0]?.weight
    if (!startW || startW === targetWeight) return 0
    const directed = (startW - currentW) / (startW - targetWeight)
    return Math.min(Math.max(directed * 100, 0), 100)
  })()

  const filteredQuick = quickSearch.length > 0
    ? QUICK_FOODS.filter(f => f.name.toLowerCase().includes(quickSearch.toLowerCase()))
    : QUICK_FOODS

  // ── Theme ─────────────────────────────────────────────────────────
  const bdr = 'rgba(255,255,255,0.08)'
  const sub = 'rgba(255,255,255,0.4)'
  const txt = '#ffffff'

  const card = {
    background: 'rgba(255,255,255,0.05)',
    border: `1px solid ${bdr}`,
    borderRadius: 20,
    padding: '18px',
    backdropFilter: 'blur(20px)',
  }

  const inp = (extra = {}) => ({
    background: 'rgba(255,255,255,0.06)',
    border: `1px solid ${bdr}`,
    borderRadius: 12,
    padding: '12px 14px',
    color: txt,
    fontSize: 14,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    ...extra,
  })

  const mealsByType = MEAL_TYPES.map(mt => ({
    ...mt,
    label: lang === 'en' ? mt.labelEn : mt.labelRu,
    items: meals.filter(m => m.meal_type === mt.key),
  }))

  // ── Actions ──────────────────────────────────────────────────────
  async function addMeal(e) {
    e.preventDefault()
    if (!mealForm.name.trim() || !mealForm.calories) return
    try {
      const created = await apiFetch('/api/fitness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'meal', date: today, ...mealForm,
          calories: Number(mealForm.calories),
          protein:  Number(mealForm.protein || 0),
          fat:      Number(mealForm.fat     || 0),
          carbs:    Number(mealForm.carbs   || 0),
        }),
      })
      setMeals(prev => [...prev, created])
      setMealForm({ name: '', meal_type: 'lunch', calories: '', protein: '', fat: '', carbs: '' })
      setAiResult(null)
      setAiQuery('')
      setShowSheet(false)
    } catch {}
  }

  async function deleteMeal(id) {
    setMeals(prev => prev.filter(m => m.id !== id))
    try { await fetch(`/api/fitness/${id}`, { method: 'DELETE' }) } catch {}
  }

  async function saveWeight() {
    const w = parseFloat(weightInput)
    if (!w || w <= 0 || w > 500) return
    setWeight(w)
    setShowWeightForm(false)
    setWeightInput('')
    try {
      await apiFetch('/api/fitness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'weight', date: today, weight: w }),
      })
      load()
    } catch {}
  }

  async function addWater(ml) {
    const nv = Math.max(0, waterMl + ml)
    setWaterMl(nv)
    try {
      await apiFetch('/api/fitness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'water', date: today, water_ml: nv }),
      })
    } catch {}
  }

  async function saveSettings(e) {
    e.preventDefault()
    const g  = Number(settingsForm.calorie_goal) || 2000
    const tg = settingsForm.target_weight !== '' ? Number(settingsForm.target_weight) : null
    const pg = Number(settingsForm.protein_goal) || 150
    setCalorieGoal(g); setTargetWeight(tg); setProteinGoal(pg)
    setShowSettings(false)
    try {
      await apiFetch('/api/fitness/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calorie_goal: g, target_weight: tg, protein_goal: pg }),
      })
    } catch { load() }
  }

  function fillQuick(food) {
    setMealForm(f => ({ ...f, name: food.name, calories: food.cal, protein: food.p, fat: food.f, carbs: food.c }))
    setAiResult(null)
    setQuickSearch('')
  }

  // ── AI food lookup ────────────────────────────────────────────────
  async function handleAiSearch(e) {
    e.preventDefault()
    if (!aiQuery.trim()) return
    setAiLoading(true)
    setAiError('')
    setAiResult(null)
    try {
      const result = await aiLookupFood(aiQuery.trim(), lang)
      setAiResult(result)
    } catch {
      setAiError(lang === 'en' ? 'Could not find this food. Try a different query.' : 'Не удалось найти. Попробуй другой запрос.')
    }
    setAiLoading(false)
  }

  function applyAiResult() {
    if (!aiResult) return
    setMealForm(f => ({
      ...f,
      name:     aiResult.name     || f.name,
      calories: aiResult.calories || f.calories,
      protein:  aiResult.protein  || f.protein,
      fat:      aiResult.fat      || f.fat,
      carbs:    aiResult.carbs    || f.carbs,
    }))
    setAiResult(null)
    setAiQuery('')
  }

  // ── Workout actions ───────────────────────────────────────────────
  async function addWorkout(e) {
    e.preventDefault()
    if (!workoutForm.duration || Number(workoutForm.duration) <= 0) return
    const wt = WORKOUT_TYPES.find(t => t.key === workoutForm.type)
    const burned = Math.round((wt?.calPerMin || 5) * Number(workoutForm.duration))
    const newWorkout = {
      id: Date.now(),
      type: workoutForm.type,
      duration: Number(workoutForm.duration),
      note: workoutForm.note,
      calories_burned: burned,
      date: today,
    }
    setWorkouts(prev => [...prev, newWorkout])
    setWorkoutForm({ type: 'cardio', duration: '', note: '' })
    setShowWorkoutSheet(false)
    try {
      await apiFetch('/api/fitness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'workout', date: today, ...newWorkout }),
      })
    } catch {}
  }

  async function deleteWorkout(id) {
    setWorkouts(prev => prev.filter(w => w.id !== id))
    try { await fetch(`/api/fitness/${id}`, { method: 'DELETE' }) } catch {}
  }

