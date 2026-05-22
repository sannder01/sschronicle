'use client'
// ╔══════════════════════════════════════════════════════╗
// ║  HABIT TRACKER — Chronicle Engine v1.1              ║
// ║  Streak · Daily check-off · Custom day schedule     ║
// ╚══════════════════════════════════════════════════════╝

import { useState, useEffect, useCallback } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

const PALETTE = [
  '#8B5CF6', '#F54B64', '#5CB85C', '#F0A30A',
  '#5BC0DE', '#FF6B9D', '#F97316', '#06B6D4',
]

// Days: 0=Пн … 6=Вс  (ISO weekday - 1)
const DAY_LABELS  = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const DAY_LABELS_FULL = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']
const WORKDAYS = [0,1,2,3,4]
const WEEKEND  = [5,6]
const ALL_DAYS = [0,1,2,3,4,5,6]

// ── Helpers ───────────────────────────────────────────────────────────────────

function todayISO() { return new Date().toISOString().slice(0, 10) }

function getLastNDays(n) {
  const days = []
  const today = new Date(); today.setHours(0,0,0,0)
  for (let i = n-1; i >= 0; i--) {
    const d = new Date(today - i * 86400000)
    days.push(d.toISOString().slice(0,10))
  }
  return days
}

function formatDateShort(iso) {
  return new Date(iso+'T00:00:00').toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit' })
}

/** Return 0-based weekday index (0=Пн) for a given ISO date string */
function isoToWeekday(iso) {
  const d = new Date(iso + 'T00:00:00')
  return (d.getDay() + 6) % 7  // JS getDay: 0=Sun → convert to 0=Mon
}

function parseDays(habit) {
  if (habit.frequency === 'daily') return ALL_DAYS
  try {
    const d = habit.days
    if (Array.isArray(d)) return d
    if (typeof d === 'string') return JSON.parse(d)
  } catch {}
  return ALL_DAYS
}

function scheduleLabel(habit) {
  if (habit.frequency === 'daily') return '📅 Ежедневно'
  const days = parseDays(habit)
  if (!days || days.length === 0) return '📅 Ежедневно'
  if (days.length === 7) return '📅 Ежедневно'
  if (JSON.stringify([...days].sort()) === JSON.stringify([0,1,2,3,4])) return '💼 Будни'
  if (JSON.stringify([...days].sort()) === JSON.stringify([5,6])) return '🛋 Выходные'
  return days.map(i => DAY_LABELS[i]).join(', ')
}

// ── DayPicker ─────────────────────────────────────────────────────────────────

function DayPicker({ selected, onChange, color, t }) {
  function toggle(i) {
    if (selected.includes(i)) {
      if (selected.length === 1) return   // нельзя убрать все
      onChange(selected.filter(d => d !== i))
    } else {
      onChange([...selected, i].sort((a,b)=>a-b))
    }
  }

  return (
    <div>
      {/* Preset buttons */}
      <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
        {[
          { label:'Все',      days: ALL_DAYS },
          { label:'Будни',    days: WORKDAYS },
          { label:'Выходные', days: WEEKEND  },
        ].map(p => {
          const active = JSON.stringify([...selected].sort()) === JSON.stringify([...p.days].sort())
          return (
            <button key={p.label} type="button"
              onClick={() => onChange(p.days)}
              style={{
                fontSize:11, padding:'4px 10px', borderRadius:8, cursor:'pointer', fontWeight:600,
                border: active ? `1.5px solid ${color}` : `1px solid ${t.cardBorder}`,
                background: active ? `${color}22` : 'transparent',
                color: active ? color : t.textSub,
                transition:'all 0.15s',
              }}>
              {p.label}
            </button>
          )
        })}
      </div>

      {/* Day toggles */}
      <div style={{ display:'flex', gap:6 }}>
        {DAY_LABELS.map((label, i) => {
          const on = selected.includes(i)
          const isWeekend = i >= 5
          return (
            <button key={i} type="button" onClick={() => toggle(i)}
              style={{
                flex:1, padding:'7px 0', borderRadius:8, cursor:'pointer',
                fontWeight: on ? 700 : 400, fontSize:12,
                border: on ? `1.5px solid ${color}` : `1px solid ${t.cardBorder}`,
                background: on ? `${color}22` : 'transparent',
                color: on ? color : isWeekend ? t.textMuted : t.textSub,
                transition:'all 0.15s',
                boxShadow: on ? `0 0 8px ${color}40` : 'none',
              }}>
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── MiniCalendar ──────────────────────────────────────────────────────────────

function MiniCalendar({ habitId, doneToday, color, scheduledDays }) {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    fetch(`/api/habits/${habitId}/log`)
      .then(r => r.json())
      .then(data => setHistory(new Set(data.dates || [])))
      .catch(() => setHistory(new Set()))
  }, [habitId, doneToday])

  const days = getLastNDays(28)

  if (!history) return (
    <div style={{ display:'flex', gap:3, flexWrap:'wrap', marginTop:8 }}>
      {days.map(d => (
        <div key={d} style={{ width:14, height:14, borderRadius:3, background:'rgba(255,255,255,0.05)' }} />
      ))}
    </div>
  )

  return (
    <div style={{ marginTop:10 }}>
      {/* Weekday header */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:3 }}>
        {DAY_LABELS.map(l => (
          <div key={l} style={{ fontSize:9, color:'rgba(255,255,255,0.25)', textAlign:'center' }}>{l}</div>
        ))}
      </div>

      {/* Calendar grid — always 4 weeks × 7 days */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
        {days.map(d => {
          const done = history.has(d)
          const isToday = d === todayISO()
          const wd = isoToWeekday(d)
          const scheduled = scheduledDays.includes(wd)
          return (
            <div key={d} title={`${formatDateShort(d)}${done ? ' ✓' : ''}`} style={{
              height:14, borderRadius:3,
              background: done
                ? color
                : scheduled ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)',
              boxShadow: done ? `0 0 6px ${color}60` : 'none',
              border: isToday ? `1.5px solid ${color}99` : '1.5px solid transparent',
              opacity: !scheduled && !done ? 0.35 : 1,
              transition:'background 0.2s',
            }} />
          )
        })}
      </div>
    </div>
  )
}

// ── HabitCard ─────────────────────────────────────────────────────────────────

function HabitCard({ habit, t, onToggle, onDelete, expanded, onExpand, onMoveUp, onMoveDown, isFirst, isLast }) {
  const done  = habit.done_today
  const streak = habit.streak || 0
  const color  = habit.color || '#8B5CF6'
  const scheduledDays = parseDays(habit)
  const todayWd = isoToWeekday(todayISO())
  const scheduledToday = scheduledDays.includes(todayWd)

  return (
    <div style={{
      background: t.card,
      border: `1px solid ${done ? color+'44' : scheduledToday ? t.cardBorder : t.cardBorder+'88'}`,
      borderRadius:14, padding:'14px 16px',
      transition:'all 0.2s',
      boxShadow: done ? `0 0 20px ${color}15` : 'none',
      opacity: scheduledToday ? 1 : 0.65,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>

        {/* Check button */}
        <button onClick={onToggle} style={{
          width:32, height:32, borderRadius:8, border:'none',
          background: done ? color : 'transparent',
          boxShadow: done ? `0 0 12px ${color}60` : `inset 0 0 0 2px ${color}`,
          cursor:'pointer', flexShrink:0,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:16, transition:'all 0.18s',
        }} title={done ? 'Отметить как невыполненное' : 'Отметить как выполненное'}>
          {done ? '✓' : ''}
        </button>

        {/* Name & meta */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{
            color: t.text, fontWeight:600, fontSize:14,
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: `${color}80`,
            whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
          }}>
            {habit.name}
            {!scheduledToday && (
              <span style={{ marginLeft:6, fontSize:10, color:t.textMuted, fontWeight:400 }}>
                (не сегодня)
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:3, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:t.textSub }}>
              {scheduleLabel(habit)}
            </span>
            {streak > 0 && (
              <span style={{
                fontSize:11, fontWeight:700, color:'#FF8C00',
                background:'rgba(255,140,0,0.12)', borderRadius:6, padding:'1px 7px',
              }}>
                🔥 {streak} дн.
              </span>
            )}
          </div>
        </div>

        {/* Move up / down */}
        <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
          <button onClick={onMoveUp} disabled={isFirst} title="Вверх" style={{
            background:'none', border:'none', cursor: isFirst ? 'default' : 'pointer',
            color: isFirst ? 'transparent' : t.textMuted,
            fontSize:10, padding:'2px 5px', lineHeight:1, borderRadius:4,
            transition:'color 0.15s',
          }}>▲</button>
          <button onClick={onMoveDown} disabled={isLast} title="Вниз" style={{
            background:'none', border:'none', cursor: isLast ? 'default' : 'pointer',
            color: isLast ? 'transparent' : t.textMuted,
            fontSize:10, padding:'2px 5px', lineHeight:1, borderRadius:4,
            transition:'color 0.15s',
          }}>▼</button>
        </div>

        {/* Expand / delete */}
        <button onClick={onExpand} style={{
          background:'none', border:'none', cursor:'pointer',
          color:t.textMuted, fontSize:16, padding:'4px 6px', borderRadius:6,
        }}>
          {expanded ? '▲' : '▼'}
        </button>
        <button onClick={onDelete} style={{
          background:'none', border:'none', cursor:'pointer',
          color:t.textMuted, fontSize:14, padding:'4px 6px', borderRadius:6,
        }}>
          ✕
        </button>
      </div>

      {/* Mini calendar */}
      {expanded && (
        <MiniCalendar
          habitId={habit.id}
          doneToday={done}
          color={color}
          scheduledDays={scheduledDays}
        />
      )}
    </div>
  )
}

// ── CreateHabitForm ───────────────────────────────────────────────────────────

function CreateHabitForm({ t, onClose, onCreate }) {
  const [form, setForm] = useState({
    name: '', description: '',
    frequency: 'daily',
    days: ALL_DAYS,
    color: '#8B5CF6',
  })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Введите название привычки'); return }
    if (form.frequency === 'custom' && form.days.length === 0) {
      setError('Выберите хотя бы один день'); return
    }
    setError(''); setLoading(true)
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description || null,
        frequency:   form.frequency,
        days:        form.frequency === 'custom' ? form.days : null,
        color:       form.color,
      }
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Ошибка'); setLoading(false); return }
      const created = await res.json()
      onCreate(created); onClose()
    } catch { setError('Ошибка сети'); setLoading(false) }
  }

  const inputStyle = {
    width:'100%', background:t.inputBg, border:`1px solid ${t.cardBorder}`,
    borderRadius:10, padding:'10px 14px', color:t.text,
    fontSize:14, outline:'none', boxSizing:'border-box',
  }
  const labelStyle = { display:'block', color:t.textSub, fontSize:11, marginBottom:5, letterSpacing:0.5 }

  return (
    <div style={{
      background:t.card, border:`1px solid ${t.cardBorderHover}`,
      borderRadius:16, padding:'20px',
      boxShadow:`0 0 40px ${t.glow}`,
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <span style={{ color:t.textSub, fontWeight:600, fontSize:12, letterSpacing:1, textTransform:'uppercase' }}>
          Новая привычка
        </span>
        <button onClick={onClose} style={{ background:'none', border:'none', color:t.textMuted, cursor:'pointer', fontSize:16 }}>✕</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>

        {/* Name */}
        <div>
          <label style={labelStyle}>НАЗВАНИЕ *</label>
          <input autoFocus value={form.name}
            onChange={e => setForm({...form, name:e.target.value})}
            placeholder="Медитация, Зарядка, Чтение..."
            maxLength={60} style={inputStyle}
          />
        </div>

        {/* Description */}
        <div>
          <label style={labelStyle}>ОПИСАНИЕ (необязательно)</label>
          <input value={form.description}
            onChange={e => setForm({...form, description:e.target.value})}
            placeholder="Зачем вам эта привычка?"
            style={inputStyle}
          />
        </div>

        {/* Frequency selector */}
        <div>
          <label style={labelStyle}>РАСПИСАНИЕ</label>
          <div style={{ display:'flex', gap:8, marginBottom: form.frequency==='custom' ? 10 : 0 }}>
            {[
              { val:'daily',  icon:'📅', label:'Каждый день' },
              { val:'custom', icon:'📆', label:'По дням'     },
            ].map(opt => {
              const active = form.frequency === opt.val
              return (
                <button key={opt.val} type="button"
                  onClick={() => setForm({...form, frequency:opt.val, days: opt.val==='daily' ? ALL_DAYS : form.days})}
                  style={{
                    flex:1, padding:'10px', borderRadius:10, cursor:'pointer',
                    border: active ? `1.5px solid ${form.color}` : `1px solid ${t.cardBorder}`,
                    background: active ? `${form.color}18` : 'transparent',
                    color: active ? form.color : t.textSub,
                    fontWeight: active ? 600 : 400, fontSize:13,
                    transition:'all 0.15s',
                    boxShadow: active ? `0 0 12px ${form.color}30` : 'none',
                  }}>
                  {opt.icon} {opt.label}
                </button>
              )
            })}
          </div>

          {/* Day picker — shown only for 'custom' */}
          {form.frequency === 'custom' && (
            <DayPicker
              selected={form.days}
              onChange={days => setForm({...form, days})}
              color={form.color}
              t={t}
            />
          )}
        </div>

        {/* Color */}
        <div>
          <label style={labelStyle}>ЦВЕТ</label>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {PALETTE.map(c => (
              <div key={c} onClick={() => setForm({...form, color:c})}
                style={{
                  width:28, height:28, borderRadius:8, background:c, cursor:'pointer',
                  border: form.color===c ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: form.color===c ? `0 0 10px ${c}90` : 'none',
                  transition:'all 0.15s',
                }}
              />
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background:'rgba(255,50,80,0.08)', border:'1px solid rgba(255,50,80,0.2)',
            borderRadius:8, padding:'8px 12px', color:'#ff8899', fontSize:13,
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display:'flex', gap:10 }}>
          <button type="button" onClick={onClose} style={{
            flex:1, background:'none', border:`1px solid ${t.cardBorder}`,
            borderRadius:10, padding:'10px', color:t.textSub, cursor:'pointer', fontSize:14, fontWeight:500,
          }}>Отмена</button>
          <button type="submit" disabled={loading} style={{
            flex:1, border:'none',
            background:`linear-gradient(135deg, ${form.color}, ${form.color}bb)`,
            borderRadius:10, padding:'10px', color:'#fff',
            cursor:loading ? 'not-allowed' : 'pointer',
            fontSize:14, fontWeight:600, opacity:loading ? 0.7 : 1,
            boxShadow:`0 4px 16px ${form.color}40`,
          }}>
            {loading ? '...' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HabitTracker({ t, onClose, onHabitComplete }) {
  const [habits,        setHabits]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showForm,      setShowForm]      = useState(false)
  const [expanded,      setExpanded]      = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadHabits = useCallback(async () => {
    try {
      const res = await fetch('/api/habits')
      if (res.ok) setHabits(await res.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadHabits() }, [loadHabits])

  async function toggleHabit(habit) {
    try {
      const res = await fetch(`/api/habits/${habit.id}/log`, { method:'POST' })
      if (!res.ok) return
      const { done } = await res.json()
      setHabits(prev => prev.map(h =>
        h.id === habit.id
          ? { ...h, done_today:done, streak: done ? (h.streak||0)+1 : Math.max(0,(h.streak||0)-1) }
          : h
      ))
      if (onHabitComplete) onHabitComplete(done ? 10 : -10)
    } catch {}
  }

  async function moveHabit(index, direction) {
    const next = [...habits]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setHabits(next) // оптимистичное обновление
    try {
      const res = await fetch('/api/habits/order', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: next.map(h => h.id) }),
      })
      if (!res.ok) setHabits(habits) // откат при ошибке
    } catch {
      setHabits(habits) // откат при сетевой ошибке
    }
  }

  async function deleteHabit(id) {
    try {
      await fetch(`/api/habits/${id}`, { method:'DELETE' })
      setHabits(prev => prev.filter(h => h.id !== id))
      setDeleteConfirm(null)
    } catch {}
  }

  const today       = new Date().toLocaleDateString('ru-RU', { day:'2-digit', month:'long' })
  const todayWd     = isoToWeekday(todayISO())
  const todayHabits = habits.filter(h => parseDays(h).includes(todayWd))
  const doneCount   = todayHabits.filter(h => h.done_today).length

  // ── Inline mode: when onClose is not provided (e.g. embedded inside a page)
  // render as a normal section instead of a fixed-position modal overlay.
  // The modal overlay was crashing because onClose() would be called on backdrop
  // click but onClose was undefined when rendered inline.
  const isInline = !onClose

  const bodyContent = (
    <>
      {/* Header */}
      <div style={{
        padding: isInline ? '0 16px 12px' : '20px 24px 16px',
        borderBottom:`1px solid ${t.cardBorder}`,
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div>
          <div style={{ color:t.text, fontWeight:800, fontSize:20, letterSpacing:-0.5 }}>
            🔥 Habit Tracker
          </div>
          <div style={{ color:t.textSub, fontSize:12, marginTop:3 }}>
            {today} · {doneCount}/{todayHabits.length} выполнено сегодня
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {!showForm && (
            <button onClick={() => setShowForm(true)} style={{
              background: t.primary === '#ffffff' ? '#fff' : `linear-gradient(135deg, ${t.primary}, ${t.primaryEnd||t.primary})`,
              border:'none', borderRadius:10, padding:'8px 16px',
              color: t.primary === '#ffffff' ? '#000' : '#fff',
              fontWeight:600, fontSize:13, cursor:'pointer',
            }}>
              + Привычка
            </button>
          )}
          {/* Only render close button in modal mode */}
          {onClose && (
            <button onClick={onClose} style={{
              background:'none', border:`1px solid ${t.cardBorder}`,
              borderRadius:10, padding:'8px 12px',
              color:t.textSub, cursor:'pointer', fontSize:16,
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {todayHabits.length > 0 && (
        <div style={{ padding:'12px 24px 0', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1, height:6, background:t.surface||'rgba(255,255,255,0.06)', borderRadius:3, overflow:'hidden' }}>
            <div style={{
              height:'100%',
              width:`${todayHabits.length ? (doneCount/todayHabits.length)*100 : 0}%`,
              background: t.primary === '#ffffff'
                ? 'linear-gradient(90deg, #fff, #ccc)'
                : `linear-gradient(90deg, ${t.primary}, ${t.primaryEnd||t.primary})`,
              borderRadius:3, transition:'width 0.4s ease',
            }} />
          </div>
          <span style={{ color:t.textSub, fontSize:12, fontWeight:600, whiteSpace:'nowrap' }}>
            {todayHabits.length ? Math.round((doneCount/todayHabits.length)*100) : 0}%
          </span>
        </div>
      )}

      {/* Content */}
      <div style={{ padding:'16px 24px 24px', display:'flex', flexDirection:'column', gap:10 }}>

        {/* Create form */}
        {showForm && (
          <CreateHabitForm
            t={t}
            onClose={() => setShowForm(false)}
            onCreate={habit => setHabits(prev => [...prev, habit])}
          />
        )}

        {/* Delete confirm */}
        {deleteConfirm && (
          <div style={{
            background:'rgba(255,50,80,0.08)', border:'1px solid rgba(255,50,80,0.25)',
            borderRadius:14, padding:'16px',
            display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
          }}>
            <span style={{ color:t.text, flex:1, fontSize:14 }}>
              Удалить привычку «{deleteConfirm.name}»?
            </span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{
                background:'none', border:`1px solid ${t.cardBorder}`,
                borderRadius:8, padding:'7px 14px', color:t.textSub, cursor:'pointer', fontSize:13,
              }}>Отмена</button>
              <button onClick={() => deleteHabit(deleteConfirm.id)} style={{
                background:'rgba(255,50,80,0.15)', border:'1px solid rgba(255,50,80,0.3)',
                borderRadius:8, padding:'7px 14px', color:'#ff6680', cursor:'pointer', fontSize:13, fontWeight:600,
              }}>Удалить</button>
            </div>
          </div>
        )}

        {/* Habit list */}
        {loading ? (
          <div style={{ color:t.textSub, textAlign:'center', padding:'40px 0', fontSize:14 }}>
            Загрузка...
          </div>
        ) : habits.length===0 && !showForm ? (
          <div style={{ textAlign:'center', padding:'40px 0' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🔥</div>
            <div style={{ color:t.text, fontWeight:600, marginBottom:6 }}>Нет привычек</div>
            <div style={{ color:t.textSub, fontSize:13, marginBottom:20 }}>
              Добавьте первую привычку и начните формировать стрик!
            </div>
            <button onClick={() => setShowForm(true)} style={{
              background: t.primary === '#ffffff' ? '#fff' : `linear-gradient(135deg, ${t.primary}, ${t.primaryEnd||t.primary})`,
              border:'none', borderRadius:12, padding:'10px 24px',
              color: t.primary === '#ffffff' ? '#000' : '#fff',
              fontWeight:600, cursor:'pointer',
            }}>
              + Создать первую привычку
            </button>
          </div>
        ) : (
          habits.map((habit, index) => (
            <HabitCard key={habit.id} habit={habit} t={t}
              onToggle={() => toggleHabit(habit)}
              onDelete={() => setDeleteConfirm(habit)}
              expanded={expanded === habit.id}
              onExpand={() => setExpanded(expanded===habit.id ? null : habit.id)}
              onMoveUp={() => moveHabit(index, -1)}
              onMoveDown={() => moveHabit(index, 1)}
              isFirst={index === 0}
              isLast={index === habits.length - 1}
            />
          ))
        )}
      </div>
    </>
  )

  // Inline mode: render as a flat section without the modal overlay
  if (isInline) {
    return (
      <div style={{ width:'100%' }}>
        {bodyContent}
      </div>
    )
  }

  // Modal mode: wrap in fixed overlay backdrop
  return (
    <div style={{
      position:'fixed', inset:0, zIndex:300,
      background:'rgba(0,0,0,0.7)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'flex-start', justifyContent:'center',
      padding:'20px 16px', overflowY:'auto',
    }} onClick={e => { if (e.target===e.currentTarget && onClose) onClose() }}>
      <div style={{
        width:'100%', maxWidth:580,
        background:t.bg||'#0a0a0a', border:`1px solid ${t.cardBorder}`,
        borderRadius:20, overflow:'hidden',
        boxShadow:`0 0 80px ${t.glow}`,
        marginTop:40,
      }} onClick={e => e.stopPropagation()}>
        {bodyContent}
      </div>
    </div>
  )
}
