'use client'
import { useState, useEffect } from 'react'

// ── Система достижений ─────────────────────────────────────────────
const ACHIEVEMENTS = [
  // ── Первые шаги ──
  {
    id: 'first_habit',   category: 'start',
    icon: '🌱', title: 'Первый росток',
    desc: 'Создай свою первую привычку',
    check: ({ habits }) => habits.length >= 1,
    progress: ({ habits }) => ({ cur: Math.min(habits.length, 1), max: 1 }),
  },
  {
    id: 'first_done',    category: 'start',
    icon: '✅', title: 'Первый шаг',
    desc: 'Выполни привычку первый раз',
    check: ({ totalDone }) => totalDone >= 1,
    progress: ({ totalDone }) => ({ cur: Math.min(totalDone, 1), max: 1 }),
  },

  // ── Серии ──
  {
    id: 'streak_3',      category: 'streak',
    icon: '🔥', title: 'Искра',
    desc: 'Серия 3 дня подряд',
    check: ({ maxStreak }) => maxStreak >= 3,
    progress: ({ maxStreak }) => ({ cur: Math.min(maxStreak, 3), max: 3 }),
  },
  {
    id: 'streak_7',      category: 'streak',
    icon: '🔥', title: 'Неделя огня',
    desc: 'Серия 7 дней подряд',
    check: ({ maxStreak }) => maxStreak >= 7,
    progress: ({ maxStreak }) => ({ cur: Math.min(maxStreak, 7), max: 7 }),
  },
  {
    id: 'streak_14',     category: 'streak',
    icon: '💫', title: 'Две недели',
    desc: 'Серия 14 дней подряд',
    check: ({ maxStreak }) => maxStreak >= 14,
    progress: ({ maxStreak }) => ({ cur: Math.min(maxStreak, 14), max: 14 }),
  },
  {
    id: 'streak_30',     category: 'streak',
    icon: '🌙', title: 'Месяц силы',
    desc: 'Серия 30 дней подряд',
    check: ({ maxStreak }) => maxStreak >= 30,
    progress: ({ maxStreak }) => ({ cur: Math.min(maxStreak, 30), max: 30 }),
  },
  {
    id: 'streak_100',    category: 'streak',
    icon: '⚡', title: 'Легенда',
    desc: 'Серия 100 дней подряд',
    check: ({ maxStreak }) => maxStreak >= 100,
    progress: ({ maxStreak }) => ({ cur: Math.min(maxStreak, 100), max: 100 }),
  },
  {
    id: 'streak_365',    category: 'streak',
    icon: '👑', title: 'Бессмертный',
    desc: 'Серия целый год',
    check: ({ maxStreak }) => maxStreak >= 365,
    progress: ({ maxStreak }) => ({ cur: Math.min(maxStreak, 365), max: 365 }),
  },

  // ── Выполнения ──
  {
    id: 'done_10',       category: 'count',
    icon: '💪', title: 'В ритме',
    desc: 'Выполни привычки 10 раз суммарно',
    check: ({ totalDone }) => totalDone >= 10,
    progress: ({ totalDone }) => ({ cur: Math.min(totalDone, 10), max: 10 }),
  },
  {
    id: 'done_50',       category: 'count',
    icon: '🏃', title: 'Марафонец',
    desc: 'Выполни привычки 50 раз суммарно',
    check: ({ totalDone }) => totalDone >= 50,
    progress: ({ totalDone }) => ({ cur: Math.min(totalDone, 50), max: 50 }),
  },
  {
    id: 'done_100',      category: 'count',
    icon: '🏆', title: 'Сотня',
    desc: 'Выполни привычки 100 раз суммарно',
    check: ({ totalDone }) => totalDone >= 100,
    progress: ({ totalDone }) => ({ cur: Math.min(totalDone, 100), max: 100 }),
  },
  {
    id: 'done_365',      category: 'count',
    icon: '🌟', title: 'Посвящённый',
    desc: 'Выполни привычки 365 раз суммарно',
    check: ({ totalDone }) => totalDone >= 365,
    progress: ({ totalDone }) => ({ cur: Math.min(totalDone, 365), max: 365 }),
  },

  // ── Коллекционер ──
  {
    id: 'habits_3',      category: 'variety',
    icon: '🌿', title: 'Коллекционер',
    desc: 'Создай 3 разные привычки',
    check: ({ habits }) => habits.length >= 3,
    progress: ({ habits }) => ({ cur: Math.min(habits.length, 3), max: 3 }),
  },
  {
    id: 'habits_5',      category: 'variety',
    icon: '🌳', title: 'Архитект жизни',
    desc: 'Создай 5 разных привычек',
    check: ({ habits }) => habits.length >= 5,
    progress: ({ habits }) => ({ cur: Math.min(habits.length, 5), max: 5 }),
  },

  // ── Перфекционизм ──
  {
    id: 'all_today',     category: 'perfect',
    icon: '⭐', title: 'Идеальный день',
    desc: 'Выполни все привычки за один день',
    check: ({ allDoneToday }) => allDoneToday,
    progress: ({ habits, doneToday }) => ({ cur: doneToday, max: Math.max(habits.length, 1) }),
  },
  {
    id: 'all_week',      category: 'perfect',
    icon: '🌟', title: 'Идеальная неделя',
    desc: 'Идеальный день 7 раз подряд',
    check: ({ perfectDays }) => perfectDays >= 7,
    progress: ({ perfectDays }) => ({ cur: Math.min(perfectDays || 0, 7), max: 7 }),
  },

  // ── Секретные ──
  {
    id: 'night_owl',     category: 'secret',
    icon: '🦉', title: '???',
    desc: 'Секретное достижение',
    secretDesc: 'Открой приложение после полуночи',
    check: ({ isNight }) => isNight,
    progress: () => ({ cur: 0, max: 1 }),
  },
]

const CATEGORY_LABELS = {
  start:   { label: 'Начало',        icon: '🌱' },
  streak:  { label: 'Серии',         icon: '🔥' },
  count:   { label: 'Выполнения',    icon: '💪' },
  variety: { label: 'Разнообразие',  icon: '🌿' },
  perfect: { label: 'Перфекционизм', icon: '⭐' },
  secret:  { label: 'Секретные',     icon: '🔒' },
}

const CATEGORY_ORDER = ['start', 'streak', 'count', 'variety', 'perfect', 'secret']

// ── Компонент ─────────────────────────────────────────────────────────────────
export default function AchievementsPage({ t }) {
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')

  useEffect(() => {
    fetch('/api/habits')
      .then(r => r.json())
      .then(d => { setHabits(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // ── Вычисляем статистику ──
  const maxStreak   = habits.reduce((m, h) => Math.max(m, h.streak || 0), 0)
  const totalDone   = habits.reduce((s, h) => s + (h.total_done || 0), 0)
  const doneToday   = habits.filter(h => h.done_today).length
  const allDoneToday = habits.length > 0 && habits.every(h => h.done_today)
  const isNight     = new Date().getHours() >= 0 && new Date().getHours() < 5
  const perfectDays = habits.length > 0
    ? Math.min(...habits.map(h => h.streak || 0))
    : 0

  const stats = { habits, maxStreak, totalDone, doneToday, allDoneToday, isNight, perfectDays }

  const unlocked = ACHIEVEMENTS.filter(a => a.check(stats))
  const unlockedIds = new Set(unlocked.map(a => a.id))

  // ── Фильтрация ──
  const filtered = ACHIEVEMENTS.filter(a =>
    selectedCategory === 'all' || a.category === selectedCategory
  )

  const categories = [
    { id: 'all', label: 'Все', icon: '◈' },
    ...CATEGORY_ORDER.map(c => ({ id: c, ...CATEGORY_LABELS[c] }))
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background: t.bg }}>

      {/* ── Шапка ── */}
      <header style={{
        padding:'16px 20px 0', borderBottom:`1px solid ${t.cardBorder}`, flexShrink:0
      }}>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:12 }}>
          <span style={{ fontSize:20, fontWeight:800, color: t.text }}>Достижения</span>
          <span style={{ fontSize:12, color: t.textMuted, fontFamily:'var(--font-mono)' }}>
            {unlocked.length}/{ACHIEVEMENTS.length}
          </span>
        </div>

        {/* Прогресс-бар */}
        <div style={{ marginBottom:14 }}>
          <div style={{ height:4, borderRadius:4, background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
            <div style={{
              height:'100%', borderRadius:4, transition:'width 0.8s ease',
              width: `${ACHIEVEMENTS.length > 0 ? (unlocked.length/ACHIEVEMENTS.length)*100 : 0}%`,
              background: 'linear-gradient(90deg, rgba(255,255,255,0.4), rgba(255,255,255,0.8))'
            }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
            <span style={{ fontSize:10, color: t.textMuted }}>
              {Math.round(unlocked.length/ACHIEVEMENTS.length*100)}% открыто
            </span>
            <span style={{ fontSize:10, color: t.textMuted }}>
              {ACHIEVEMENTS.length - unlocked.length} осталось
            </span>
          </div>
        </div>

        {/* Быстрая статистика */}
        <div style={{ display:'flex', gap:8, marginBottom:14, overflowX:'auto',
          scrollbarWidth:'none', paddingBottom:2 }}>
          {[
            { label: 'Макс. серия', value: `${maxStreak}🔥`, color: '#F0A30A' },
            { label: 'Выполнено', value: totalDone, color: t.success },
            { label: 'Привычек', value: habits.length, color: '#8B5CF6' },
          ].map(s => (
            <div key={s.label} style={{
              background: t.card, border:`1px solid ${t.cardBorder}`,
              borderRadius:12, padding:'8px 14px', flexShrink:0, textAlign:'center'
            }}>
              <div style={{ fontSize:15, fontWeight:700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize:10, color: t.textMuted, marginTop:1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Фильтр-табы */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', scrollbarWidth:'none',
          paddingBottom:1, marginLeft:-4, paddingLeft:4 }}>
          {categories.map(c => {
            const catUnlocked = c.id === 'all'
              ? unlocked.length
              : ACHIEVEMENTS.filter(a => a.category === c.id && unlockedIds.has(a.id)).length
            const catTotal = c.id === 'all'
              ? ACHIEVEMENTS.length
              : ACHIEVEMENTS.filter(a => a.category === c.id).length
            return (
              <button key={c.id} onClick={() => setSelectedCategory(c.id)}
                style={{
                  background: selectedCategory === c.id
                    ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${selectedCategory === c.id
                    ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius:20, padding:'5px 12px',
                  color: selectedCategory === c.id ? t.text : t.textMuted,
                  fontSize:12, fontWeight: selectedCategory === c.id ? 600 : 400,
                  cursor:'pointer', whiteSpace:'nowrap', fontFamily:'inherit',
                  display:'flex', alignItems:'center', gap:5, flexShrink:0,
                  transition:'all .15s'
                }}>
                <span>{c.icon}</span>
                <span>{c.label}</span>
                <span style={{ fontSize:10, color: catUnlocked === catTotal ? '#44ff88' : t.textMuted }}>
                  {catUnlocked}/{catTotal}
                </span>
              </button>
            )
          })}
        </div>
      </header>

      {/* ── Список достижений ── */}
      <div style={{ flex:1, overflowY:'auto', padding:'12px 16px 100px',
        scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.15) transparent' }}>

        {loading ? (
          <div style={{ textAlign:'center', color: t.textMuted, paddingTop:60, fontSize:13 }}>
            Загрузка...
          </div>
        ) : (
          CATEGORY_ORDER
            .filter(cat => selectedCategory === 'all' || selectedCategory === cat)
            .map(cat => {
              const catAchs = filtered.filter(a => a.category === cat)
              if (catAchs.length === 0) return null
              return (
                <div key={cat} style={{ marginBottom:24 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8,
                    marginBottom:10, paddingLeft:2 }}>
                    <span style={{ fontSize:14 }}>{CATEGORY_LABELS[cat].icon}</span>
                    <span style={{ fontSize:11, fontWeight:700, color: t.textSub,
                      letterSpacing:'0.1em', textTransform:'uppercase',
                      fontFamily:'var(--font-mono)' }}>
                      {CATEGORY_LABELS[cat].label}
                    </span>
                  </div>

                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {catAchs.map(ach => {
                      const done = unlockedIds.has(ach.id)
                      const prog = ach.progress(stats)
                      const pct  = Math.min((prog.cur / prog.max) * 100, 100)
                      const isSecret = ach.category === 'secret' && !done

                      return (
                        <div key={ach.id} style={{
                          background: done
                            ? 'rgba(255,255,255,0.07)'
                            : 'rgba(255,255,255,0.025)',
                          border: `1px solid ${done
                            ? 'rgba(255,255,255,0.18)'
                            : 'rgba(255,255,255,0.06)'}`,
                          borderRadius:16, padding:'14px 16px',
                          transition:'all .2s',
                          opacity: done ? 1 : 0.7,
                        }}>
                          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                            {/* Иконка */}
                            <div style={{
                              width:44, height:44, borderRadius:12, flexShrink:0,
                              background: done
                                ? 'rgba(255,255,255,0.1)'
                                : 'rgba(255,255,255,0.04)',
                              border:`1px solid ${done
                                ? 'rgba(255,255,255,0.2)'
                                : 'rgba(255,255,255,0.06)'}`,
                              display:'flex', alignItems:'center', justifyContent:'center',
                              fontSize:22,
                              filter: done ? 'none' : 'grayscale(1)',
                            }}>
                              {isSecret ? '🔒' : ach.icon}
                            </div>

                            {/* Текст */}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <span style={{ fontSize:14, fontWeight:600,
                                  color: done ? t.text : t.textSub }}>
                                  {isSecret ? '???' : ach.title}
                                </span>
                                {done && (
                                  <span style={{ fontSize:10, color:'#44ff88',
                                    background:'rgba(68,255,136,0.1)',
                                    borderRadius:6, padding:'2px 7px',
                                    fontFamily:'var(--font-mono)', fontWeight:600 }}>
                                    ✓ Открыто
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize:12, color: t.textMuted, marginTop:3,
                                lineHeight:1.4 }}>
                                {ach.desc}
                              </div>

                              {/* Прогресс-бар */}
                              {!done && prog.max > 1 && (
                                <div style={{ marginTop:8 }}>
                                  <div style={{ height:3, borderRadius:3,
                                    background:'rgba(255,255,255,0.07)', overflow:'hidden' }}>
                                    <div style={{
                                      height:'100%', borderRadius:3,
                                      width:`${pct}%`,
                                      background:'rgba(255,255,255,0.35)',
                                      transition:'width 0.6s ease'
                                    }} />
                                  </div>
                                  <div style={{ fontSize:10, color: t.textMuted, marginTop:3 }}>
                                    {prog.cur} / {prog.max}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })
        )}
      </div>
    </div>
  )
}
