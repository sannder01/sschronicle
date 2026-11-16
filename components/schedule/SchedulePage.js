'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { useTasks } from '@/components/tasks/TasksContext'
import { Button, Dialog, Input, EmptyState, ErrorState } from '@/components/ui'
import Icon from '@/components/Icon'
import { ACCENTS } from '@/components/accents'
import { spring, project, rubberband, velocityTracker, useIndicator } from '@/components/motion'
import { api } from '@/lib/client'
import { addDays, todayInZone, weekday, displayDate } from '@/lib/dates'
import './schedule.css'

const HOUR = 72 // px per hour
const PPM = HOUR / 60 // px per minute
const DAY = 1440
const SNAP = 15
const MIN_LEN = 15
const DAY_PX = DAY * PPM

const fmt = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const parseTime = (value) => {
  const [h, m] = String(value || '')
    .split(':')
    .map(Number)
  return Number.isInteger(h) && Number.isInteger(m) ? h * 60 + m : null
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
const snap = (min, step = SNAP) => Math.round(min / step) * step
const round5 = (min) => Math.round(min / 5) * 5

function nowMinutes(timezone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  return get('hour') * 60 + get('minute')
}

function durationLabel(min, t) {
  const h = Math.floor(min / 60),
    m = min % 60
  if (!h) return t(`${m} мин`, `${m} min`)
  if (!m) return t(`${h} ч`, `${h} h`)
  return t(`${h} ч ${m} мин`, `${h} h ${m} min`)
}

/** Side-by-side columns for overlapping blocks (like a calendar day view). */
function layout(blocks) {
  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min || a.end_min - b.end_min),
    result = new Map()
  let cluster = [],
    columns = [],
    clusterEnd = -1
  const flush = () => {
    for (const id of cluster) result.get(id).cols = columns.length
    cluster = []
    columns = []
  }
  for (const block of sorted) {
    if (block.start_min >= clusterEnd) {
      flush()
      clusterEnd = -1
    }
    let col = columns.findIndex((end) => end <= block.start_min)
    if (col === -1) col = columns.push(0) - 1
    columns[col] = block.end_min
    clusterEnd = Math.max(clusterEnd, block.end_min)
    result.set(block.id, { col, cols: 1 })
    cluster.push(block.id)
  }
  flush()
  return result
}

export default function SchedulePage() {
  const { t, language, settings, notify } = useApp(),
    { tasks } = useTasks()
  const today = todayInZone(settings.timezone)
  const [day, setDay] = useState(today),
    [direction, setDirection] = useState(0),
    [blocks, setBlocks] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null),
    [editing, setEditing] = useState(null),
    [now, setNow] = useState(() => nowMinutes(settings.timezone))
  const scrollRef = useRef(null),
    gridRef = useRef(null),
    weekRef = useRef(null),
    ghostRef = useRef(null),
    elements = useRef(new Map()),
    live = useRef(new Map()), // id -> { y, h, anim } presentation values while moving
    blocksRef = useRef(blocks),
    gesture = useRef(null),
    suppressClick = useRef(false),
    request = useRef(0),
    keys = useRef(new Map()) // server id -> the temp key it was born with (no remount)
  blocksRef.current = blocks

  // ---------- data ----------
  // A load that overlaps an edit is stale: drop it and load again,
  // so an optimistic block is never wiped by an older server answer.
  const mutations = useRef(0)
  const mutate = async (call) => {
    mutations.current++
    try {
      return await call()
    } finally {
      mutations.current++
    }
  }
  const load = useCallback(async function run(target) {
    const current = ++request.current,
      seen = mutations.current
    setLoading(true)
    setError(null)
    try {
      const result = await api('/api/schedule?day=' + target)
      if (current !== request.current) return
      if (seen !== mutations.current) return run(target)
      setBlocks(result)
    } catch (err) {
      if (current === request.current) setError(err)
    } finally {
      if (current === request.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    load(day)
  }, [day, load])

  // live clock for the "now" line
  useEffect(() => {
    setNow(nowMinutes(settings.timezone))
    const id = setInterval(() => setNow(nowMinutes(settings.timezone)), 30000)
    return () => clearInterval(id)
  }, [settings.timezone])

  // Opening a day scrolls at once (no jump later): to "now" today, else to 8:00.
  // Once blocks arrive on another day, move to the first one — unless the user
  // has already touched the timeline.
  const view = useRef({ day: null, touched: false, settled: false })
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    view.current = { day, touched: false, settled: day === today }
    const target = day === today ? nowMinutes(settings.timezone) - 90 : 8 * 60 - 30
    el.scrollTo({ top: clamp(target, 0, DAY) * PPM, behavior: 'instant' })
  }, [day, today, settings.timezone])
  useEffect(() => {
    const el = scrollRef.current,
      v = view.current
    if (!el || loading || v.day !== day || v.touched || v.settled) return
    v.settled = true
    if (!blocks.length) return
    const first = Math.min(...blocks.map((b) => b.start_min))
    el.scrollTo({ top: clamp(first - 30, 0, DAY) * PPM, behavior: 'smooth' })
  }, [loading, day, blocks])
  const touchTimeline = () => (view.current.touched = true)

  const pending = useRef(new Map()) // temp id -> edits made before the POST returned
  const realId = (id) => {
    if (id >= 0) return id
    for (const [server, temp] of keys.current) if (temp === id) return server
    return id
  }
  async function save(id, changes, previous) {
    id = realId(id)
    setBlocks((list) => list.map((b) => (b.id === id ? { ...b, ...changes } : b)))
    if (id < 0) {
      pending.current.set(id, { ...pending.current.get(id), ...changes })
      return
    }
    try {
      const updated = await mutate(() =>
        api('/api/schedule/' + id, { method: 'PATCH', body: changes }),
      )
      setBlocks((list) => list.map((b) => (b.id === id ? updated : b)))
    } catch {
      if (previous) setBlocks((list) => list.map((b) => (b.id === id ? { ...previous, id } : b)))
      notify(t('Не удалось сохранить изменения', 'Could not save changes'), 'error')
    }
  }

  async function create(draft) {
    const temp = { ...draft, id: -Date.now(), done: false, day }
    setBlocks((list) => [...list, temp])
    try {
      const created = await mutate(() =>
        api('/api/schedule', {
          method: 'POST',
          body: {
            day,
            start_min: draft.start_min,
            end_min: draft.end_min,
            title: draft.title,
            note: draft.note || null,
            color: draft.color,
          },
        }),
      )
      keys.current.set(created.id, temp.id)
      const queued = pending.current.get(temp.id)
      pending.current.delete(temp.id)
      setBlocks((list) => list.map((b) => (b.id === temp.id ? { ...created, ...queued } : b)))
      if (queued) save(created.id, queued)
      return true
    } catch (err) {
      setBlocks((list) => list.filter((b) => b.id !== temp.id))
      notify(
        err?.message?.includes('60')
          ? t('В дне не больше 60 блоков', 'A day holds at most 60 blocks')
          : t('Не удалось добавить блок', 'Could not add the block'),
        'error',
      )
      return false
    }
  }

  async function remove(block) {
    block = { ...block, id: realId(block.id) }
    if (block.id < 0) return // still being created; it will be removable in a moment
    setBlocks((list) => list.filter((b) => b.id !== block.id))
    try {
      await mutate(() => api('/api/schedule/' + block.id, { method: 'DELETE' }))
    } catch {
      setBlocks((list) => [...list, block])
      notify(t('Не удалось удалить блок', 'Could not delete the block'), 'error')
    }
  }

  // ---------- day navigation ----------
  function goTo(next) {
    if (next === day) return
    setDirection(next > day ? 1 : -1)
    setDay(next)
  }
  const weekStart = addDays(day, -weekday(day)),
    week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  useIndicator(weekRef, '.week-day.selected', [day])

  // ---------- geometry ----------
  const contentY = (clientY) => {
    const rect = gridRef.current.getBoundingClientRect()
    return clientY - rect.top
  }
  const place = (id, y, h) => {
    const el = elements.current.get(id)
    if (!el) return
    if (y != null) el.style.transform = `translateY(${y}px)`
    if (h != null) el.style.height = `${h}px`
  }
  const setLabel = (id, start, end) => {
    const label = elements.current.get(id)?.querySelector('.block-time')
    if (label) label.textContent = `${fmt(start)} – ${fmt(end)}`
  }
  const showGhost = (start, end, col = 0, cols = 1) => {
    const g = ghostRef.current
    if (!g) return
    g.style.transform = `translateY(${start * PPM}px)`
    g.style.height = `${(end - start) * PPM}px`
    g.style.setProperty('--col', col)
    g.style.setProperty('--cols', cols)
    g.dataset.visible = 'true'
  }
  const hideGhost = () => {
    if (ghostRef.current) ghostRef.current.dataset.visible = 'false'
  }

  // auto-scroll while dragging near the scroller's edges
  const autoScroll = useRef(0)
  function edgeScroll(clientY) {
    const el = scrollRef.current,
      rect = el.getBoundingClientRect(),
      zone = 56
    let speed = 0
    if (clientY < rect.top + zone) speed = -((rect.top + zone - clientY) / zone) * 14
    else if (clientY > rect.bottom - zone) speed = ((clientY - (rect.bottom - zone)) / zone) * 14
    if (!speed) {
      cancelAnimationFrame(autoScroll.current)
      autoScroll.current = 0
      return
    }
    if (autoScroll.current) {
      gesture.current.scrollSpeed = speed
      return
    }
    gesture.current.scrollSpeed = speed
    const tick = () => {
      const g = gesture.current
      if (!g?.active) return (autoScroll.current = 0)
      el.scrollTop += g.scrollSpeed
      move(g.lastClientY)
      autoScroll.current = requestAnimationFrame(tick)
    }
    autoScroll.current = requestAnimationFrame(tick)
  }

  // ---------- gestures: move / resize / draw ----------
  function begin(e, kind, block) {
    if (e.button > 0 || editing) return
    const touch = e.pointerType === 'touch',
      el = e.currentTarget
    if (!touch) e.preventDefault() // no text selection while dragging with a mouse
    const g = {
      kind,
      id: block?.id,
      key: block ? (keys.current.get(block.id) ?? block.id) : null,
      block,
      pointerId: e.pointerId,
      el,
      touch,
      active: false,
      startClientY: e.clientY,
      lastClientY: e.clientY,
      startTime: performance.now(),
      tracker: velocityTracker(),
    }
    gesture.current = g
    if (touch && kind !== 'draw') {
      // iOS Calendar: press and hold to pick a block up, otherwise the page scrolls
      g.timer = setTimeout(() => activate(), 320)
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('touchmove', blockScroll, { passive: false })
  }

  function blockScroll(e) {
    if (gesture.current?.active) e.preventDefault()
  }

  function activate() {
    const g = gesture.current
    if (!g || g.active) return
    g.active = true
    try {
      g.el.setPointerCapture(g.pointerId)
    } catch {}
    const y = contentY(g.lastClientY)
    if (g.kind === 'draw') {
      g.anchor = clamp(Math.floor(y / PPM / SNAP) * SNAP, 0, DAY - MIN_LEN)
      return
    }
    const b = g.block,
      running = live.current.get(g.key)
    // interruptible: continue from what is on screen right now
    running?.anim?.stop()
    g.baseY = running?.y ?? b.start_min * PPM
    g.baseH = running?.h ?? (b.end_min - b.start_min) * PPM
    g.grab = y - g.baseY
    g.resizeGrab = y - (g.baseY + g.baseH)
    live.current.set(g.key, { y: g.baseY, h: g.baseH })
    const el = elements.current.get(g.key)
    if (el) el.dataset.lifted = 'true'
    document.body.classList.add('is-dragging')
    if (g.touch) navigator.vibrate?.(8)
  }

  function onMove(e) {
    const g = gesture.current
    if (!g || e.pointerId !== g.pointerId) return
    g.lastClientY = e.clientY
    const dist = Math.abs(e.clientY - g.startClientY)
    if (!g.active) {
      if (g.touch && g.kind !== 'draw') {
        if (dist > 8) cleanup() // it was a scroll, not a hold
        return
      }
      if (g.touch && g.kind === 'draw') return // touch on empty space: tap only
      if (dist < 4) return
      activate()
    }
    e.preventDefault()
    move(e.clientY)
    edgeScroll(e.clientY)
  }

  function move(clientY) {
    const g = gesture.current
    const y = contentY(clientY)
    g.tracker.add(y)
    if (g.kind === 'draw') {
      const cur = clamp(Math.round(y / PPM / SNAP) * SNAP, 0, DAY)
      const start = Math.min(g.anchor, cur),
        end = Math.max(g.anchor + SNAP, cur)
      g.range = [start, Math.min(end, DAY)]
      showGhost(...g.range)
      return
    }
    const b = g.block,
      len = b.end_min - b.start_min,
      state = live.current.get(g.key)
    if (g.kind === 'move') {
      let top = y - g.grab
      const max = DAY_PX - len * PPM
      if (top < 0) top = rubberband(top, HOUR * 2)
      else if (top > max) top = max + rubberband(top - max, HOUR * 2)
      state.y = top
      place(g.key, top)
      const s = clamp(snap(top / PPM), 0, DAY - len)
      setLabel(g.key, s, s + len)
      showGhost(
        s,
        s + len,
        g.el.style.getPropertyValue('--col'),
        g.el.style.getPropertyValue('--cols'),
      )
    } else {
      let h = y - g.resizeGrab - g.baseY
      const min = MIN_LEN * PPM,
        max = DAY_PX - g.baseY
      if (h < min) h = min + rubberband(h - min, HOUR)
      else if (h > max) h = max + rubberband(h - max, HOUR)
      state.h = h
      place(g.key, null, h)
      const end = clamp(snap(b.start_min + h / PPM), b.start_min + MIN_LEN, DAY)
      setLabel(g.key, b.start_min, end)
    }
  }

  function onUp(e) {
    const g = gesture.current
    if (!g || e.pointerId !== g.pointerId) return
    if (!g.active) {
      // a tap
      cleanup()
      if (g.kind === 'draw') {
        const y = contentY(e.clientY)
        const start = clamp(Math.floor(y / PPM / SNAP) * SNAP, 0, DAY - 60)
        openNew(start, start + 60)
      }
      return
    }
    suppressClick.current = true
    setTimeout(() => (suppressClick.current = false), 0)
    const velocity = g.tracker.velocity()
    cleanup()
    if (g.kind === 'draw') {
      hideGhost()
      if (g.range) openNew(...g.range)
      return
    }
    settle(g, velocity)
  }

  function onCancel(e) {
    const g = gesture.current
    if (!g || e.pointerId !== g.pointerId) return
    cleanup()
    if (g.active && g.kind !== 'draw') settle(g, 0, true)
    hideGhost()
  }

  function cleanup() {
    const g = gesture.current
    clearTimeout(g?.timer)
    cancelAnimationFrame(autoScroll.current)
    autoScroll.current = 0
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('touchmove', blockScroll)
    document.body.classList.remove('is-dragging')
    if (g) g.active = false
    gesture.current = null
  }

  /** Release: project the flick, snap, and hand the finger's velocity to a spring. */
  function settle(g, velocity, revert = false) {
    const b = g.block,
      state = live.current.get(g.key),
      el = elements.current.get(g.key),
      len = b.end_min - b.start_min
    if (el) delete el.dataset.lifted
    hideGhost()
    const bouncy = Math.abs(velocity) > 300
    if (g.kind === 'move') {
      const projected = state.y + project(velocity)
      const start = revert ? b.start_min : clamp(snap(projected / PPM), 0, DAY - len)
      const target = start * PPM
      setLabel(g.key, start, start + len)
      state.anim = spring({
        from: state.y,
        to: target,
        velocity,
        damping: bouncy ? 0.8 : 1,
        response: 0.35,
        onUpdate: (y) => {
          state.y = y
          place(g.key, y)
        },
        onComplete: () => live.current.delete(g.key),
      })
      if (start !== b.start_min) save(b.id, { start_min: start, end_min: start + len }, b)
    } else {
      const projected = state.h + project(velocity) * 0.5
      const end = revert
        ? b.end_min
        : clamp(snap(b.start_min + projected / PPM), b.start_min + MIN_LEN, DAY)
      setLabel(g.key, b.start_min, end)
      state.anim = spring({
        from: state.h,
        to: (end - b.start_min) * PPM,
        velocity,
        damping: bouncy ? 0.8 : 1,
        response: 0.35,
        onUpdate: (h) => {
          state.h = h
          place(g.key, null, h)
        },
        onComplete: () => live.current.delete(g.key),
      })
      if (end !== b.end_min) save(b.id, { end_min: end }, b)
    }
  }

  // keyboard: Alt+↑/↓ moves 15 min, Alt+Shift+↑/↓ changes the length
  function onBlockKey(e, b) {
    if (!e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const delta = e.key === 'ArrowUp' ? -SNAP : SNAP,
      len = b.end_min - b.start_min
    if (e.shiftKey) {
      const end = clamp(b.end_min + delta, b.start_min + MIN_LEN, DAY)
      if (end !== b.end_min) save(b.id, { end_min: end }, b)
    } else {
      const start = clamp(b.start_min + delta, 0, DAY - len)
      if (start !== b.start_min) save(b.id, { start_min: start, end_min: start + len }, b)
    }
  }

  // ---------- editor ----------
  function openNew(start, end) {
    setEditing({
      id: null,
      title: '',
      start: fmt(start),
      end: fmt(Math.min(end, DAY)),
      color: 'accent',
      note: '',
      done: false,
    })
  }
  function openEdit(b) {
    if (suppressClick.current) return
    setEditing({
      id: b.id,
      title: b.title,
      start: fmt(b.start_min),
      end: fmt(b.end_min),
      color: b.color,
      note: b.note || '',
      done: b.done,
      original: b,
    })
  }
  function nextFreeSlot(length = 60) {
    const startFrom = day === today ? Math.ceil(now / SNAP) * SNAP : 9 * 60
    const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min)
    let s = startFrom
    for (const b of sorted) {
      if (b.end_min <= s) continue
      if (b.start_min >= s + length) break
      s = Math.max(s, b.end_min)
    }
    return clamp(s, 0, DAY - length)
  }

  // tasks due on this day that are not in the schedule yet
  const dayTasks = useMemo(
    () =>
      tasks
        .filter((task) => !task.completed && task.due_date?.slice(0, 10) === day)
        .filter((task) => !blocks.some((b) => b.title === task.title))
        .sort((a, b) => (a.due_time || '99').localeCompare(b.due_time || '99')),
    [tasks, day, blocks],
  )
  async function scheduleTask(task) {
    const fromTime = parseTime(task.due_time)
    const start = fromTime != null ? clamp(round5(fromTime - 30), 0, DAY - 30) : nextFreeSlot(30)
    const ok = await create({
      title: task.title.slice(0, 120),
      start_min: start,
      end_min: start + 30,
      color: 'accent',
      note: null,
    })
    if (ok) notify(t('Задача добавлена в расписание', 'Task added to the schedule'))
  }

  // ---------- derived ----------
  const columns = useMemo(() => layout(blocks), [blocks])
  const planned = blocks.reduce((sum, b) => sum + b.end_min - b.start_min, 0),
    doneCount = blocks.filter((b) => b.done).length
  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min)
  const current = day === today ? sorted.find((b) => b.start_min <= now && b.end_min > now) : null,
    upcoming =
      day === today ? sorted.find((b) => b.start_min > now) : day > today ? sorted[0] : null
  const progress = current ? (now - current.start_min) / (current.end_min - current.start_min) : 0

  return (
    <div className="page schedule-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {displayDate(day, language, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1>{t('Расписание дня', 'Day schedule')}</h1>
          <p className="page-subtitle">
            {t(
              'Перетащите блок, чтобы сдвинуть его, или потяните за нижний край.',
              'Drag a block to move it, or pull its bottom edge.',
            )}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            const s = nextFreeSlot()
            openNew(s, s + 60)
          }}
        >
          <Icon name="plus" size={18} />
          {t('Новый блок', 'New block')}
        </Button>
      </header>

      <section className="schedule-summary" aria-label={t('Сводка дня', 'Day summary')}>
        <div className="panel summary-card">
          <span className="stat-icon blue">
            <Icon name="clock" size={18} />
          </span>
          <strong className="stat-number">{durationLabel(planned, t)}</strong>
          <span className="stat-label">{t('Запланировано', 'Planned')}</span>
        </div>
        <div className="panel summary-card">
          <span className="stat-icon green">
            <Icon name="check" size={18} />
          </span>
          <strong className="stat-number">
            {doneCount}
            <small> / {blocks.length}</small>
          </strong>
          <span className="stat-label">{t('Выполнено', 'Done')}</span>
        </div>
        <div className="panel summary-card now-card">
          <span className="stat-label">
            {current
              ? t('Сейчас', 'Now')
              : upcoming
                ? t('Дальше', 'Up next')
                : t('Свободно', 'Free')}
          </span>
          <strong className="now-title">
            {(current || upcoming)?.title ||
              (blocks.length && day <= today
                ? t('На сегодня всё', 'All done for today')
                : t('Ничего не запланировано', 'Nothing planned'))}
          </strong>
          {(current || upcoming) && (
            <span className="muted now-time">
              {fmt((current || upcoming).start_min)} – {fmt((current || upcoming).end_min)}
            </span>
          )}
          {current && (
            <span className="now-progress" aria-hidden="true">
              <span style={{ transform: `scaleX(${progress})` }} />
            </span>
          )}
        </div>
      </section>

      <div className="schedule-layout">
        <section className="panel schedule-panel">
          <div className="schedule-toolbar">
            <div
              ref={weekRef}
              className="week-strip has-indicator"
              role="group"
              aria-label={t('Неделя', 'Week')}
            >
              {week.map((d) => (
                <button
                  key={d}
                  className={`week-day ${d === day ? 'selected' : ''} ${d === today ? 'is-today' : ''}`}
                  aria-pressed={d === day}
                  aria-label={displayDate(d, language, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                  onClick={() => goTo(d)}
                >
                  <small>
                    {displayDate(d, language, {
                      weekday: 'short',
                      day: undefined,
                      month: undefined,
                    })}
                  </small>
                  <strong>{Number(d.slice(8))}</strong>
                </button>
              ))}
            </div>
            <div className="day-nav">
              <button
                className="icon-button"
                aria-label={t('Предыдущий день', 'Previous day')}
                onClick={() => goTo(addDays(day, -1))}
              >
                <Icon name="back" size={18} />
              </button>
              <Button variant="secondary" disabled={day === today} onClick={() => goTo(today)}>
                {t('Сегодня', 'Today')}
              </Button>
              <button
                className="icon-button"
                aria-label={t('Следующий день', 'Next day')}
                onClick={() => goTo(addDays(day, 1))}
              >
                <Icon name="chevron" size={18} />
              </button>
            </div>
          </div>

          {error ? (
            <ErrorState error={error} onRetry={() => load(day)} t={t} />
          ) : (
            <div
              ref={scrollRef}
              className="timeline-scroll"
              onPointerDown={touchTimeline}
              onWheel={touchTimeline}
              role="region"
              aria-label={t('Шкала времени', 'Timeline')}
              aria-busy={loading}
            >
              <div
                key={day}
                className={`timeline ${direction > 0 ? 'from-next' : direction < 0 ? 'from-prev' : ''}`}
                style={{ '--hour': HOUR + 'px', height: DAY_PX }}
              >
                <div className="hours" aria-hidden="true">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="hour" style={{ top: h * HOUR }}>
                      <span>{h ? fmt(h * 60) : ''}</span>
                    </div>
                  ))}
                </div>
                <div
                  ref={gridRef}
                  className="timeline-grid"
                  onPointerDown={(e) => {
                    if (e.target === e.currentTarget) begin(e, 'draw')
                  }}
                >
                  {day === today && (
                    <div className="now-line" style={{ transform: `translateY(${now * PPM}px)` }}>
                      <span>{fmt(now)}</span>
                    </div>
                  )}
                  <div
                    ref={ghostRef}
                    className="drag-ghost"
                    data-visible="false"
                    aria-hidden="true"
                  />
                  {blocks.map((b) => {
                    const len = b.end_min - b.start_min,
                      pos = columns.get(b.id) || { col: 0, cols: 1 },
                      k = keys.current.get(b.id) ?? b.id,
                      state = live.current.get(k)
                    return (
                      <div
                        key={k}
                        ref={(el) =>
                          el ? elements.current.set(k, el) : elements.current.delete(k)
                        }
                        className={`block ${len <= 30 ? 'compact' : ''} ${b.done ? 'done' : ''}`}
                        data-accent={b.color === 'accent' ? undefined : b.color}
                        style={{
                          transform: `translateY(${state?.y ?? b.start_min * PPM}px)`,
                          height: state?.h ?? len * PPM,
                          '--col': pos.col,
                          '--cols': pos.cols,
                        }}
                        onPointerDown={(e) => {
                          if (e.target.closest('.block-check, .block-resize')) return
                          begin(e, 'move', b)
                        }}
                      >
                        <div className="block-inner">
                          <button
                            className="block-main"
                            onClick={() => openEdit(b)}
                            onKeyDown={(e) => onBlockKey(e, b)}
                            aria-label={`${b.title}, ${fmt(b.start_min)} – ${fmt(b.end_min)}`}
                            aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Alt+Shift+ArrowUp Alt+Shift+ArrowDown"
                          >
                            <strong className="block-title">{b.title}</strong>
                            <span className="block-time">
                              {fmt(b.start_min)} – {fmt(b.end_min)}
                            </span>
                          </button>
                          <button
                            className="block-check"
                            aria-pressed={b.done}
                            aria-label={
                              b.done
                                ? t('Отметить как невыполненное', 'Mark as not done')
                                : t('Отметить как выполненное', 'Mark as done')
                            }
                            onClick={() => save(b.id, { done: !b.done }, b)}
                          >
                            <Icon name="check" size={13} />
                          </button>
                        </div>
                        <div
                          className="block-resize"
                          aria-hidden="true"
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            begin(e, 'resize', b)
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="schedule-side">
          <section className="panel side-card">
            <h2>{t('Задачи на этот день', 'Tasks for this day')}</h2>
            {dayTasks.length ? (
              <ul className="side-tasks">
                {dayTasks.map((task) => (
                  <li key={task.id}>
                    <span>
                      <strong>{task.title}</strong>
                      {task.due_time && (
                        <small className="muted">
                          {t('до', 'by')} {task.due_time}
                        </small>
                      )}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={t('Добавить в расписание', 'Add to schedule') + ': ' + task.title}
                      title={t('Добавить в расписание', 'Add to schedule')}
                      onClick={() => scheduleTask(task)}
                    >
                      <Icon name="plus" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted side-empty">
                {t('Задач со сроком на этот день нет.', 'No tasks are due on this day.')}
              </p>
            )}
          </section>
          {!loading && !error && !blocks.length && (
            <section className="panel side-card">
              <EmptyState
                icon="schedule"
                title={t('День пока свободен', 'The day is still open')}
                description={t(
                  'Нажмите на время на шкале или проведите по ней мышкой, чтобы добавить блок.',
                  'Tap a time on the timeline, or drag across it with a mouse, to add a block.',
                )}
              />
            </section>
          )}
        </aside>
      </div>

      <BlockEditor
        value={editing}
        t={t}
        onClose={() => setEditing(null)}
        onDelete={(b) => {
          setEditing(null)
          remove(b)
        }}
        onSave={async (draft) => {
          const start = parseTime(draft.start),
            end = draft.end === '00:00' ? DAY : parseTime(draft.end)
          const body = {
            title: draft.title.trim(),
            start_min: round5(start),
            end_min: round5(end),
            color: draft.color,
            note: draft.note.trim() || null,
          }
          setEditing(null)
          if (draft.id == null) await create(body)
          else save(draft.id, { ...body, done: draft.done }, draft.original)
        }}
      />
    </div>
  )
}

function BlockEditor({ value, t, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  useEffect(() => {
    if (value) {
      setDraft(value)
      setError('')
    }
  }, [value])
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const start = parseTime(draft?.start),
    end = draft?.end === '00:00' ? DAY : parseTime(draft?.end)
  function setLength(min) {
    if (start == null) return
    set({ end: fmt(Math.min(start + min, DAY)).replace('24:00', '00:00') })
  }
  function submit(e) {
    e.preventDefault()
    if (!draft.title.trim()) return setError(t('Введите название', 'Enter a title'))
    if (start == null || end == null || end <= start)
      return setError(t('Конец должен быть позже начала', 'The end must be after the start'))
    onSave(draft)
  }
  return (
    <Dialog
      open={Boolean(value)}
      title={
        value?.id == null ? t('Новый блок', 'New block') : t('Блок расписания', 'Schedule block')
      }
      onClose={onClose}
    >
      {draft && (
        <form className="stack block-editor" onSubmit={submit} noValidate>
          <label className="field">
            {t('Название', 'Title')}
            <Input
              autoFocus
              maxLength={120}
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder={t('Например, «Пара по матанализу»', 'e.g. “Deep work”')}
              aria-invalid={Boolean(error) && !draft.title.trim()}
            />
          </label>
          <div className="form-grid">
            <label className="field">
              {t('Начало', 'Start')}
              <Input
                type="time"
                step={300}
                value={draft.start}
                onChange={(e) => set({ start: e.target.value })}
              />
            </label>
            <label className="field">
              {t('Конец', 'End')}
              <Input
                type="time"
                step={300}
                value={draft.end}
                onChange={(e) => set({ end: e.target.value })}
              />
            </label>
          </div>
          <div className="length-chips" role="group" aria-label={t('Длительность', 'Length')}>
            {[15, 30, 45, 60, 90, 120].map((min) => (
              <button
                type="button"
                key={min}
                className={`chip ${start != null && end - start === min ? 'selected' : ''}`}
                onClick={() => setLength(min)}
              >
                {durationLabel(min, t)}
              </button>
            ))}
          </div>
          <fieldset className="field color-field">
            <legend>{t('Цвет', 'Colour')}</legend>
            <div className="accent-swatches">
              {[['accent', 'Как акцент', 'Accent'], ...ACCENTS].map(([key, ru, en]) => (
                <label
                  key={key}
                  className={`accent-swatch ${key === 'accent' ? 'is-auto' : ''}`}
                  data-accent={key === 'accent' ? undefined : key}
                  title={t(ru, en)}
                >
                  <input
                    type="radio"
                    name="block-color"
                    value={key}
                    checked={draft.color === key}
                    onChange={() => set({ color: key })}
                    aria-label={t(ru, en)}
                  />
                  <span className="accent-dot" aria-hidden="true">
                    <Icon name="check" size={14} />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            {t('Заметка', 'Note')}
            <textarea
              className="input"
              rows={3}
              maxLength={1000}
              value={draft.note}
              onChange={(e) => set({ note: e.target.value })}
            />
          </label>
          {draft.id != null && (
            <label className="setting-row block-done-row">
              <span>{t('Выполнено', 'Done')}</span>
              <input
                type="checkbox"
                checked={draft.done}
                onChange={(e) => set({ done: e.target.checked })}
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="row dialog-actions">
            {draft.id != null && (
              <Button variant="danger" onClick={() => onDelete(draft.original)}>
                <Icon name="trash" size={16} />
                {t('Удалить', 'Delete')}
              </Button>
            )}
            <span style={{ flex: 1 }} />
            <Button onClick={onClose}>{t('Отмена', 'Cancel')}</Button>
            <Button variant="primary" type="submit">
              {t('Сохранить', 'Save')}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
