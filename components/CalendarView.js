'use client'
// ╔═══════════════════════════════════════════════════════════════════╗
// ║  CHRONICLE — CALENDAR VIEW                                        ║
// ║  Dark minimal calendar with task deadline indicators              ║
// ╚═══════════════════════════════════════════════════════════════════╝

import { useState, useMemo } from 'react'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
]

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate()
  )
}

function startOfMonth(year, month) {
  const d = new Date(year, month, 1)
  // Monday-based: getDay() 0=Sun → 6, 1=Mon → 0 …
  let dow = d.getDay() - 1
  if (dow < 0) dow = 6
  return { firstDay: d, offset: dow }
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

export default function CalendarView({ tasks = [], theme = {}, onClose }) {
  const t = theme

  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selected,  setSelected]  = useState(null) // Date | null

  // ── Build deadline map: "YYYY-MM-DD" → task[]
  const deadlineMap = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      if (!task.due_date) return
      const d = new Date(task.due_date)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!map[key]) map[key] = []
      map[key].push(task)
    })
    return map
  }, [tasks])

  function getTasksForDate(d) {
    return deadlineMap[`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`] || []
  }

  // ── Navigate
  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelected(null)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
    setSelected(null)
  }

  // ── Build grid cells
  const { offset } = startOfMonth(viewYear, viewMonth)
  const totalDays   = daysInMonth(viewYear, viewMonth)
  const cells = []

  for (let i = 0; i < offset; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(new Date(viewYear, viewMonth, d))

  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  // ── Selected day tasks
  const selectedTasks = selected ? getTasksForDate(selected) : []

  const primary = t.primary || '#F54B64'
  const bg      = t.bg      || '#030407'
  const card    = t.card    || 'rgba(255,255,255,0.028)'
  const border  = t.cardBorder || 'rgba(255,255,255,0.07)'
  const text    = t.text    || '#ffffff'
  const textSub = t.textSub || '#7a7a9a'
  const danger  = t.danger  || '#FF4466'
  const success = t.success || '#00E887'

  const PRIORITY_COLOR = { high: danger, medium: '#F0A30A', low: success }

  function getDaysLeft(due) {
    if (!due) return null
    return Math.ceil((new Date(due) - new Date()) / 86400000)
  }

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.sheet, background: bg, borderColor: border }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={S.header}>
          <button style={{ ...S.navBtn, color: textSub, borderColor: border }} onClick={prevMonth}>‹</button>

          <div style={{ textAlign: 'center' }}>
            <div style={{ ...S.monthTitle, color: text }}>
              {MONTHS[viewMonth]}
            </div>
            <div style={{ ...S.yearLabel, color: textSub }}>{viewYear}</div>
          </div>

          <button style={{ ...S.navBtn, color: textSub, borderColor: border }} onClick={nextMonth}>›</button>

          {onClose && (
            <button style={{ ...S.closeBtn, color: textSub }} onClick={onClose}>✕</button>
          )}
        </div>

        {/* ── Weekday labels ── */}
        <div style={S.weekRow}>
          {WEEKDAYS.map(day => (
            <div key={day} style={{ ...S.weekLabel, color: textSub }}>{day}</div>
          ))}
        </div>

        {/* ── Day grid ── */}
        <div style={S.grid}>
          {cells.map((date, i) => {
            if (!date) return <div key={`empty-${i}`} style={S.emptyCell} />

            const isToday   = isSameDay(date, today)
            const isSel     = selected && isSameDay(date, selected)
            const dayTasks  = getTasksForDate(date)
            const hasTasks  = dayTasks.length > 0
            const hasOverdue = dayTasks.some(tk => !tk.completed && getDaysLeft(tk.due_date) < 0)
            const hasDue    = dayTasks.some(tk => !tk.completed && getDaysLeft(tk.due_date) === 0)

            let dotColor = primary
            if (hasOverdue) dotColor = danger
            else if (hasDue) dotColor = '#F0A30A'

            return (
              <button
                key={date.toISOString()}
                style={{
                  ...S.dayCell,
                  background: isSel
                    ? `${primary}22`
                    : isToday
                    ? `${primary}11`
                    : 'transparent',
                  borderColor: isSel
                    ? `${primary}88`
                    : isToday
                    ? `${primary}33`
                    : 'transparent',
                  color: isSel ? primary : isToday ? primary : text,
                  fontWeight: isToday || isSel ? 700 : 400,
                }}
                onClick={() => setSelected(isSel ? null : date)}
              >
                <span style={{ lineHeight: 1, fontSize: 13 }}>{date.getDate()}</span>

                {hasTasks && (
                  <div style={{ ...S.dots }}>
                    {dayTasks.slice(0, 3).map((tk, di) => (
                      <div
                        key={di}
                        style={{
                          ...S.dot,
                          background: tk.completed ? textSub : (PRIORITY_COLOR[tk.priority] || primary),
                          opacity: tk.completed ? 0.3 : 1,
                        }}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <div style={{ ...S.dot, background: dotColor, opacity: 0.5 }} />
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* ── Selected day panel ── */}
        {selected && (
          <div style={{ ...S.dayPanel, borderColor: border }}>
            <div style={{ ...S.dayPanelTitle, color: textSub }}>
              {selected.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}
            </div>

            {selectedTasks.length === 0 ? (
              <div style={{ ...S.emptyDay, color: textSub }}>
                Задач нет — день свободен ✦
              </div>
            ) : (
              <div style={S.taskList}>
                {selectedTasks.map(tk => {
                  const days = getDaysLeft(tk.due_date)
                  return (
                    <div
                      key={tk.id}
                      style={{
                        ...S.taskRow,
                        background: `${PRIORITY_COLOR[tk.priority] || primary}0d`,
                        borderColor: `${PRIORITY_COLOR[tk.priority] || primary}33`,
                        opacity: tk.completed ? 0.45 : 1,
                      }}
                    >
                      <div
                        style={{
                          ...S.taskDot,
                          background: PRIORITY_COLOR[tk.priority] || primary,
                          boxShadow: `0 0 8px ${PRIORITY_COLOR[tk.priority] || primary}66`,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          ...S.taskTitle,
                          color: text,
                          textDecoration: tk.completed ? 'line-through' : 'none',
                        }}>
                          {tk.title}
                        </div>
                        {tk.folder_name && (
                          <div style={{ ...S.taskFolder, color: textSub }}>{tk.folder_name}</div>
                        )}
                      </div>
                      <div style={{
                        ...S.taskBadge,
                        color: tk.completed ? textSub : (days < 0 ? danger : days === 0 ? '#F0A30A' : textSub),
                        borderColor: 'currentColor',
                      }}>
                        {tk.completed ? '✓' : days === 0 ? 'сегодня' : days < 0 ? `−${Math.abs(days)}д` : `+${days}д`}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Legend ── */}
        <div style={{ ...S.legend, borderColor: border }}>
          {[
            { color: success,     label: 'Низкий приоритет' },
            { color: '#F0A30A',   label: 'Средний' },
            { color: danger,      label: 'Высокий / просрочено' },
          ].map(item => (
            <div key={item.label} style={S.legendItem}>
              <div style={{ ...S.legendDot, background: item.color }} />
              <span style={{ color: textSub, fontSize: 11 }}>{item.label}</span>
            </div>
          ))}
        </div>

      </div>

      <style>{CAL_CSS}</style>
    </div>
  )
}

// ── Inline styles (non-dynamic)
const S = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(6px)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    overflowY: 'auto',
  },
  sheet: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 24,
    border: '1px solid',
    overflow: 'hidden',
    backdropFilter: 'blur(32px)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 20px 12px',
    position: 'relative',
  },
  monthTitle: {
    fontFamily: "'Orbitron', monospace",
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  yearLabel: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: '0.2em',
    marginTop: 2,
  },
  navBtn: {
    background: 'none',
    border: '1px solid',
    borderRadius: 10,
    width: 36, height: 36,
    cursor: 'pointer',
    fontSize: 18,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.15s',
    fontFamily: 'monospace',
  },
  closeBtn: {
    position: 'absolute', right: 20, top: 16,
    background: 'none', border: 'none',
    cursor: 'pointer', fontSize: 16,
    padding: 4, opacity: 0.5,
    transition: 'opacity 0.2s',
  },
  weekRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    padding: '0 16px',
  },
  weekLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: 'monospace',
    letterSpacing: '0.08em',
    padding: '4px 0 8px',
    textTransform: 'uppercase',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 3,
    padding: '0 16px 12px',
  },
  emptyCell: {
    aspectRatio: '1',
  },
  dayCell: {
    aspectRatio: '1',
    border: '1px solid',
    borderRadius: 10,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    fontFamily: 'monospace',
    transition: 'all 0.15s ease',
    minWidth: 0,
    padding: 2,
    background: 'none',
  },
  dots: {
    display: 'flex',
    gap: 2,
    alignItems: 'center',
  },
  dot: {
    width: 4, height: 4,
    borderRadius: '50%',
    flexShrink: 0,
  },
  dayPanel: {
    borderTop: '1px solid',
    padding: '16px 20px',
    maxHeight: 280,
    overflowY: 'auto',
  },
  dayPanelTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyDay: {
    textAlign: 'center',
    fontSize: 13,
    padding: '16px 0',
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  taskRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    borderRadius: 12,
    border: '1px solid',
  },
  taskDot: {
    width: 8, height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  taskFolder: {
    fontSize: 11,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  taskBadge: {
    fontFamily: 'monospace',
    fontSize: 10,
    letterSpacing: '0.06em',
    padding: '2px 8px',
    borderRadius: 99,
    border: '1px solid',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  legend: {
    display: 'flex',
    gap: 16,
    padding: '12px 20px 16px',
    borderTop: '1px solid',
    flexWrap: 'wrap',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7, height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
}

const CAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700&display=swap');

  /* Calendar button reset */
  .cal-day-btn { -webkit-tap-highlight-color: transparent; }
  .cal-day-btn:active { transform: scale(0.93); }

  @media (max-width: 480px) {
    /* Make month title smaller on tiny screens */
    .cal-month-title { font-size: 14px !important; }
  }
`
