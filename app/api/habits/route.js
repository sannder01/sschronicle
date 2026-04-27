'use client'
// ╔══════════════════════════════════════════════════════╗
// ║  HABIT TRACKER — Chronicle Engine v1.0              ║
// ║  Streak tracking · Daily check-off · Progress view  ║
// ╚══════════════════════════════════════════════════════╝

import { useState, useEffect, useCallback } from 'react'

const FREQ_LABELS = { daily: 'Ежедневно', weekly: 'Еженедельно' }
const FREQ_ICONS  = { daily: '📅', weekly: '📆' }

const PALETTE = [
  '#8B5CF6', '#F54B64', '#5CB85C', '#F0A30A',
  '#5BC0DE', '#FF6B9D', '#F97316', '#06B6D4',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLastNDays(n) {
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today - i * 86400000)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function formatDateShort(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MiniCalendar({ habitId, doneToday, color }) {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    fetch(`/api/habits/${habitId}/log`)
      .then(r => r.json())
      .then(data => setHistory(new Set(data.dates || [])))
      .catch(() => setHistory(new Set()))
  }, [habitId, doneToday])

  const days = getLastNDays(28)

  if (!history) return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 8 }}>
      {days.map(d => (
        <div key={d} style={{
          width: 14, height: 14, borderRadius: 3,
          background: 'rgba(255,255,255,0.05)',
        }} />
      ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 10 }}>
      {days.map(d => {
        const done = history.has(d)
        const isToday = d === todayISO()
        return (
          <div key={d} title={formatDateShort(d)} style={{
            width: 14, height: 14, borderRadius: 3,
            background: done ? color : 'rgba(255,255,255,0.07)',
            boxShadow: done ? `0 0 6px ${color}60` : 'none',
            border: isToday ? `1.5px solid ${color}` : '1.5px solid transparent',
            transition: 'background 0.2s',
            cursor: 'default',
          }} />
        )
      })}
    </div>
  )
}

function HabitCard({ habit, t, onToggle, onDelete, expanded, onExpand }) {
  const done = habit.done_today
  const streak = habit.streak || 0
  const color = habit.color || '#8B5CF6'

  return (
    <div style={{
      background: t.card,
      border: `1px solid ${done ? color + '44' : t.cardBorder}`,
      borderRadius: 14,
      padding: '14px 16px',
      transition: 'all 0.2s',
      boxShadow: done ? `0 0 20px ${color}15` : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Check button */}
        <button
          onClick={onToggle}
          style={{
            width: 32, height: 32, borderRadius: 8, border: 'none',
            background: done ? color : 'transparent',
            boxShadow: done ? `0 0 12px ${color}60` : `inset 0 0 0 2px ${color}`,
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, transition: 'all 0.18s',
          }}
          title={done ? 'Отметить как невыполненное' : 'Отметить как выполненное'}
        >
          {done ? '✓' : ''}
        </button>

        {/* Name & meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: t.text, fontWeight: 600, fontSize: 14,
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: `${color}80`,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {habit.name}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 3 }}>
            <span style={{ fontSize: 11, color: t.textSub }}>
              {FREQ_ICONS[habit.frequency]} {FREQ_LABELS[habit.frequency] || habit.frequency}
            </span>
            {streak > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: '#FF8C00',
                background: 'rgba(255,140,0,0.12)',
                borderRadius: 6, padding: '1px 7px',
              }}>
                🔥 {streak} дн.
              </span>
            )}
          </div>
        </div>

        {/* Expand + delete */}
        <button onClick={onExpand} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: t.textMuted, fontSize: 16, padding: '4px 6px',
          borderRadius: 6, transition: 'color 0.15s',
        }}>
          {expanded ? '▲' : '▼'}
        </button>
        <button onClick={onDelete} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: t.textMuted, fontSize: 14, padding: '4px 6px',
          borderRadius: 6, transition: 'color 0.15s',
        }}>
          ✕
        </button>
      </div>

      {/* Mini calendar */}
      {expanded && (
        <MiniCalendar habitId={habit.id} doneToday={done} color={color} />
      )}
    </div>
  )
}

function CreateHabitForm({ t, onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', description: '', frequency: 'daily', color: '#8B5CF6' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Введите название привычки'); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Ошибка'); setLoading(false); return }
      const created = await res.json()
      onCreate(created)
      onClose()
    } catch {
      setError('Ошибка сети')
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: t.card,
      border: `1px solid ${t.cardBorderHover}`,
      borderRadius: 16, padding: '20px',
      boxShadow: `0 0 40px ${t.glow}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ color: t.textSub, fontWeight: 600, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>
          Новая привычка
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: t.textMuted,
          cursor: 'pointer', fontSize: 16,
        }}>✕</button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ display: 'block', color: t.textSub, fontSize: 11, marginBottom: 5, letterSpacing: 0.5 }}>
            НАЗВАНИЕ *
          </label>
          <input
            autoFocus
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Например: Медитация, Зарядка, Чтение..."
            maxLength={60}
            style={{
              width: '100%', background: t.inputBg, border: `1px solid ${t.cardBorder}`,
              borderRadius: 10, padding: '10px 14px', color: t.text,
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', color: t.textSub, fontSize: 11, marginBottom: 5, letterSpacing: 0.5 }}>
            ОПИСАНИЕ (необязательно)
          </label>
          <input
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="Зачем вам эта привычка?"
            style={{
              width: '100%', background: t.inputBg, border: `1px solid ${t.cardBorder}`,
              borderRadius: 10, padding: '10px 14px', color: t.text,
              fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ display: 'block', color: t.textSub, fontSize: 11, marginBottom: 5, letterSpacing: 0.5 }}>
              ЧАСТОТА
            </label>
            <select
              value={form.frequency}
              onChange={e => setForm({ ...form, frequency: e.target.value })}
              style={{
                width: '100%', background: t.inputBg, border: `1px solid ${t.cardBorder}`,
                borderRadius: 10, padding: '10px 14px', color: t.text,
                fontSize: 14, outline: 'none', cursor: 'pointer',
              }}
            >
              <option value="daily">📅 Ежедневно</option>
              <option value="weekly">📆 Еженедельно</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', color: t.textSub, fontSize: 11, marginBottom: 5, letterSpacing: 0.5 }}>
              ЦВЕТ
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 4 }}>
              {PALETTE.map(c => (
                <div
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  style={{
                    width: 22, height: 22, borderRadius: 6,
                    background: c, cursor: 'pointer',
                    border: form.color === c ? '2px solid #fff' : '2px solid transparent',
                    boxShadow: form.color === c ? `0 0 8px ${c}80` : 'none',
                    transition: 'all 0.15s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(255,50,80,0.08)', border: '1px solid rgba(255,50,80,0.2)',
            borderRadius: 8, padding: '8px 12px', color: '#ff8899', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{
            flex: 1, background: 'none', border: `1px solid ${t.cardBorder}`,
            borderRadius: 10, padding: '10px', color: t.textSub,
            cursor: 'pointer', fontSize: 14, fontWeight: 500,
          }}>
            Отмена
          </button>
          <button type="submit" disabled={loading} style={{
            flex: 1, border: 'none',
            background: `linear-gradient(135deg, ${form.color}, ${form.color}bb)`,
            borderRadius: 10, padding: '10px', color: '#fff',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14, fontWeight: 600, opacity: loading ? 0.7 : 1,
          }}>
            {loading ? '...' : 'Создать'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function HabitTracker({ t, onClose }) {
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  const loadHabits = useCallback(async () => {
    try {
      const res = await fetch('/api/habits')
      if (res.ok) {
        const data = await res.json()
        setHabits(Array.isArray(data) ? data : [])
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { loadHabits() }, [loadHabits])

  async function toggleHabit(habit) {
    try {
      const res = await fetch(`/api/habits/${habit.id}/log`, { method: 'POST' })
      if (!res.ok) return
      const { done } = await res.json()
      setHabits(prev => prev.map(h =>
        h.id === habit.id
          ? { ...h, done_today: done, streak: done ? (h.streak || 0) + 1 : Math.max(0, (h.streak || 0) - 1) }
          : h
      ))
    } catch {}
  }

  async function deleteHabit(id) {
    try {
      await fetch(`/api/habits/${id}`, { method: 'DELETE' })
      setHabits(prev => prev.filter(h => h.id !== id))
      setDeleteConfirm(null)
    } catch {}
  }

  const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long' })
  const doneCount = habits.filter(h => h.done_today).length

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px 16px', overflowY: 'auto',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 560,
        background: t.bg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: `0 0 80px ${t.glow}`,
        marginTop: 40,
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: `1px solid ${t.cardBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ color: t.text, fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>
              🔥 Habit Tracker
            </div>
            <div style={{ color: t.textSub, fontSize: 12, marginTop: 3 }}>
              {today} · {doneCount}/{habits.length} выполнено сегодня
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  background: `linear-gradient(135deg, ${t.primary}, ${t.primaryEnd})`,
                  border: 'none', borderRadius: 10, padding: '8px 16px',
                  color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  boxShadow: `0 4px 16px ${t.glow}`,
                }}
              >
                + Привычка
              </button>
            )}
            <button onClick={onClose} style={{
              background: 'none', border: `1px solid ${t.cardBorder}`,
              borderRadius: 10, padding: '8px 12px',
              color: t.textMuted, cursor: 'pointer', fontSize: 16,
            }}>✕</button>
          </div>
        </div>

        {/* Progress bar */}
        {habits.length > 0 && (
          <div style={{ padding: '12px 24px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              flex: 1, height: 6, background: t.surface, borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${habits.length ? (doneCount / habits.length) * 100 : 0}%`,
                background: `linear-gradient(90deg, ${t.primary}, ${t.primaryEnd})`,
                borderRadius: 3, transition: 'width 0.4s ease',
                boxShadow: `0 0 8px ${t.glow}`,
              }} />
            </div>
            <span style={{ color: t.textSub, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {habits.length ? Math.round((doneCount / habits.length) * 100) : 0}%
            </span>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Create form */}
          {showForm && (
            <CreateHabitForm
              t={t}
              onClose={() => setShowForm(false)}
              onCreate={habit => setHabits(prev => [...prev, habit])}
            />
          )}

          {/* Delete confirmation */}
          {deleteConfirm && (
            <div style={{
              background: 'rgba(255,50,80,0.08)',
              border: '1px solid rgba(255,50,80,0.25)',
              borderRadius: 14, padding: '16px',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            }}>
              <span style={{ color: t.text, flex: 1, fontSize: 14 }}>
                Удалить привычку «{deleteConfirm.name}»?
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setDeleteConfirm(null)} style={{
                  background: 'none', border: `1px solid ${t.cardBorder}`,
                  borderRadius: 8, padding: '7px 14px', color: t.textSub,
                  cursor: 'pointer', fontSize: 13,
                }}>Отмена</button>
                <button onClick={() => deleteHabit(deleteConfirm.id)} style={{
                  background: 'rgba(255,50,80,0.15)', border: '1px solid rgba(255,50,80,0.3)',
                  borderRadius: 8, padding: '7px 14px', color: '#ff6680',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>Удалить</button>
              </div>
            </div>
          )}

          {/* Habit list */}
          {loading ? (
            <div style={{ color: t.textSub, textAlign: 'center', padding: '40px 0', fontSize: 14 }}>
              Загрузка...
            </div>
          ) : habits.length === 0 && !showForm ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔥</div>
              <div style={{ color: t.text, fontWeight: 600, marginBottom: 6 }}>Нет привычек</div>
              <div style={{ color: t.textSub, fontSize: 13, marginBottom: 20 }}>
                Добавьте первую привычку и начните формировать стрик!
              </div>
              <button onClick={() => setShowForm(true)} style={{
                background: `linear-gradient(135deg, ${t.primary}, ${t.primaryEnd})`,
                border: 'none', borderRadius: 12, padding: '10px 24px',
                color: '#fff', fontWeight: 600, cursor: 'pointer',
                boxShadow: `0 4px 20px ${t.glow}`,
              }}>
                + Создать первую привычку
              </button>
            </div>
          ) : (
            habits.map(habit => (
              <HabitCard
                key={habit.id}
                habit={habit}
                t={t}
                onToggle={() => toggleHabit(habit)}
                onDelete={() => setDeleteConfirm(habit)}
                expanded={expanded === habit.id}
                onExpand={() => setExpanded(expanded === habit.id ? null : habit.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
