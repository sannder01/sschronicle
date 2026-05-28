'use client'
// ╔══════════════════════════════════════════════════════════════════╗
// ║  CHRONICLE — WEIGHT LOSS PAGE                                    ║
// ║  Apple Health / Fitness+ style · Кольца · Графики · Статистика  ║
// ╚══════════════════════════════════════════════════════════════════╝

import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

// ── Utils ──────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10) }
function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Data ───────────────────────────────────────────────────────────
const MEAL_TYPES = [
  { key: 'breakfast', label: 'Завтрак', emoji: '🌅' },
  { key: 'lunch',     label: 'Обед',    emoji: '☀️' },
  { key: 'dinner',    label: 'Ужин',    emoji: '🌙' },
  { key: 'snack',     label: 'Перекус', emoji: '🍎' },
]

const QUICK_FOODS = [
  { name: 'Куриная грудка 100г', cal: 165, p: 31, f: 3.6, c: 0 },
  { name: 'Овсянка 100г',        cal: 371, p: 13, f: 7,   c: 67 },
  { name: 'Яйцо варёное',        cal: 78,  p: 6,  f: 5,   c: 0.6 },
  { name: 'Рис варёный 100г',    cal: 130, p: 2.7,f: 0.3, c: 28 },
  { name: 'Банан',               cal: 89,  p: 1.1,f: 0.3, c: 23 },
  { name: 'Творог 5% 100г',      cal: 121, p: 17, f: 5,   c: 3 },
  { name: 'Гречка варёная 100г', cal: 92,  p: 3.4,f: 0.6, c: 20 },
  { name: 'Лосось 100г',         cal: 208, p: 20, f: 13,  c: 0 },
  { name: 'Греческий йогурт',    cal: 59,  p: 10, f: 0.4, c: 3.6 },
  { name: 'Авокадо',             cal: 160, p: 2,  f: 15,  c: 9 },
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

// ── Colors ─────────────────────────────────────────────────────────
const C = {
  cal:    '#FF4446',
  water:  '#30B0C7',
  protein:'#30D158',
  weight: '#FFD60A',
  fat:    '#FF9F0A',
  carbs:  '#BF5AF2',
}

// ── Portal ─────────────────────────────────────────────────────────
function Portal({ children }) {
  const [m, setM] = useState(false)
  useEffect(() => { setM(true) }, [])
  if (!m) return null
  return createPortal(children, document.body)
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ACTIVITY RING — SVG кольцо в стиле Apple Activity              ║
// ╚══════════════════════════════════════════════════════════════════╝
function ActivityRing({ value, max, color, label, unit, size = 90, strokeWidth = 9 }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  // Clamp so the ring doesn't show >1 full rotation for overflow
  const dashArr = `${pct * circ} ${circ}`
  const cx = size / 2
  const cy = size / 2

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Shadow glow track */}
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={color} strokeWidth={strokeWidth + 2} opacity={0.06} />
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={`${color}22`} strokeWidth={strokeWidth} />
          {/* Progress arc */}
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={dashArr}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.16,1,0.3,1)' }}
          />
          {/* End cap glow dot */}
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
        {/* Center text */}
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
// ║  WEIGHT CHART — SVG sparkline с градиентной заливкой            ║
// ╚══════════════════════════════════════════════════════════════════╝
function WeightChart({ history, targetWeight }) {
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
        Добавь хотя бы 2 измерения веса для графика
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
  const diffColor = diff < 0 ? C.protein : C.cal

  const gradId = 'wlp-grad'

  return (
    <div>
      {/* Delta badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          {fmtDate(pts[0].date)} → {fmtDate(pts[pts.length - 1].date)}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 700, color: diffColor,
          background: `${diffColor}18`, borderRadius: 8,
          padding: '3px 10px', border: `1px solid ${diffColor}33`,
        }}>
          {diff > 0 ? `+${diff}` : diff} кг
        </div>
      </div>

      <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.water} stopOpacity="0.35" />
            <stop offset="100%" stopColor={C.water} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f}
            x1={pad.left} y1={pad.top + f * (height - pad.top - pad.bottom)}
            x2={width - pad.right} y2={pad.top + f * (height - pad.top - pad.bottom)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1}
          />
        ))}

        {/* Target weight line */}
        {targetWeight && targetWeight >= minW && targetWeight <= maxW && (
          <>
            <line
              x1={pad.left} y1={toY(targetWeight)}
              x2={width - pad.right} y2={toY(targetWeight)}
              stroke={C.weight} strokeWidth={1} strokeDasharray="4 3" opacity={0.6}
            />
            <text x={width - pad.right - 2} y={toY(targetWeight) - 4}
              fill={C.weight} fontSize={9} textAnchor="end" opacity={0.8}>
              цель {targetWeight}
            </text>
          </>
        )}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <polyline
          points={linePts}
          fill="none" stroke={C.water} strokeWidth={2}
          strokeLinejoin="round" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${C.water}66)` }}
        />

        {/* Dot for last (today) */}
        <circle
          cx={toX(pts.length - 1)} cy={toY(last)}
          r={4} fill={C.water}
          style={{ filter: `drop-shadow(0 0 6px ${C.water})` }}
        />
        <text x={toX(pts.length - 1)} y={toY(last) - 8}
          fill="#fff" fontSize={10} fontWeight={700} textAnchor="middle">
          {last}
        </text>

        {/* X labels — first and last */}
        <text x={toX(0)} y={height} fill="rgba(255,255,255,0.3)" fontSize={9} textAnchor="start">
          {fmtDate(pts[0].date)}
        </text>
        <text x={toX(pts.length - 1)} y={height} fill="rgba(255,255,255,0.3)" fontSize={9} textAnchor="end">
          {fmtDate(pts[pts.length - 1].date)}
        </text>
      </svg>
    </div>
  )
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║  SKELETON — загрузочный placeholder блок                        ║
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
export default function WeightLossPage({ t, session }) {
  // ── State ────────────────────────────────────────────────────────
  const [meals, setMeals]               = useState([])
  const [weight, setWeight]             = useState(null)
  const [waterMl, setWaterMl]           = useState(0)
  const [calorieGoal, setCalorieGoal]   = useState(2000)
  const [proteinGoal, setProteinGoal]   = useState(150)
  const [targetWeight, setTargetWeight] = useState(null)
  const [history, setHistory]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [streak, setStreak]             = useState(0)

  const [showSheet, setShowSheet]       = useState(false)
  const [showWeightForm, setShowWeightForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const [mealForm, setMealForm]         = useState({ name: '', meal_type: 'lunch', calories: '', protein: '', fat: '', carbs: '' })
  const [weightInput, setWeightInput]   = useState('')
  const [settingsForm, setSettingsForm] = useState({ calorie_goal: 2000, target_weight: '', protein_goal: 150 })
  const [quickSearch, setQuickSearch]   = useState('')
  const [sheetMounted, setSheetMounted] = useState(false)

  const quote = useRef(MOTIVATIONAL[Math.floor(Math.random() * MOTIVATIONAL.length)]).current

  // ── Load ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const today = todayISO()
    try {
      const [dayData, hist, cfg] = await Promise.all([
        apiFetch(`/api/fitness?date=${today}`).catch(() => ({ meals: [], weight: null, water_ml: 0 })),
        apiFetch('/api/fitness/history?days=30').catch(() => []),
        apiFetch('/api/fitness/config').catch(() => ({ calorie_goal: 2000, target_weight: null })),
      ])
      setMeals(Array.isArray(dayData.meals) ? dayData.meals : [])
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

      // ── Streak: сколько дней подряд вводился вес ─────────────────
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

  // Sheet slide animation
  useEffect(() => {
    if (showSheet) {
      requestAnimationFrame(() => setSheetMounted(true))
    } else {
      setSheetMounted(false)
    }
  }, [showSheet])

  // ── Derived ──────────────────────────────────────────────────────
  const today      = todayISO()
  const totalCal   = meals.reduce((s, m) => s + (Number(m.calories) || 0), 0)
  const totalP     = meals.reduce((s, m) => s + (Number(m.protein)  || 0), 0)
  const totalF     = meals.reduce((s, m) => s + (Number(m.fat)      || 0), 0)
  const totalC     = meals.reduce((s, m) => s + (Number(m.carbs)    || 0), 0)

  const lastWeight = history.filter(h => h.weight).sort((a, b) => b.date.localeCompare(a.date))[0]?.weight
  const currentW   = weight || lastWeight

  const weightProgress = (() => {
    if (!currentW || !targetWeight) return 0
    const wPts = history.filter(h => h.weight).sort((a, b) => a.date.localeCompare(b.date))
    const startW = wPts[0]?.weight
    if (!startW || startW === targetWeight) return 0
    const total = Math.abs(startW - targetWeight)
    const done  = Math.abs(startW - currentW)
    return Math.min((done / total) * 100, 100)
  })()

  const filteredQuick = quickSearch.length > 0
    ? QUICK_FOODS.filter(f => f.name.toLowerCase().includes(quickSearch.toLowerCase()))
    : QUICK_FOODS

  // ── Theme shortcuts ───────────────────────────────────────────────
  const bdr    = 'rgba(255,255,255,0.08)'
  const sub    = 'rgba(255,255,255,0.4)'
  const txt    = '#ffffff'
  const pageBg = '#0a0a0a'
  const cardBg = 'rgba(255,255,255,0.05)'

  const card = {
    background: cardBg,
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
    setQuickSearch('')
  }

  const mealsByType = MEAL_TYPES.map(mt => ({
    ...mt,
    items: meals.filter(m => m.meal_type === mt.key),
  }))

  // ═══════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <>
      {/* ── Keyframes inline via style tag ───────────────────────── */}
      <style>{`
        @keyframes wlp-pulse {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1; }
        }
        @keyframes wlp-fadeup {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .wlp-card-tap:active { transform: scale(0.97); }
      `}</style>

      <div style={{
        paddingBottom: 120,
        maxWidth: 600,
        margin: '0 auto',
        position: 'relative',
      }}>

        {/* ══ HEADER ══════════════════════════════════════════════════ */}
        <div style={{ padding: '20px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: txt }}>
              Похудение
            </div>
            <div style={{ color: sub, fontSize: 12, marginTop: 2 }}>
              {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {streak > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,212,0,0.12)', border: '1px solid rgba(255,212,0,0.25)',
                borderRadius: 12, padding: '6px 12px',
              }}>
                <span style={{ fontSize: 14 }}>🔥</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FFD60A' }}>{streak}д</span>
              </div>
            )}
            <button type="button"
              onClick={() => setShowSettings(true)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${bdr}`,
                borderRadius: 12, width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: sub, fontSize: 16, cursor: 'pointer',
              }}>⚙</button>
          </div>
        </div>

        {loading ? (
          /* ── SKELETON ─────────────────────────────────────────── */
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Skeleton height={160} />
            <Skeleton height={120} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Skeleton height={100} />
              <Skeleton height={100} />
              <Skeleton height={100} />
              <Skeleton height={100} />
            </div>
            <Skeleton height={180} />
          </div>
        ) : (
          <>

            {/* ══ A. HERO — ЦЕЛ И ПРОГРЕСС ══════════════════════════ */}
            <div style={{
              margin: '16px 16px 12px',
              background: 'linear-gradient(135deg, rgba(48,209,88,0.14) 0%, rgba(48,176,199,0.10) 60%, rgba(0,0,0,0) 100%)',
              border: '1px solid rgba(48,209,88,0.18)',
              borderRadius: 24,
              padding: '20px',
              animation: 'wlp-fadeup 0.4s ease',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Background glow */}
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 180, height: 180, borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(48,209,88,0.12) 0%, transparent 70%)',
                pointerEvents: 'none',
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: sub, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                    ТЕКУЩИЙ ВЕС
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 42, fontWeight: 800, color: txt, lineHeight: 1,
                    }}>
                      {currentW ?? '—'}
                    </span>
                    <span style={{ fontSize: 16, color: sub }}>кг</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: sub, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>
                    ЦЕЛЬ
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 28, fontWeight: 700, color: C.protein, lineHeight: 1,
                  }}>
                    {targetWeight ?? '—'}
                    <span style={{ fontSize: 14, color: sub, fontWeight: 400 }}> кг</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {targetWeight && currentW ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: sub }}>Прогресс к цели</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.protein }}>
                      {Math.round(weightProgress)}%
                    </span>
                  </div>
                  <div style={{
                    height: 8, borderRadius: 8, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10,
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${weightProgress}%`,
                      background: `linear-gradient(90deg, ${C.protein}, ${C.water})`,
                      borderRadius: 8,
                      transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
                      boxShadow: `0 0 10px ${C.protein}66`,
                    }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    <span style={{ color: Math.abs(currentW - targetWeight) < 0.1 ? C.protein : C.cal }}>
                      {currentW > targetWeight
                        ? `Осталось похудеть: ${(currentW - targetWeight).toFixed(1)} кг`
                        : currentW < targetWeight
                          ? `Осталось набрать: ${(targetWeight - currentW).toFixed(1)} кг`
                          : '🎉 Цель достигнута!'}
                    </span>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: sub }}>
                  Установи цель в настройках ⚙️
                </div>
              )}

              {/* Log weight CTA */}
              <button type="button"
                className="wlp-card-tap"
                onClick={() => { setWeightInput(currentW ? String(currentW) : ''); setShowWeightForm(true) }}
                style={{
                  marginTop: 14, width: '100%',
                  background: 'rgba(48,209,88,0.15)', border: '1px solid rgba(48,209,88,0.3)',
                  borderRadius: 14, padding: '11px',
                  color: C.protein, fontWeight: 700, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'transform 0.15s ease',
                }}>
                ⚖️ Записать вес сегодня
              </button>
            </div>

            {/* ══ B. КОЛЬЦА АКТИВНОСТИ ════════════════════════════════ */}
            <div style={{
              ...card,
              margin: '0 16px 12px',
              animation: 'wlp-fadeup 0.45s ease',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 16, letterSpacing: '-0.01em' }}>
                Кольца активности
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                alignItems: 'center',
                gap: 8,
              }}>
                <ActivityRing
                  value={totalCal} max={calorieGoal}
                  color={C.cal} label="Калории" unit="ккал"
                />
                <ActivityRing
                  value={Math.round(totalP)} max={proteinGoal}
                  color={C.protein} label="Белок" unit="г"
                />
                <ActivityRing
                  value={waterMl} max={2500}
                  color={C.water} label="Вода" unit="мл"
                />
              </div>
              <div style={{
                marginTop: 14, paddingTop: 14,
                borderTop: `1px solid ${bdr}`,
                display: 'flex', justifyContent: 'space-around',
              }}>
                {[
                  { l: 'Жиры', v: Math.round(totalF), u: 'г', c: C.fat },
                  { l: 'Углеводы', v: Math.round(totalC), u: 'г', c: C.carbs },
                  { l: 'Осталось', v: Math.max(0, calorieGoal - totalCal), u: 'ккал', c: txt },
                ].map(item => (
                  <div key={item.l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: item.c, fontFamily: 'var(--font-display)' }}>
                      {item.v}
                    </div>
                    <div style={{ fontSize: 10, color: sub, marginTop: 2 }}>{item.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ══ C. 2×2 КАРТОЧКИ ════════════════════════════════════ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, margin: '0 16px 12px' }}>

              {/* Калории */}
              <div style={{
                ...card, padding: '16px',
                background: `linear-gradient(135deg, rgba(255,68,70,0.1), rgba(255,68,70,0.04))`,
                border: `1px solid rgba(255,68,70,0.18)`,
                animation: 'wlp-fadeup 0.5s ease',
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>🔥</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: txt, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                  {totalCal}
                </div>
                <div style={{ fontSize: 10, color: sub, marginTop: 3 }}>из {calorieGoal} ккал</div>
                <div style={{ marginTop: 8, height: 3, borderRadius: 3, background: 'rgba(255,68,70,0.15)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min((totalCal / calorieGoal) * 100, 100)}%`,
                    background: C.cal,
                    borderRadius: 3,
                    transition: 'width 0.6s ease',
                    boxShadow: `0 0 6px ${C.cal}`,
                  }} />
                </div>
              </div>

              {/* Вода */}
              <div style={{
                ...card, padding: '16px',
                background: `linear-gradient(135deg, rgba(48,176,199,0.1), rgba(48,176,199,0.04))`,
                border: `1px solid rgba(48,176,199,0.18)`,
                animation: 'wlp-fadeup 0.5s ease',
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>💧</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: txt, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                  {waterMl}
                </div>
                <div style={{ fontSize: 10, color: sub, marginTop: 3 }}>из 2500 мл</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                  {[200, 500].map(ml => (
                    <button key={ml} type="button" onClick={() => addWater(ml)}
                      style={{
                        flex: 1,
                        background: 'rgba(48,176,199,0.18)', border: '1px solid rgba(48,176,199,0.3)',
                        borderRadius: 8, padding: '5px 0', color: C.water,
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}>
                      +{ml}
                    </button>
                  ))}
                </div>
              </div>

              {/* Вес */}
              <button type="button"
                className="wlp-card-tap"
                onClick={() => { setWeightInput(currentW ? String(currentW) : ''); setShowWeightForm(true) }}
                style={{
                  ...card, padding: '16px', cursor: 'pointer', textAlign: 'left',
                  background: `linear-gradient(135deg, rgba(255,214,10,0.1), rgba(255,214,10,0.04))`,
                  border: `1px solid rgba(255,214,10,0.18)`,
                  animation: 'wlp-fadeup 0.55s ease',
                  fontFamily: 'inherit',
                  transition: 'transform 0.15s ease',
                }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>⚖️</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: txt, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                  {currentW ?? '—'}
                </div>
                <div style={{ fontSize: 10, color: sub, marginTop: 3 }}>
                  кг · нажми для записи
                </div>
                {targetWeight && currentW && (
                  <div style={{
                    marginTop: 8, fontSize: 11, fontWeight: 700,
                    color: currentW > targetWeight ? C.cal : C.protein,
                  }}>
                    {currentW > targetWeight
                      ? `−${(currentW - targetWeight).toFixed(1)} до цели`
                      : '✓ Цель!'}
                  </div>
                )}
              </button>

              {/* Белок */}
              <div style={{
                ...card, padding: '16px',
                background: `linear-gradient(135deg, rgba(48,209,88,0.1), rgba(48,209,88,0.04))`,
                border: `1px solid rgba(48,209,88,0.18)`,
                animation: 'wlp-fadeup 0.55s ease',
              }}>
                <div style={{ fontSize: 20, marginBottom: 6 }}>🥩</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: txt, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
                  {Math.round(totalP)}
                </div>
                <div style={{ fontSize: 10, color: sub, marginTop: 3 }}>из {proteinGoal} г белка</div>
                <div style={{ marginTop: 8, height: 3, borderRadius: 3, background: 'rgba(48,209,88,0.15)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min((totalP / proteinGoal) * 100, 100)}%`,
                    background: C.protein,
                    borderRadius: 3,
                    transition: 'width 0.6s ease',
                    boxShadow: `0 0 6px ${C.protein}`,
                  }} />
                </div>
              </div>
            </div>

            {/* ══ D. ГРАФИК ВЕСА ══════════════════════════════════════ */}
            <div style={{
              ...card,
              margin: '0 16px 12px',
              animation: 'wlp-fadeup 0.6s ease',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: txt, marginBottom: 14 }}>
                📈 График веса
              </div>
              <WeightChart history={history} targetWeight={targetWeight} />
            </div>

            {/* ══ E. ЛЕНТА ПРИЁМОВ ПИЩИ ══════════════════════════════ */}
            <div style={{ margin: '0 16px 12px' }}>
              <div style={{ fontSize: 11, color: sub, letterSpacing: '0.1em', fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
                СЕГОДНЯ
              </div>

              {mealsByType.map(({ key, label, emoji, items }) => (
                <div key={key} style={{
                  ...card,
                  marginBottom: 8,
                  animation: 'wlp-fadeup 0.65s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: items.length > 0 ? 10 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: txt }}>{label}</span>
                      {items.length > 0 && (
                        <span style={{
                          fontSize: 11, color: sub,
                          background: 'rgba(255,255,255,0.06)',
                          borderRadius: 6, padding: '2px 7px',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {items.reduce((s, i) => s + (Number(i.calories) || 0), 0)} ккал
                        </span>
                      )}
                    </div>
                    <button type="button"
                      onClick={() => { setMealForm(f => ({ ...f, meal_type: key })); setShowSheet(true) }}
                      style={{
                        background: 'rgba(255,255,255,0.07)', border: `1px solid ${bdr}`,
                        borderRadius: 10, padding: '5px 12px', color: sub,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      + добавить
                    </button>
                  </div>

                  {items.map((item, idx) => (
                    <div key={item.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 0',
                      borderTop: `1px solid ${bdr}`,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: txt, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </div>
                        {(Number(item.protein) + Number(item.fat) + Number(item.carbs)) > 0 && (
                          <div style={{ fontSize: 10, color: sub, marginTop: 2 }}>
                            <span style={{ color: C.protein }}>Б{Math.round(item.protein || 0)}</span>
                            {' · '}
                            <span style={{ color: C.fat }}>Ж{Math.round(item.fat || 0)}</span>
                            {' · '}
                            <span style={{ color: C.carbs }}>У{Math.round(item.carbs || 0)}</span>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.cal, flexShrink: 0 }}>
                        {item.calories} ккал
                      </span>
                      <button type="button" onClick={() => deleteMeal(item.id)}
                        style={{ background: 'none', border: 'none', color: sub, cursor: 'pointer', fontSize: 14, padding: 4, flexShrink: 0, opacity: 0.5 }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* ══ МОТИВАЦИОННАЯ ЦИТАТА ════════════════════════════════ */}
            <div style={{
              margin: '4px 16px 16px',
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${bdr}`,
              borderRadius: 16,
              padding: '16px 18px',
              animation: 'wlp-fadeup 0.7s ease',
            }}>
              <div style={{ fontSize: 11, color: sub, fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
                МОТИВАЦИЯ ДНЯ
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, fontStyle: 'italic' }}>
                "{quote}"
              </div>
            </div>

          </>
        )}

        {/* ══ F. FAB — ФИКСИРОВАННАЯ КНОПКА "+" ══════════════════════ */}
        <button type="button"
          onClick={() => setShowSheet(true)}
          style={{
            position: 'fixed',
            bottom: 76,
            right: 20,
            width: 56, height: 56,
            borderRadius: 28,
            background: '#ffffff',
            border: 'none',
            boxShadow: '0 4px 24px rgba(255,255,255,0.25)',
            fontSize: 26,
            fontWeight: 400,
            color: '#000',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            lineHeight: 1,
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          +
        </button>

      </div>

      {/* ═══════════════════════════════════════════════════════════════
          PORTALS
      ═══════════════════════════════════════════════════════════════ */}

      {/* ── BOTTOM SHEET — ДОБАВИТЬ ЕДУ ──────────────────────────── */}
      {showSheet && (
        <Portal>
          <div
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.75)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'flex-end',
              transition: 'background 0.25s',
            }}
            onClick={() => setShowSheet(false)}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                background: '#111111',
                borderRadius: '24px 24px 0 0',
                border: '1px solid rgba(255,255,255,0.1)',
                borderBottom: 'none',
                maxHeight: '86vh',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                transform: sheetMounted ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 0.38s cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              {/* Drag handle */}
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
              </div>

              <div style={{ padding: '8px 16px 48px' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: txt }}>Добавить приём пищи</div>
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
                      {mt.emoji} {mt.label}
                    </button>
                  ))}
                </div>

                {/* Quick foods search */}
                <div style={{ marginBottom: 14 }}>
                  <input
                    placeholder="🔍 Поиск быстрых продуктов..."
                    value={quickSearch}
                    onChange={e => setQuickSearch(e.target.value)}
                    style={inp({ marginBottom: 0 })}
                  />
                  <div style={{
                    marginTop: 8,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                    maxHeight: 200,
                    overflowY: 'auto',
                  }}>
                    {filteredQuick.map(food => (
                      <button key={food.name} type="button" onClick={() => fillQuick(food)}
                        style={{
                          background: 'rgba(255,255,255,0.05)', border: `1px solid ${bdr}`,
                          borderRadius: 12, padding: '10px 12px', cursor: 'pointer',
                          textAlign: 'left', fontFamily: 'inherit',
                        }}>
                        <div style={{ fontSize: 12, color: txt, fontWeight: 500, marginBottom: 2, lineHeight: 1.3 }}>{food.name}</div>
                        <div style={{ fontSize: 11, color: C.cal, fontWeight: 700 }}>{food.cal} ккал</div>
                        <div style={{ fontSize: 10, color: sub, marginTop: 2 }}>
                          Б{food.p} Ж{food.f} У{food.c}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual form */}
                <div style={{ height: 1, background: bdr, margin: '14px 0' }} />
                <div style={{ fontSize: 11, color: sub, fontFamily: 'var(--font-mono)', marginBottom: 10 }}>ИЛИ ВВЕДИ ВРУЧНУЮ</div>

                <form onSubmit={addMeal} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input required placeholder="Название блюда" value={mealForm.name}
                    onChange={e => setMealForm(f => ({ ...f, name: e.target.value }))}
                    style={inp()} />
                  <input required placeholder="Калории (ккал)" type="number" inputMode="decimal"
                    value={mealForm.calories}
                    onChange={e => setMealForm(f => ({ ...f, calories: e.target.value }))}
                    style={inp()} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {[['protein','Белки','#30D158'],['fat','Жиры','#FF9F0A'],['carbs','Углеводы','#BF5AF2']].map(([key, ph, c]) => (
                      <input key={key} placeholder={ph} type="number" inputMode="decimal"
                        value={mealForm[key]}
                        onChange={e => setMealForm(f => ({ ...f, [key]: e.target.value }))}
                        style={inp({ color: c, textAlign: 'center', padding: '10px 8px' })} />
                    ))}
                  </div>
                  <button type="submit"
                    style={{
                      background: '#ffffff', border: 'none', borderRadius: 14,
                      padding: '14px', color: '#000', fontWeight: 700, fontSize: 15,
                      cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
                    }}>
                    Добавить
                  </button>
                </form>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ── WEIGHT MODAL ─────────────────────────────────────────── */}
      {showWeightForm && (
        <Portal>
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
            onClick={() => setShowWeightForm(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#111111', borderRadius: 24,
              border: `1px solid ${bdr}`,
              padding: '32px 24px', width: '100%', maxWidth: 300, textAlign: 'center',
            }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>⚖️</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: txt, marginBottom: 6 }}>Сегодняшний вес</div>
              <div style={{ fontSize: 12, color: sub, marginBottom: 18 }}>
                {currentW ? `Последний: ${currentW} кг` : 'Первое измерение'}
              </div>
              <input
                autoFocus type="number" step="0.1" inputMode="decimal" placeholder="70.5"
                value={weightInput}
                onChange={e => setWeightInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveWeight() } }}
                style={{
                  background: 'rgba(255,255,255,0.06)', border: `1px solid ${bdr}`,
                  borderRadius: 14, padding: '16px', color: txt,
                  fontSize: 28, fontWeight: 800, outline: 'none',
                  textAlign: 'center', width: '100%', boxSizing: 'border-box',
                  fontFamily: 'var(--font-display)',
                }} />
              <div style={{ fontSize: 13, color: sub, marginTop: 6, marginBottom: 20 }}>кг</div>
              <button type="button" onClick={saveWeight}
                style={{
                  background: '#ffffff', border: 'none', borderRadius: 14,
                  padding: '14px 0', color: '#000', fontWeight: 700, fontSize: 15,
                  cursor: 'pointer', width: '100%', fontFamily: 'inherit',
                }}>
                Сохранить
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* ── SETTINGS MODAL ───────────────────────────────────────── */}
      {showSettings && (
        <Portal>
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
            onClick={() => setShowSettings(false)}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#111111', borderRadius: 24,
              border: `1px solid ${bdr}`,
              padding: '28px 24px', width: '100%', maxWidth: 360,
            }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: txt, marginBottom: 20 }}>
                ⚙️ Настройки
              </div>
              <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { key: 'calorie_goal',  label: 'Цель по калориям (ккал)', type: 'number' },
                  { key: 'protein_goal',  label: 'Цель по белку (г)',        type: 'number' },
                  { key: 'target_weight', label: 'Целевой вес (кг)',         type: 'number', step: '0.1', placeholder: 'Например: 70' },
                ].map(({ key, label, type, step, placeholder }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 11, color: sub, marginBottom: 6, fontFamily: 'var(--font-mono)' }}>
                      {label.toUpperCase()}
                    </label>
                    <input
                      type={type} step={step} inputMode="decimal"
                      placeholder={placeholder}
                      value={settingsForm[key]}
                      onChange={e => setSettingsForm(f => ({ ...f, [key]: e.target.value }))}
                      style={inp()} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <button type="button" onClick={() => setShowSettings(false)}
                    style={{
                      flex: 1, background: 'transparent', border: `1px solid ${bdr}`,
                      borderRadius: 14, padding: '13px', color: sub,
                      fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    Отмена
                  </button>
                  <button type="submit"
                    style={{
                      flex: 1, background: '#ffffff', border: 'none',
                      borderRadius: 14, padding: '13px', color: '#000',
                      fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                    }}>
                    Сохранить
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
