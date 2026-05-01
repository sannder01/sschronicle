'use client'
// ╔════════════════════════════════════════════════════════════╗
// ║  CHRONICLE — FITNESS TRACKER                               ║
// ║  Калории · Вес · Вода · БЖУ · Прогресс                    ║
// ╚════════════════════════════════════════════════════════════╝

import { useState, useEffect, useCallback } from 'react'

// ── Utils ─────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10) }

function formatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

const MEAL_TYPES = [
  { key: 'breakfast', label: 'Завтрак',  emoji: '🌅' },
  { key: 'lunch',     label: 'Обед',     emoji: '☀️' },
  { key: 'dinner',    label: 'Ужин',     emoji: '🌙' },
  { key: 'snack',     label: 'Перекус',  emoji: '🍎' },
]

const QUICK_FOODS = [
  { name: 'Куриная грудка 100г', cal: 165, p: 31, f: 3.6, c: 0 },
  { name: 'Овсянка 100г', cal: 371, p: 13, f: 7, c: 67 },
  { name: 'Яйцо варёное', cal: 78, p: 6, f: 5, c: 0.6 },
  { name: 'Рис варёный 100г', cal: 130, p: 2.7, f: 0.3, c: 28 },
  { name: 'Банан', cal: 89, p: 1.1, f: 0.3, c: 23 },
  { name: 'Творог 5% 100г', cal: 121, p: 17, f: 5, c: 3 },
  { name: 'Гречка варёная 100г', cal: 92, p: 3.4, f: 0.6, c: 20 },
  { name: 'Лосось 100г', cal: 208, p: 20, f: 13, c: 0 },
]

// ── API helpers ────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ── Main Component ─────────────────────────────────────────────
export default function FitnessTracker({ t }) {
  const [date, setDate] = useState(todayISO())

  // Day data
  const [meals, setMeals] = useState([])
  const [weight, setWeight] = useState(null)
  const [waterMl, setWaterMl] = useState(0)
  const [calorieGoal, setCalorieGoal] = useState(2000)
  const [targetWeight, setTargetWeight] = useState(null)

  // History for chart
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  // Forms
  const [showMealForm, setShowMealForm] = useState(false)
  const [mealForm, setMealForm] = useState({ name: '', meal_type: 'lunch', calories: '', protein: '', fat: '', carbs: '' })
  const [showWeightForm, setShowWeightForm] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ calorie_goal: 2000, target_weight: '' })
  const [quickSearch, setQuickSearch] = useState('')
  const [activeTab, setActiveTab] = useState('today') // 'today' | 'history'

  // ── Load ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dayData, hist, cfg] = await Promise.all([
        apiFetch(`/api/fitness?date=${date}`).catch(() => ({ meals: [], weight: null, water_ml: 0 })),
        apiFetch('/api/fitness/history?days=30').catch(() => []),
        apiFetch('/api/fitness/config').catch(() => ({ calorie_goal: 2000, target_weight: null })),
      ])
      setMeals(Array.isArray(dayData.meals) ? dayData.meals : [])
      setWeight(dayData.weight)
      setWaterMl(dayData.water_ml || 0)
      setHistory(hist)
      setCalorieGoal(cfg.calorie_goal || 2000)
      setTargetWeight(cfg.target_weight)
      setSettingsForm({ calorie_goal: cfg.calorie_goal || 2000, target_weight: cfg.target_weight || '' })
    } catch {}
    setLoading(false)
  }, [date])

  useEffect(() => { load() }, [load])

  // ── Derived ───────────────────────────────────────────────────
  const totalCal  = meals.reduce((s, m) => s + (m.calories || 0), 0)
  const totalP    = meals.reduce((s, m) => s + (m.protein  || 0), 0)
  const totalF    = meals.reduce((s, m) => s + (m.fat      || 0), 0)
  const totalC    = meals.reduce((s, m) => s + (m.carbs    || 0), 0)
  const calPct    = Math.min((totalCal / calorieGoal) * 100, 100)
  const waterPct  = Math.min((waterMl / 2000) * 100, 100)
  const isToday   = date === todayISO()

  const mealsByType = MEAL_TYPES.map(mt => ({
    ...mt,
    items: meals.filter(m => m.meal_type === mt.key),
  }))

  const lastWeight = history.filter(h => h.weight).sort((a, b) => b.date.localeCompare(a.date))[0]?.weight

  // ── Actions ───────────────────────────────────────────────────
  async function addMeal(e) {
    e.preventDefault()
    if (!mealForm.name.trim() || !mealForm.calories) return
    try {
      const created = await apiFetch('/api/fitness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'meal', date, ...mealForm, calories: Number(mealForm.calories), protein: Number(mealForm.protein || 0), fat: Number(mealForm.fat || 0), carbs: Number(mealForm.carbs || 0) }),
      })
      setMeals(prev => [...prev, created])
      setMealForm({ name: '', meal_type: 'lunch', calories: '', protein: '', fat: '', carbs: '' })
      setShowMealForm(false)
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
    setWeightInput('') // reset input after save
    try {
      await apiFetch('/api/fitness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'weight', date, weight: w }),
      })
      load()
    } catch {}
  }

  async function addWater(ml) {
    const newVal = Math.max(0, waterMl + ml)
    setWaterMl(newVal)
    try {
      await apiFetch('/api/fitness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'water', date, water_ml: newVal }),
      })
    } catch {}
  }

  async function saveSettings(e) {
    e.preventDefault()
    setCalorieGoal(Number(settingsForm.calorie_goal))
    setTargetWeight(settingsForm.target_weight ? Number(settingsForm.target_weight) : null)
    setShowSettings(false)
    try {
      await apiFetch('/api/fitness/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calorie_goal: Number(settingsForm.calorie_goal), target_weight: settingsForm.target_weight ? Number(settingsForm.target_weight) : null }),
      })
    } catch {}
  }

  function fillQuickFood(food) {
    setMealForm(f => ({ ...f, name: food.name, calories: food.cal, protein: food.p, fat: food.f, carbs: food.c }))
    setQuickSearch('')
  }

  const filteredQuick = quickSearch.length > 0
    ? QUICK_FOODS.filter(f => f.name.toLowerCase().includes(quickSearch.toLowerCase()))
    : []

  // ── Styles from theme ─────────────────────────────────────────
  const card   = { background: t?.card || 'rgba(255,255,255,0.05)', border: `1px solid ${t?.cardBorder || 'rgba(255,255,255,0.08)'}`, borderRadius: 16, padding: '16px' }
  const text   = t?.text || '#fff'
  const sub    = t?.textSub || '#888'
  const accent = t?.primary || '#fff'
  const bg     = t?.inputBg || 'rgba(255,255,255,0.05)'
  const bdr    = t?.cardBorder || 'rgba(255,255,255,0.1)'

  // ── Weight progress ───────────────────────────────────────────
  const currentW = weight || lastWeight
  const weightDiff = currentW && targetWeight ? (currentW - targetWeight).toFixed(1) : null
  const weightProgress = currentW && targetWeight && history.length > 1
    ? (() => {
        const startW = history.filter(h => h.weight).sort((a,b) => a.date.localeCompare(b.date))[0]?.weight
        if (!startW) return 0
        const total = Math.abs(startW - targetWeight)
        const done  = Math.abs(startW - currentW)
        return total > 0 ? Math.min((done / total) * 100, 100) : 0
      })()
    : 0

  return (
    <div style={{ padding: '0 0 100px', maxWidth: 600, margin: '0 auto' }}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div style={{ padding: '20px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: text }}>
            Фитнес
          </div>
          <div style={{ color: sub, fontSize: 13, marginTop: 2 }}>
            {isToday ? 'Сегодня' : formatDate(date)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: '8px 10px', color: text, fontSize: 13, colorScheme: 'dark', outline: 'none', cursor: 'pointer' }}
          />
          <button onClick={() => setShowSettings(true)} style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: '8px 10px', color: sub, fontSize: 18, cursor: 'pointer', lineHeight: 1 }}>⚙</button>
        </div>
      </div>

      {/* ── TABS ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', margin: '0 16px 16px', gap: 8 }}>
        {['today', 'history'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: '9px', borderRadius: 12, border: `1px solid ${activeTab === tab ? accent : bdr}`, background: activeTab === tab ? `${accent}18` : 'transparent', color: activeTab === tab ? accent : sub, fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }}>
            {tab === 'today' ? '📊 Сегодня' : '📈 История'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: sub }}>Загрузка...</div>
      ) : activeTab === 'today' ? (
        <>
          {/* ── CALORIE RING ─────────────────────────────────────── */}
          <div style={{ ...card, margin: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Circle progress */}
            <div style={{ position: 'relative', flexShrink: 0, width: 100, height: 100 }}>
              <svg viewBox="0 0 100 100" style={{ width: 100, height: 100, transform: 'rotate(-90deg)' }}>
                <circle cx="50" cy="50" r="42" fill="none" stroke={bdr} strokeWidth="8"/>
                <circle cx="50" cy="50" r="42" fill="none" stroke={accent} strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - calPct / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: text, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{totalCal}</div>
                <div style={{ fontSize: 10, color: sub }}>ккал</div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: sub }}>Цель</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: text }}>{calorieGoal} ккал</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: sub }}>Осталось</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: calorieGoal - totalCal < 0 ? '#FF4466' : '#44FF88' }}>
                  {Math.max(0, calorieGoal - totalCal)} ккал
                </span>
              </div>
              {/* Macros */}
              <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                {[['Б', totalP, '#5BC0DE'], ['Ж', totalF, '#F0A30A'], ['У', totalC, '#8B5CF6']].map(([l, v, c]) => (
                  <div key={l} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{Math.round(v)}</div>
                    <div style={{ fontSize: 10, color: sub, marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── WEIGHT & WATER ROW ─────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, margin: '0 16px 12px' }}>
            {/* Weight */}
            <div onClick={() => { setWeightInput(currentW || ''); setShowWeightForm(true) }}
              style={{ ...card, flex: 1, cursor: 'pointer', textAlign: 'center', transition: 'opacity 0.2s', padding: '14px 12px' }}>
              <div style={{ fontSize: 24 }}>⚖️</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: text, fontFamily: 'var(--font-display)', lineHeight: 1.2, marginTop: 4 }}>
                {currentW ? `${currentW}` : '—'}
              </div>
              <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>кг</div>
              {weightDiff !== null && targetWeight && (
                <div style={{ fontSize: 11, color: Number(weightDiff) > 0 ? '#FF4466' : '#44FF88', marginTop: 4, fontWeight: 600 }}>
                  {Number(weightDiff) > 0 ? `+${weightDiff}` : weightDiff} до цели
                </div>
              )}
            </div>

            {/* Water */}
            <div style={{ ...card, flex: 1, textAlign: 'center', padding: '14px 12px' }}>
              <div style={{ fontSize: 24 }}>💧</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: text, fontFamily: 'var(--font-display)', lineHeight: 1.2, marginTop: 4 }}>
                {waterMl}
              </div>
              <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>мл / 2000</div>
              <div style={{ marginTop: 8, height: 4, borderRadius: 4, background: bdr, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${waterPct}%`, background: '#5BC0DE', borderRadius: 4, transition: 'width 0.4s ease' }} />
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, justifyContent: 'center' }}>
                {[200, 300, 500].map(ml => (
                  <button key={ml} onClick={() => addWater(ml)}
                    style={{ background: 'rgba(91,192,222,0.15)', border: '1px solid rgba(91,192,222,0.3)', borderRadius: 8, padding: '4px 8px', color: '#5BC0DE', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    +{ml}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── WEIGHT GOAL PROGRESS ───────────────────────────── */}
          {targetWeight && currentW && (
            <div style={{ ...card, margin: '0 16px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: text, fontWeight: 600 }}>Цель по весу</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>
                  {currentW} → {targetWeight} кг
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 8, background: bdr, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${weightProgress}%`, background: `linear-gradient(90deg, ${accent}, #44FF88)`, borderRadius: 8, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ color: sub, fontSize: 12, marginTop: 6 }}>{Math.round(weightProgress)}% выполнено</div>
            </div>
          )}

          {/* ── MEALS ────────────────────────────────────────────── */}
          {mealsByType.map(({ key, label, emoji, items }) => (
            <div key={key} style={{ ...card, margin: '0 16px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: items.length > 0 ? 10 : 0 }}>
                <span style={{ color: text, fontWeight: 600, fontSize: 14 }}>{emoji} {label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {items.length > 0 && (
                    <span style={{ color: sub, fontSize: 12 }}>
                      {items.reduce((s, i) => s + i.calories, 0)} ккал
                    </span>
                  )}
                  <button onClick={() => { setMealForm(f => ({ ...f, meal_type: key })); setShowMealForm(true) }}
                    style={{ background: `${accent}18`, border: `1px solid ${accent}30`, borderRadius: 8, padding: '4px 10px', color: accent, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    + добавить
                  </button>
                </div>
              </div>
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${bdr}` }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: text, fontWeight: 500 }}>{item.name}</div>
                    {(item.protein || item.fat || item.carbs) > 0 && (
                      <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>
                        Б{Math.round(item.protein||0)} · Ж{Math.round(item.fat||0)} · У{Math.round(item.carbs||0)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: accent, marginRight: 12 }}>{item.calories}</span>
                  <button onClick={() => deleteMeal(item.id)}
                    style={{ background: 'none', border: 'none', color: sub, cursor: 'pointer', fontSize: 16, padding: 4, opacity: 0.5 }}>✕</button>
                </div>
              ))}
            </div>
          ))}
        </>
      ) : (
        /* ── HISTORY TAB ───────────────────────────────────────── */
        <div style={{ padding: '0 16px' }}>
          <div style={{ ...card, marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 14 }}>📈 Вес (30 дней)</div>
            {history.filter(h => h.weight).length === 0 ? (
              <div style={{ textAlign: 'center', color: sub, padding: '20px 0' }}>Нет данных. Начни вводить вес каждый день!</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                {(() => {
                  const pts = history.filter(h => h.weight).slice(-20)
                  const min = Math.min(...pts.map(p => p.weight)) - 1
                  const max = Math.max(...pts.map(p => p.weight)) + 1
                  return pts.map((p, i) => {
                    const h = ((p.weight - min) / (max - min)) * 70 + 10
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <div style={{ width: '100%', height: h, background: accent, borderRadius: 4, opacity: 0.7 + i / pts.length * 0.3, minHeight: 10 }} title={`${p.weight} кг — ${formatDate(p.date)}`} />
                      </div>
                    )
                  })
                })()}
              </div>
            )}
          </div>

          <div style={{ ...card }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 14 }}>📊 Калории по дням</div>
            {history.filter(h => h.calories > 0).length === 0 ? (
              <div style={{ textAlign: 'center', color: sub, padding: '20px 0' }}>Нет данных о калориях.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {history.filter(h => h.calories > 0).slice(-7).reverse().map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, color: sub, width: 60, flexShrink: 0 }}>{formatDate(d.date)}</span>
                    <div style={{ flex: 1, height: 20, background: bdr, borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min((d.calories / calorieGoal) * 100, 100)}%`, background: d.calories > calorieGoal ? '#FF4466' : accent, borderRadius: 6, transition: 'width 0.4s' }} />
                    </div>
                    <span style={{ fontSize: 12, color: text, fontWeight: 600, width: 50, textAlign: 'right', flexShrink: 0 }}>{d.calories}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ADD MEAL MODAL ────────────────────────────────────── */}
      {showMealForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 800, display: 'flex', alignItems: 'flex-end', padding: 0 }} onClick={() => setShowMealForm(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: t?.bg || '#0c0c0c', borderRadius: '20px 20px 0 0', border: `1px solid ${bdr}`, padding: '20px 16px 40px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: text }}>Добавить приём пищи</div>
              <button onClick={() => setShowMealForm(false)} style={{ background: 'none', border: 'none', color: sub, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            {/* Quick search */}
            <div style={{ marginBottom: 14 }}>
              <input placeholder="🔍 Быстрый поиск еды..." value={quickSearch} onChange={e => setQuickSearch(e.target.value)}
                style={{ width: '100%', background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 14px', color: text, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              {filteredQuick.length > 0 && (
                <div style={{ marginTop: 6, borderRadius: 10, border: `1px solid ${bdr}`, overflow: 'hidden' }}>
                  {filteredQuick.map((f, i) => (
                    <div key={i} onClick={() => fillQuickFood(f)}
                      style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: bg, borderTop: i > 0 ? `1px solid ${bdr}` : 'none' }}>
                      <span style={{ color: text, fontSize: 13 }}>{f.name}</span>
                      <span style={{ color: accent, fontSize: 13, fontWeight: 600 }}>{f.cal} ккал</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={addMeal} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Meal type */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MEAL_TYPES.map(mt => (
                  <button key={mt.key} type="button" onClick={() => setMealForm(f => ({ ...f, meal_type: mt.key }))}
                    style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${mealForm.meal_type === mt.key ? accent : bdr}`, background: mealForm.meal_type === mt.key ? `${accent}18` : 'transparent', color: mealForm.meal_type === mt.key ? accent : sub, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {mt.emoji} {mt.label}
                  </button>
                ))}
              </div>

              <input required placeholder="Название блюда" value={mealForm.name} onChange={e => setMealForm(f => ({ ...f, name: e.target.value }))}
                style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: '11px 14px', color: text, fontSize: 14, outline: 'none' }} />
              <input required placeholder="Калории (ккал)" type="number" value={mealForm.calories} onChange={e => setMealForm(f => ({ ...f, calories: e.target.value }))}
                style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: '11px 14px', color: text, fontSize: 14, outline: 'none' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[['protein', 'Белки (г)', '#5BC0DE'], ['fat', 'Жиры (г)', '#F0A30A'], ['carbs', 'Углеводы (г)', '#8B5CF6']].map(([key, ph, c]) => (
                  <input key={key} placeholder={ph} type="number" value={mealForm[key]} onChange={e => setMealForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 12px', color: c, fontSize: 13, outline: 'none' }} />
                ))}
              </div>
              <button type="submit"
                style={{ background: accent, border: 'none', borderRadius: 12, padding: '13px', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', marginTop: 4 }}>
                Добавить
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── WEIGHT INPUT MODAL ──────────────────────────────── */}
      {showWeightForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowWeightForm(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: t?.bg || '#0c0c0c', borderRadius: 20, border: `1px solid ${bdr}`, padding: '28px 24px', width: '100%', maxWidth: 300, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⚖️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 16 }}>Введи свой вес</div>
            <input autoFocus type="number" step="0.1" placeholder="70.5" value={weightInput} onChange={e => setWeightInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveWeight() } }}
              style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 12, padding: '14px 16px', color: text, fontSize: 22, fontWeight: 700, outline: 'none', textAlign: 'center', width: '100%', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 14, color: sub, marginTop: 6, marginBottom: 16 }}>кг</div>
            <button onClick={saveWeight}
              style={{ background: accent, border: 'none', borderRadius: 12, padding: '12px 0', color: '#000', fontWeight: 700, fontSize: 15, cursor: 'pointer', width: '100%' }}>
              Сохранить
            </button>
          </div>
        </div>
      )}

      {/* ── SETTINGS MODAL ──────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowSettings(false)}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: t?.bg || '#0c0c0c', borderRadius: 20, border: `1px solid ${bdr}`, padding: '28px 24px', width: '100%', maxWidth: 360 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 20 }}>⚙️ Настройки фитнеса</div>
            <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: sub, marginBottom: 6 }}>Цель по калориям (ккал)</label>
                <input type="number" value={settingsForm.calorie_goal} onChange={e => setSettingsForm(f => ({ ...f, calorie_goal: e.target.value }))}
                  style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 14px', color: text, fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: sub, marginBottom: 6 }}>Целевой вес (кг)</label>
                <input type="number" step="0.1" placeholder="Например: 70" value={settingsForm.target_weight} onChange={e => setSettingsForm(f => ({ ...f, target_weight: e.target.value }))}
                  style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 14px', color: text, fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowSettings(false)}
                  style={{ flex: 1, background: 'transparent', border: `1px solid ${bdr}`, borderRadius: 12, padding: '12px', color: sub, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  Отмена
                </button>
                <button type="submit"
                  style={{ flex: 1, background: accent, border: 'none', borderRadius: 12, padding: '12px', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
