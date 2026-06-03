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

// ── AI calorie lookup via Anthropic API ───────────────────────────
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


  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <>
      <style>{`
        @keyframes wlp-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes wlp-fadeup {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes wlp-spin {
          to { transform: rotate(360deg); }
        }
        .wlp-card-tap:active { transform: scale(0.97); }
        .wlp-tab-btn { transition: background 0.2s, color 0.2s; }
      `}</style>

      <div style={{ paddingBottom: 120, maxWidth: 600, margin: '0 auto', position: 'relative' }}>

        {/* ══ HEADER ══════════════════════════════════════════════════ */}
        <div style={{ padding: '20px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: txt }}>
              {tr.weightLossTitle || (lang === 'en' ? 'Weight Loss' : 'Похудение')}
            </div>
            <div style={{ color: sub, fontSize: 12, marginTop: 2 }}>
              {new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {streak > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, padding: '6px 12px',
              }}>
                <span style={{ fontSize: 14, color: '#FFD60A' }}>▲</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ffffff' }}>{streak}{lang === 'en' ? 'd' : 'д'}</span>
              </div>
            )}
            <button type="button"
              onClick={() => setShowSettings(true)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${bdr}`,
                borderRadius: 12, width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: sub, fontSize: 18, cursor: 'pointer',
              }}>≡</button>
          </div>
        </div>

        {/* ══ TABS ════════════════════════════════════════════════════ */}
        <div style={{ padding: '12px 16px 0', display: 'flex', gap: 6 }}>
          {[
            { key: 'today',    label: lang === 'en' ? 'Today'     : 'Сегодня'   },
            { key: 'week',     label: lang === 'en' ? 'Week'      : 'Неделя'    },
            { key: 'workouts', label: lang === 'en' ? 'Workouts'  : 'Тренировки'},
          ].map(tab => (
            <button key={tab.key} type="button"
              className="wlp-tab-btn"
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '7px 16px', borderRadius: 12,
                border: `1px solid ${activeTab === tab.key ? 'rgba(255,255,255,0.35)' : bdr}`,
                background: activeTab === tab.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeTab === tab.key ? '#fff' : sub,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={160} />
            <Skeleton height={120} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Skeleton height={100} /><Skeleton height={100} />
              <Skeleton height={100} /><Skeleton height={100} />
            </div>
            <Skeleton height={180} />
          </div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════
                TAB: TODAY
            ══════════════════════════════════════════════════════ */}
            {activeTab === 'today' && (
              <>
                {/* A. HERO */}
                <div style={{
                  margin: '16px 16px 12px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 24, padding: '20px',
                  animation: 'wlp-fadeup 0.4s ease',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, color: sub, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                        {tr.currentWeight || (lang === 'en' ? 'CURRENT WEIGHT' : 'ТЕКУЩИЙ ВЕС')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 800, color: txt, lineHeight: 1 }}>
                          {currentW ?? '—'}
                        </span>
                        <span style={{ fontSize: 16, color: sub }}>кг</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: sub, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                        {tr.goalLabel || (lang === 'en' ? 'GOAL' : 'ЦЕЛЬ')}
                      </div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: txt, lineHeight: 1 }}>
                        {targetWeight ?? '—'}
                        <span style={{ fontSize: 14, color: sub, fontWeight: 400 }}> кг</span>
                      </div>
                    </div>
                  </div>

                  {targetWeight && currentW ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: sub }}>
                          {tr.progressToGoal || (lang === 'en' ? 'Progress to goal' : 'Прогресс к цели')}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
                          {Math.round(weightProgress)}%
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 }}>
                        <div style={{
                          height: '100%', width: `${weightProgress}%`,
                          background: 'rgba(255,255,255,0.6)', borderRadius: 8,
                          transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                        }} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                        {currentW > targetWeight
                          ? (lang === 'en' ? `Remaining to lose: ${(currentW - targetWeight).toFixed(1)} kg` : `Осталось похудеть: ${(currentW - targetWeight).toFixed(1)} кг`)
                          : currentW < targetWeight
                            ? (lang === 'en' ? `Remaining to gain: ${(targetWeight - currentW).toFixed(1)} kg` : `Осталось набрать: ${(targetWeight - currentW).toFixed(1)} кг`)
                            : (lang === 'en' ? '★ Goal achieved!' : '★ Цель достигнута!')}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: sub }}>
                      {lang === 'en' ? 'Set a goal in settings ≡' : 'Установи цель в настройках ≡'}
                    </div>
                  )}

                  <button type="button" className="wlp-card-tap"
                    onClick={() => { setWeightInput(currentW ? String(currentW) : ''); setShowWeightForm(true) }}
                    style={{
                      marginTop: 14, width: '100%',
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 14, padding: '11px',
                      color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 14,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'transform 0.15s ease',
                    }}>
                    {lang === 'en' ? '⊙ Log today\'s weight' : '⊙ Записать вес сегодня'}
                  </button>
                </div>

                {/* B. ACTIVITY RINGS */}
                <div style={{ ...card, margin: '0 16px 12px', animation: 'wlp-fadeup 0.45s ease' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 16 }}>
                    {lang === 'en' ? 'Activity Rings' : 'Кольца активности'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 8 }}>
                    <ActivityRing value={totalCal} max={calorieGoal} color="rgba(255,255,255,0.8)"
                      label={lang === 'en' ? 'Calories' : 'Калории'} unit="ккал" />
                    <ActivityRing value={Math.round(totalP)} max={proteinGoal} color="rgba(255,255,255,0.8)"
                      label={lang === 'en' ? 'Protein' : 'Белок'} unit="г" />
                    <ActivityRing value={waterMl} max={2500} color="rgba(255,255,255,0.8)"
                      label={lang === 'en' ? 'Water' : 'Вода'} unit="мл" />
                    <ActivityRing value={totalWorkoutMin} max={60} color="rgba(255,255,255,0.8)"
                      label={lang === 'en' ? 'Active' : 'Актив.'} unit="мин" />
                  </div>
                  <div style={{
                    marginTop: 14, paddingTop: 14, borderTop: `1px solid ${bdr}`,
                    display: 'flex', justifyContent: 'space-around',
                  }}>
                    {[
                      { l: lang === 'en' ? 'Fats'      : 'Жиры',     v: Math.round(totalF),                       u: 'г'    },
                      { l: lang === 'en' ? 'Carbs'     : 'Углеводы', v: Math.round(totalC),                       u: 'г'    },
                      { l: lang === 'en' ? 'Remaining' : 'Осталось', v: Math.max(0, calorieGoal - totalCal),      u: 'ккал' },
                      { l: lang === 'en' ? 'Burned'    : 'Сожжено',  v: Math.round(totalWorkoutCal),              u: 'ккал' },
                    ].map(item => (
                      <div key={item.l} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-display)' }}>
                          {item.v}
                        </div>
                        <div style={{ fontSize: 9, color: sub, marginTop: 2 }}>{item.l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* C. 2×2 CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '0 16px 12px' }}>
                  {/* Calories */}
                  <div style={{ ...card, padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', animation: 'wlp-fadeup 0.5s ease' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>▲</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: txt, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{totalCal}</div>
                    <div style={{ fontSize: 10, color: sub, marginTop: 3 }}>{lang === 'en' ? `of ${calorieGoal} kcal` : `из ${calorieGoal} ккал`}</div>
                    <div style={{ marginTop: 8, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((totalCal / calorieGoal) * 100, 100)}%`, background: 'rgba(255,255,255,0.8)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>

                  {/* Water */}
                  <div style={{ ...card, padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', animation: 'wlp-fadeup 0.5s ease' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>▼</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: txt, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{waterMl}</div>
                    <div style={{ fontSize: 10, color: sub, marginTop: 3 }}>{lang === 'en' ? 'of 2500 ml' : 'из 2500 мл'}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                      {[200, 500].map(ml => (
                        <button key={ml} type="button" onClick={() => addWater(ml)}
                          style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '5px 0', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                          +{ml}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Weight */}
                  <button type="button" className="wlp-card-tap"
                    onClick={() => { setWeightInput(currentW ? String(currentW) : ''); setShowWeightForm(true) }}
                    style={{ ...card, padding: '16px', cursor: 'pointer', textAlign: 'left', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', animation: 'wlp-fadeup 0.55s ease', fontFamily: 'inherit', transition: 'transform 0.15s ease' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>⊙</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: txt, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{currentW ?? '—'}</div>
                    <div style={{ fontSize: 10, color: sub, marginTop: 3 }}>{lang === 'en' ? 'kg · tap to log' : 'кг · нажми для записи'}</div>
                    {targetWeight && currentW && (
                      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                        {currentW > targetWeight ? `−${(currentW - targetWeight).toFixed(1)} ${lang === 'en' ? 'to goal' : 'до цели'}` : `✓ ${lang === 'en' ? 'Goal!' : 'Цель!'}`}
                      </div>
                    )}
                  </button>

                  {/* Protein */}
                  <div style={{ ...card, padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', animation: 'wlp-fadeup 0.55s ease' }}>
                    <div style={{ fontSize: 20, marginBottom: 6 }}>◆</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: txt, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{Math.round(totalP)}</div>
                    <div style={{ fontSize: 10, color: sub, marginTop: 3 }}>{lang === 'en' ? `of ${proteinGoal}g protein` : `из ${proteinGoal} г белка`}</div>
                    <div style={{ marginTop: 8, height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((totalP / proteinGoal) * 100, 100)}%`, background: 'rgba(255,255,255,0.8)', borderRadius: 3, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                </div>

                {/* D. WEIGHT CHART */}
                <div style={{ ...card, margin: '0 16px 12px', animation: 'wlp-fadeup 0.6s ease' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 14 }}>
                    {lang === 'en' ? '↗ Weight Chart' : '↗ График веса'}
                  </div>
                  <WeightChart history={history} targetWeight={targetWeight} lang={lang} />
                </div>

                {/* E. MEAL FEED */}
                <div style={{ margin: '0 16px 12px' }}>
                  <div style={{ fontSize: 11, color: sub, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                    {lang === 'en' ? 'TODAY' : 'СЕГОДНЯ'}
                  </div>
                  {mealsByType.map(({ key, label, emoji, items }) => (
                    <div key={key} style={{ ...card, marginBottom: 8, animation: 'wlp-fadeup 0.65s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: items.length > 0 ? 10 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{emoji}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: txt }}>{label}</span>
                          {items.length > 0 && (
                            <span style={{ fontSize: 11, color: sub, background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '2px 7px', fontFamily: 'var(--font-mono)' }}>
                              {items.reduce((s, i) => s + (Number(i.calories) || 0), 0)} ккал
                            </span>
                          )}
                        </div>
                        <button type="button"
                          onClick={() => { setMealForm(f => ({ ...f, meal_type: key })); setShowSheet(true) }}
                          style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${bdr}`, borderRadius: 10, padding: '5px 12px', color: sub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {lang === 'en' ? '+ add' : '+ добавить'}
                        </button>
                      </div>
                      {items.map((item) => (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${bdr}` }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: txt, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                            {(Number(item.protein) + Number(item.fat) + Number(item.carbs)) > 0 && (
                              <div style={{ fontSize: 10, color: sub, marginTop: 2 }}>
                                <span>{lang === 'en' ? 'P' : 'Б'}{Math.round(item.protein || 0)}</span>
                                {' · '}
                                <span>{lang === 'en' ? 'F' : 'Ж'}{Math.round(item.fat || 0)}</span>
                                {' · '}
                                <span>{lang === 'en' ? 'C' : 'У'}{Math.round(item.carbs || 0)}</span>
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{item.calories} ккал</span>
                          <button type="button" onClick={() => deleteMeal(item.id)}
                            style={{ background: 'none', border: 'none', color: sub, cursor: 'pointer', fontSize: 14, padding: 4, flexShrink: 0, opacity: 0.5 }}>✕</button>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* MOTIVATION */}
                <div style={{ margin: '4px 16px 16px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${bdr}`, borderRadius: 16, padding: '16px 18px', animation: 'wlp-fadeup 0.7s ease' }}>
                  <div style={{ fontSize: 11, color: sub, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                    {lang === 'en' ? 'DAILY MOTIVATION' : 'МОТИВАЦИЯ ДНЯ'}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, fontStyle: 'italic' }}>
                    "{quote}"
                  </div>
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB: WEEK
            ══════════════════════════════════════════════════════ */}
            {activeTab === 'week' && (
              <>
                {/* Weekly stats card */}
                <div style={{ ...card, margin: '16px 16px 12px', animation: 'wlp-fadeup 0.4s ease' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 16 }}>
                    {lang === 'en' ? '◈ Weekly Overview' : '◈ Обзор недели'}
                  </div>
                  <WeeklyStats history={history} calorieGoal={calorieGoal} lang={lang} />
                </div>

                {/* Weight chart */}
                <div style={{ ...card, margin: '0 16px 12px', animation: 'wlp-fadeup 0.5s ease' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 14 }}>
                    {lang === 'en' ? '↗ Weight Trend' : '↗ Динамика веса'}
                  </div>
                  <WeightChart history={history} targetWeight={targetWeight} lang={lang} />
                </div>

                {/* 7-day macro summary */}
                <div style={{ ...card, margin: '0 16px 12px', animation: 'wlp-fadeup 0.55s ease' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 14 }}>
                    {lang === 'en' ? '◆ 7-Day Averages' : '◆ Среднее за 7 дней'}
                  </div>
                  {(() => {
                    const days7 = Array.from({ length: 7 }, (_, i) => {
                      const d = new Date(); d.setDate(d.getDate() - i)
                      return d.toISOString().slice(0, 10)
                    })
                    const entries = history.filter(h => days7.includes(h.date) && h.total_calories > 0)
                    const n = entries.length || 1
                    const avgCal  = Math.round(entries.reduce((s, e) => s + (e.total_calories || 0), 0) / n)
                    const avgProt = Math.round(entries.reduce((s, e) => s + (e.total_protein  || 0), 0) / n)
                    const avgWater= Math.round(entries.reduce((s, e) => s + (e.water_ml       || 0), 0) / n)
                    const calDiff = avgCal - calorieGoal
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { l: lang === 'en' ? 'Avg Calories'  : 'Ср. калории',  v: avgCal,   u: 'ккал', note: calDiff !== 0 ? `${calDiff > 0 ? '+' : ''}${calDiff}` : null },
                          { l: lang === 'en' ? 'Avg Protein'   : 'Ср. белок',    v: avgProt,  u: 'г'    },
                          { l: lang === 'en' ? 'Avg Water'     : 'Ср. вода',     v: avgWater, u: 'мл'   },
                          { l: lang === 'en' ? 'Days Logged'   : 'Дней записей', v: entries.length, u: `/ 7` },
                        ].map(item => (
                          <div key={item.l} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px', border: `1px solid ${bdr}` }}>
                            <div style={{ fontSize: 9, color: sub, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{item.l.toUpperCase()}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                              {item.v}
                              <span style={{ fontSize: 11, fontWeight: 400, color: sub, marginLeft: 3 }}>{item.u}</span>
                            </div>
                            {item.note && (
                              <div style={{ fontSize: 10, color: calDiff > 200 ? 'rgba(255,200,100,0.8)' : 'rgba(150,255,150,0.8)', marginTop: 4 }}>
                                {item.note} {lang === 'en' ? 'vs goal' : 'к цели'}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              </>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB: WORKOUTS
            ══════════════════════════════════════════════════════ */}
            {activeTab === 'workouts' && (
              <>
                {/* Today's workout summary */}
                <div style={{ ...card, margin: '16px 16px 12px', animation: 'wlp-fadeup 0.4s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: txt }}>
                      {lang === 'en' ? '◎ Today\'s Workouts' : '◎ Тренировки сегодня'}
                    </div>
                    <button type="button" onClick={() => setShowWorkoutSheet(true)}
                      style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${bdr}`, borderRadius: 10, padding: '6px 14px', color: sub, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {lang === 'en' ? '+ add' : '+ добавить'}
                    </button>
                  </div>

                  {/* Totals */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: workouts.length > 0 ? 16 : 0 }}>
                    {[
                      { v: totalWorkoutMin, u: lang === 'en' ? 'min'    : 'мин',   l: lang === 'en' ? 'Total time'   : 'Время'    },
                      { v: Math.round(totalWorkoutCal), u: lang === 'en' ? 'kcal' : 'ккал', l: lang === 'en' ? 'Burned'       : 'Сожжено'  },
                      { v: workouts.length, u: lang === 'en' ? 'sets'   : 'сет',   l: lang === 'en' ? 'Sessions'     : 'Сессий'   },
                    ].map(item => (
                      <div key={item.l} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '12px', border: `1px solid ${bdr}`, textAlign: 'center' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                          {item.v}
                          <span style={{ fontSize: 9, color: sub, marginLeft: 2 }}>{item.u}</span>
                        </div>
                        <div style={{ fontSize: 9, color: sub, marginTop: 4 }}>{item.l}</div>
                      </div>
                    ))}
                  </div>

                  {workouts.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 0', color: sub, fontSize: 13 }}>
                      {lang === 'en' ? 'No workouts logged yet today' : 'Тренировок сегодня ещё нет'}
                    </div>
                  ) : (
                    workouts.map(w => {
                      const wt = WORKOUT_TYPES.find(t => t.key === w.type)
                      const burned = Math.round((wt?.calPerMin || 5) * (Number(w.duration) || 0))
                      return (
                        <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${bdr}` }}>
                          <span style={{ fontSize: 20 }}>{wt?.emoji || '◻'}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: txt }}>
                              {lang === 'en' ? wt?.labelEn : wt?.labelRu}
                              {w.note && <span style={{ fontWeight: 400, color: sub }}> · {w.note}</span>}
                            </div>
                            <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>
                              {w.duration} {lang === 'en' ? 'min' : 'мин'} · ~{burned} {lang === 'en' ? 'kcal burned' : 'ккал сожжено'}
                            </div>
                          </div>
                          <button type="button" onClick={() => deleteWorkout(w.id)}
                            style={{ background: 'none', border: 'none', color: sub, cursor: 'pointer', fontSize: 14, padding: 4, opacity: 0.5 }}>✕</button>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Workout type guide */}
                <div style={{ ...card, margin: '0 16px 12px', animation: 'wlp-fadeup 0.5s ease' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 14 }}>
                    {lang === 'en' ? '◷ Calorie Burn Guide' : '◷ Расход калорий (в минуту)'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {WORKOUT_TYPES.map(wt => (
                      <div key={wt.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: `1px solid ${bdr}` }}>
                        <span style={{ fontSize: 14 }}>{wt.emoji}</span>
                        <div>
                          <div style={{ fontSize: 11, color: txt, fontWeight: 500 }}>{lang === 'en' ? wt.labelEn : wt.labelRu}</div>
                          <div style={{ fontSize: 10, color: sub }}>~{wt.calPerMin} {lang === 'en' ? 'kcal/min' : 'ккал/мин'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ══ FAB ══════════════════════════════════════════════════════ */}
        <button type="button"
          onClick={() => activeTab === 'workouts' ? setShowWorkoutSheet(true) : setShowSheet(true)}
          style={{
            position: 'fixed', bottom: 76, right: 20,
            width: 56, height: 56, borderRadius: 28,
            background: '#ffffff', border: 'none',
            boxShadow: '0 4px 24px rgba(255,255,255,0.25)',
            fontSize: 26, fontWeight: 400, color: '#000',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100, transition: 'transform 0.15s ease', lineHeight: 1,
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {activeTab === 'workouts' ? '◎' : '+'}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PORTALS
      ═══════════════════════════════════════════════════════════════ */}

      {/* ── MEAL BOTTOM SHEET ──────────────────────────────────────── */}
      {showSheet && (
        <Portal>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}
            onClick={() => setShowSheet(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', background: '#111111',
                borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
                maxHeight: '90vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                transform: sheetMounted ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.38s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div style={{ padding: '8px 16px 48px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: txt }}>
                    {lang === 'en' ? 'Add meal' : 'Добавить приём пищи'}
                  </div>
                  <button type="button" onClick={() => setShowSheet(false)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sub, fontSize: 16, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>

                {/* Meal type pills */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                  {MEAL_TYPES.map(mt => (
                    <button key={mt.key} type="button"
                      onClick={() => setMealForm(f => ({ ...f, meal_type: mt.key }))}
                      style={{
                        padding: '7px 14px', borderRadius: 12,
                        border: `1px solid ${mealForm.meal_type === mt.key ? 'rgba(255,255,255,0.4)' : bdr}`,
                        background: mealForm.meal_type === mt.key ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: mealForm.meal_type === mt.key ? txt : sub,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      {mt.emoji} {lang === 'en' ? mt.labelEn : mt.labelRu}
                    </button>
                  ))}
                </div>

                {/* ── AI FOOD SEARCH ─────────────────────────────── */}
                <div style={{ marginBottom: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 16, padding: '14px' }}>
                  <div style={{ fontSize: 11, color: sub, fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                    {lang === 'en' ? '✦ AI CALORIE SEARCH' : '✦ AI ПОИСК КАЛОРИЙ'}
                  </div>
                  <form onSubmit={handleAiSearch} style={{ display: 'flex', gap: 8 }}>
                    <input
                      placeholder={lang === 'en' ? 'e.g. "100g pasta bolognese"' : 'Напр. "тарелка борща 300г"'}
                      value={aiQuery}
                      onChange={e => { setAiQuery(e.target.value); setAiResult(null); setAiError('') }}
                      style={{ ...inp(), flex: 1, fontSize: 13 }}
                    />
                    <button type="submit" disabled={aiLoading || !aiQuery.trim()}
                      style={{
                        background: aiLoading ? 'rgba(255,255,255,0.1)' : '#ffffff',
                        border: 'none', borderRadius: 12,
                        padding: '0 16px', color: '#000', fontWeight: 700, fontSize: 13,
                        cursor: aiLoading ? 'default' : 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                        opacity: (!aiQuery.trim() && !aiLoading) ? 0.5 : 1,
                      }}>
                      {aiLoading
                        ? <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(0,0,0,0.2)', borderTopColor: '#000', borderRadius: '50%', animation: 'wlp-spin 0.8s linear infinite' }} />
                        : (lang === 'en' ? 'Ask' : 'Найти')}
                    </button>
                  </form>

                  {aiError && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,150,100,0.8)' }}>{aiError}</div>
                  )}

                  {aiResult && (
                    <div style={{ marginTop: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px', border: `1px solid rgba(255,255,255,0.15)` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: txt, marginBottom: 4 }}>{aiResult.name}</div>
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>{aiResult.calories} ккал</div>
                          <div style={{ fontSize: 11, color: sub, marginTop: 3 }}>
                            {lang === 'en' ? 'P' : 'Б'}{aiResult.protein}г &nbsp;
                            {lang === 'en' ? 'F' : 'Ж'}{aiResult.fat}г &nbsp;
                            {lang === 'en' ? 'C' : 'У'}{aiResult.carbs}г
                          </div>
                        </div>
                        <button type="button" onClick={applyAiResult}
                          style={{ background: '#ffffff', border: 'none', borderRadius: 10, padding: '8px 14px', color: '#000', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                          {lang === 'en' ? '↓ Use' : '↓ Взять'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick foods */}
                <div style={{ marginBottom: 14 }}>
                  <input
                    placeholder={lang === 'en' ? '○ Search quick foods...' : '○ Поиск быстрых продуктов...'}
                    value={quickSearch}
                    onChange={e => setQuickSearch(e.target.value)}
                    style={inp({ marginBottom: 0 })}
                  />
                  <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                    {filteredQuick.map(food => (
                      <button key={food.name} type="button" onClick={() => fillQuick(food)}
                        style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${bdr}`, borderRadius: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                        <div style={{ fontSize: 12, color: txt, fontWeight: 500, marginBottom: 2, lineHeight: 1.3 }}>{food.name}</div>
                        <div style={{ fontSize: 11, color: '#ffffff', fontWeight: 700 }}>{food.cal} ккал</div>
                        <div style={{ fontSize: 10, color: sub, marginTop: 2 }}>
                          {lang === 'en' ? 'P' : 'Б'}{food.p} {lang === 'en' ? 'F' : 'Ж'}{food.f} {lang === 'en' ? 'C' : 'У'}{food.c}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual form */}
                <div style={{ height: 1, background: bdr, margin: '14px 0' }} />
                <div style={{ fontSize: 11, color: sub, fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                  {lang === 'en' ? 'OR ENTER MANUALLY' : 'ИЛИ ВВЕДИ ВРУЧНУЮ'}
                </div>
                <form onSubmit={addMeal} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input required
                    placeholder={lang === 'en' ? 'Meal name' : 'Название блюда'}
                    value={mealForm.name}
                    onChange={e => setMealForm(f => ({ ...f, name: e.target.value }))}
                    style={inp()} />
                  <input required
                    placeholder={lang === 'en' ? 'Calories (kcal)' : 'Калории (ккал)'}
                    type="number" inputMode="decimal"
                    value={mealForm.calories}
                    onChange={e => setMealForm(f => ({ ...f, calories: e.target.value }))}
                    style={inp()} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[
                      ['protein', lang === 'en' ? 'Protein' : 'Белки'],
                      ['fat',     lang === 'en' ? 'Fat'     : 'Жиры'],
                      ['carbs',   lang === 'en' ? 'Carbs'   : 'Углеводы'],
                    ].map(([key, ph]) => (
                      <input key={key} placeholder={ph} type="number" inputMode="decimal"
                        value={mealForm[key]}
                        onChange={e => setMealForm(f => ({ ...f, [key]: e.target.value }))}
                        style={inp({ textAlign: 'center', padding: '10px 8px' })} />
                    ))}
                  </div>
                  <button type="submit"
                    style={{ background: '#ffffff', border: 'none', borderRadius: 14, padding: '14px', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                    {lang === 'en' ? 'Add' : 'Добавить'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ── WORKOUT BOTTOM SHEET ────────────────────────────────────── */}
      {showWorkoutSheet && (
        <Portal>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}
            onClick={() => setShowWorkoutSheet(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', background: '#111111',
                borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.1)', borderBottom: 'none',
                maxHeight: '80vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
                transform: workoutSheetMounted ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.38s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div style={{ padding: '8px 16px 48px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: txt }}>
                    {lang === 'en' ? 'Log workout' : 'Записать тренировку'}
                  </div>
                  <button type="button" onClick={() => setShowWorkoutSheet(false)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 10, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sub, fontSize: 16, cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>

                {/* Workout type grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
                  {WORKOUT_TYPES.map(wt => (
                    <button key={wt.key} type="button"
                      onClick={() => setWorkoutForm(f => ({ ...f, type: wt.key }))}
                      style={{
                        padding: '10px 12px', borderRadius: 14, textAlign: 'left',
                        border: `1px solid ${workoutForm.type === wt.key ? 'rgba(255,255,255,0.5)' : bdr}`,
                        background: workoutForm.type === wt.key ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      <div style={{ fontSize: 18, marginBottom: 4 }}>{wt.emoji}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: workoutForm.type === wt.key ? txt : sub }}>
                        {lang === 'en' ? wt.labelEn : wt.labelRu}
                      </div>
                      <div style={{ fontSize: 10, color: sub, marginTop: 2 }}>~{wt.calPerMin} {lang === 'en' ? 'kcal/min' : 'ккал/мин'}</div>
                    </button>
                  ))}
                </div>

                <form onSubmit={addWorkout} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: sub, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                      {(lang === 'en' ? 'DURATION (MINUTES)' : 'ДЛИТЕЛЬНОСТЬ (МИНУТ)')}
                    </label>
                    <input required
                      type="number" inputMode="numeric" min="1" max="600"
                      placeholder={lang === 'en' ? 'e.g. 45' : 'Напр. 45'}
                      value={workoutForm.duration}
                      onChange={e => setWorkoutForm(f => ({ ...f, duration: e.target.value }))}
                      style={inp()} />
                  </div>
                  {workoutForm.duration && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', padding: '4px 0' }}>
                      ≈ {Math.round((WORKOUT_TYPES.find(t => t.key === workoutForm.type)?.calPerMin || 5) * Number(workoutForm.duration))} {lang === 'en' ? 'kcal burned' : 'ккал сожжено'}
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: sub, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                      {lang === 'en' ? 'NOTE (OPTIONAL)' : 'ЗАМЕТКА (НЕОБЯЗАТЕЛЬНО)'}
                    </label>
                    <input
                      placeholder={lang === 'en' ? 'e.g. morning run, 5km' : 'Напр. утробный бег, 5км'}
                      value={workoutForm.note}
                      onChange={e => setWorkoutForm(f => ({ ...f, note: e.target.value }))}
                      style={inp()} />
                  </div>
                  <button type="submit"
                    style={{ background: '#ffffff', border: 'none', borderRadius: 14, padding: '14px', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                    {lang === 'en' ? 'Log workout' : 'Записать'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ── WEIGHT MODAL ─────────────────────────────────────────────── */}
      {showWeightForm && (
        <Portal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={() => setShowWeightForm(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#111111', borderRadius: 24, border: `1px solid ${bdr}`, padding: '32px 24px', width: '100%', maxWidth: 300, textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>⊙</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: txt, marginBottom: 6 }}>
                {lang === 'en' ? "Today's weight" : 'Сегодняшний вес'}
              </div>
              <div style={{ fontSize: 12, color: sub, marginBottom: 18 }}>
                {currentW ? (lang === 'en' ? `Last: ${currentW} kg` : `Последний: ${currentW} кг`) : (lang === 'en' ? 'First measurement' : 'Первое измерение')}
              </div>
              <input
                autoFocus type="number" step="0.1" inputMode="decimal" placeholder="70.5"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveWeight() } }}
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${bdr}`, borderRadius: 14, padding: '16px', color: txt, fontSize: 28, fontWeight: 800, outline: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-display)' }} />
              <div style={{ fontSize: 13, color: sub, marginTop: 6, marginBottom: 20 }}>кг</div>
              <button type="button" onClick={saveWeight}
                style={{ background: '#ffffff', border: 'none', borderRadius: 14, padding: '14px 0', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
                {lang === 'en' ? 'Save' : 'Сохранить'}
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* ── SETTINGS MODAL ────────────────────────────────────────────── */}
      {showSettings && (
        <Portal>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={() => setShowSettings(false)}>
            <div onClick={e => e.stopPropagation()} style={{ background: '#111111', borderRadius: 24, border: `1px solid ${bdr}`, padding: '28px 24px', width: '100%', maxWidth: 360 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: txt, marginBottom: 20 }}>
                {lang === 'en' ? '≡ Settings' : '≡ Настройки'}
              </div>
              <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { key: 'calorie_goal',  label: lang === 'en' ? 'Calorie goal (kcal)' : 'Цель по калориям (ккал)', type: 'number' },
                  { key: 'protein_goal',  label: lang === 'en' ? 'Protein goal (g)'    : 'Цель по белку (г)',       type: 'number' },
                  { key: 'target_weight', label: lang === 'en' ? 'Target weight (kg)'  : 'Целевой вес (кг)',        type: 'number', step: '0.1', placeholder: lang === 'en' ? 'e.g. 70' : 'Например: 70' },
                ].map(({ key, label, type, step, placeholder }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 11, color: sub, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                      {label.toUpperCase()}
                    </label>
                    <input type={type} step={step} inputMode="decimal" placeholder={placeholder}
                      value={settingsForm[key]}
                      onChange={e => setSettingsForm(f => ({ ...f, [key]: e.target.value }))}
                      style={inp()} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setShowSettings(false)}
                    style={{ flex: 1, background: 'transparent', border: `1px solid ${bdr}`, borderRadius: 14, padding: '13px', color: sub, fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {lang === 'en' ? 'Cancel' : 'Отмена'}
                  </button>
                  <button type="submit"
                    style={{ flex: 1, background: '#ffffff', border: 'none', borderRadius: 14, padding: '13px', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {lang === 'en' ? 'Save' : 'Сохранить'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}
