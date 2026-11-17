'use client'
// Board page: one canvas, two sources — the day's schedule blocks or the task list.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useApp } from '@/components/AppContext'
import { useTasks } from '@/components/tasks/TasksContext'
import { Button } from '@/components/ui'
import Icon from '@/components/Icon'
import { useIndicator } from '@/components/motion'
import BlockEditor from '@/components/schedule/BlockEditor'
import TaskEditor from '@/components/tasks/TaskEditor'
import { fmt, parseTime, round5, DAY } from '@/components/schedule/time'
import { api } from '@/lib/client'
import { addDays, todayInZone, displayDate } from '@/lib/dates'
import BoardCanvas from './BoardCanvas'

const SOURCE_KEY = 'chronicle-board-source'
const chunks = (list, size) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, i * size + size),
  )

export default function BoardPage() {
  const { t, language, settings, notify } = useApp(),
    { tasks, folders, loading: tasksLoading, error: tasksError, reload, saveTask } = useTasks()
  const today = todayInZone(settings.timezone)
  const [source, setSource] = useState('schedule'),
    [day, setDay] = useState(today),
    [blocks, setBlocks] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(null),
    [editingBlock, setEditingBlock] = useState(null),
    [editingTask, setEditingTask] = useState(null),
    [shownDone, setShownDone] = useState(() => new Set()),
    switchRef = useRef(null),
    request = useRef(0)

  // remember the last source (a per-viewer convenience)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SOURCE_KEY)
      if (saved === 'tasks' || saved === 'schedule') setSource(saved)
    } catch {}
  }, [])
  function pickSource(next) {
    setSource(next)
    try {
      localStorage.setItem(SOURCE_KEY, next)
    } catch {}
  }
  useIndicator(switchRef, '.selected', [source])

  // ---------- schedule blocks ----------
  const loadBlocks = useCallback(async (target) => {
    const current = ++request.current
    setLoading(true)
    setError(null)
    try {
      const result = await api('/api/schedule?day=' + target)
      if (current === request.current) setBlocks(result)
    } catch (err) {
      if (current === request.current) setError(err)
    } finally {
      if (current === request.current) setLoading(false)
    }
  }, [])
  useEffect(() => {
    if (source === 'schedule') loadBlocks(day)
  }, [source, day, loadBlocks])

  const scheduleAdapter = useMemo(
    () => ({
      listLinks: () => api('/api/schedule/links?day=' + day),
      createLink: (from_id, to_id) =>
        api('/api/schedule/links', { method: 'POST', body: { from_id, to_id } }),
      deleteLink: (id) => api('/api/schedule/links/' + id, { method: 'DELETE' }),
      savePosition: (id, x, y) =>
        api('/api/schedule/' + id, { method: 'PATCH', body: { canvas_x: x, canvas_y: y } }),
      savePositions: (positions) =>
        Promise.all(
          chunks(positions, 60).map((part) =>
            api('/api/schedule/canvas', { method: 'PUT', body: { day, positions: part } }),
          ),
        ),
    }),
    [day],
  )
  const taskAdapter = useMemo(
    () => ({
      listLinks: () => api('/api/tasks/links'),
      createLink: (from_id, to_id) =>
        api('/api/tasks/links', { method: 'POST', body: { from_id, to_id } }),
      deleteLink: (id) => api('/api/tasks/links/' + id, { method: 'DELETE' }),
      savePosition: (id, x, y) =>
        api('/api/tasks/canvas', { method: 'PUT', body: { positions: [{ id, x, y }] } }),
      savePositions: (positions) =>
        Promise.all(
          chunks(positions, 200).map((part) =>
            api('/api/tasks/canvas', { method: 'PUT', body: { positions: part } }),
          ),
        ),
    }),
    [],
  )

  // ---------- items for the canvas ----------
  const blockItems = useMemo(
    () =>
      blocks.map((b) => ({
        id: b.id,
        title: b.title,
        meta: `${fmt(b.start_min)} – ${fmt(b.end_min)}`,
        note: b.note,
        color: b.color,
        done: b.done,
        canvas_x: b.canvas_x,
        canvas_y: b.canvas_y,
        raw: b,
      })),
    [blocks],
  )
  const taskItems = useMemo(
    () =>
      tasks
        .filter((task) => !task.completed || shownDone.has(task.id))
        .map((task) => {
          const folder = folders.find((f) => f.id === task.folder_id)
          const due = task.due_date
            ? displayDate(task.due_date.slice(0, 10), language) +
              (task.due_time ? ', ' + task.due_time : '')
            : ''
          const important = task.priority === 'high' ? t('Важная', 'Important') : ''
          return {
            id: task.id,
            title: task.title,
            meta: [due, important].filter(Boolean).join(' · '),
            note: folder?.name || '',
            tape: folder?.color,
            done: Boolean(task.completed),
            canvas_x: task.canvas_x == null ? null : Number(task.canvas_x),
            canvas_y: task.canvas_y == null ? null : Number(task.canvas_y),
            raw: task,
          }
        }),
    [tasks, folders, shownDone, language, t],
  )

  // ---------- actions ----------
  async function toggleBlock(item) {
    const b = item.raw
    setBlocks((list) => list.map((x) => (x.id === b.id ? { ...x, done: !b.done } : x)))
    try {
      await api('/api/schedule/' + b.id, { method: 'PATCH', body: { done: !b.done } })
    } catch {
      setBlocks((list) => list.map((x) => (x.id === b.id ? b : x)))
      notify(t('Не удалось сохранить изменения', 'Could not save changes'), 'error')
    }
  }
  async function toggleTask(item) {
    // keep a just-finished task on the board (dimmed) until the page is left
    setShownDone((set) => new Set(set).add(item.id))
    try {
      await saveTask({ id: item.id, completed: !item.done })
    } catch {
      notify(t('Не удалось сохранить задачу', 'Could not save the task'), 'error')
    }
  }
  function editBlock(item) {
    const b = item.raw
    setEditingBlock({
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
  async function saveBlock(draft) {
    const start = parseTime(draft.start),
      end = draft.end === '00:00' ? DAY : parseTime(draft.end)
    const body = {
      title: draft.title.trim(),
      start_min: round5(start),
      end_min: round5(end),
      color: draft.color,
      note: draft.note.trim() || null,
    }
    setEditingBlock(null)
    try {
      if (draft.id == null) {
        const created = await api('/api/schedule', { method: 'POST', body: { day, ...body } })
        setBlocks((list) => [...list, created])
      } else {
        const updated = await api('/api/schedule/' + draft.id, {
          method: 'PATCH',
          body: { ...body, done: draft.done },
        })
        setBlocks((list) => list.map((b) => (b.id === draft.id ? updated : b)))
      }
    } catch {
      notify(t('Не удалось сохранить блок', 'Could not save the block'), 'error')
    }
  }
  async function deleteBlock(b) {
    setEditingBlock(null)
    setBlocks((list) => list.filter((x) => x.id !== b.id))
    try {
      await api('/api/schedule/' + b.id, { method: 'DELETE' })
    } catch {
      loadBlocks(day)
    }
  }

  const isSchedule = source === 'schedule'
  return (
    <div className="page board-page">
      <header className="board-header">
        <div>
          <p className="eyebrow">
            {isSchedule
              ? displayDate(day, language, { weekday: 'long', day: 'numeric', month: 'long' })
              : t('Все активные задачи', 'All open tasks')}
          </p>
          <h1>{t('Доска', 'Board')}</h1>
        </div>
        <div className="board-day-nav">
          <div
            ref={switchRef}
            className="segmented has-indicator board-source"
            role="group"
            aria-label={t('Что на доске', 'What is on the board')}
          >
            {[
              ['schedule', 'Расписание', 'Schedule'],
              ['tasks', 'Задачи', 'Tasks'],
            ].map(([key, ru, en]) => (
              <button
                key={key}
                aria-pressed={source === key}
                className={source === key ? 'selected' : ''}
                onClick={() => pickSource(key)}
              >
                {t(ru, en)}
              </button>
            ))}
          </div>
          {isSchedule && (
            <>
              <button
                className="icon-button"
                aria-label={t('Предыдущий день', 'Previous day')}
                onClick={() => setDay(addDays(day, -1))}
              >
                <Icon name="back" size={18} />
              </button>
              <Button disabled={day === today} onClick={() => setDay(today)}>
                {t('Сегодня', 'Today')}
              </Button>
              <button
                className="icon-button"
                aria-label={t('Следующий день', 'Next day')}
                onClick={() => setDay(addDays(day, 1))}
              >
                <Icon name="chevron" size={18} />
              </button>
            </>
          )}
          <Button
            variant="primary"
            onClick={() =>
              isSchedule
                ? setEditingBlock({
                    id: null,
                    title: '',
                    start: '09:00',
                    end: '10:00',
                    color: 'accent',
                    note: '',
                    done: false,
                  })
                : setEditingTask({})
            }
          >
            <Icon name="plus" size={18} />
            {isSchedule ? t('Новый блок', 'New block') : t('Новая задача', 'New task')}
          </Button>
        </div>
      </header>

      {isSchedule ? (
        <BoardCanvas
          key={'schedule-' + day}
          items={blockItems}
          loading={loading}
          error={error}
          onRetry={() => loadBlocks(day)}
          adapter={scheduleAdapter}
          onToggle={toggleBlock}
          onEdit={editBlock}
          empty={
            <>
              <h2>{t('На доске пусто', 'The board is empty')}</h2>
              <p className="muted">
                {t(
                  'Добавьте блоки в расписание дня, и они появятся здесь карточками.',
                  'Add blocks to the day schedule and they will show up here as cards.',
                )}
              </p>
              <Link className="button button-secondary" href="/app/schedule">
                {t('Открыть расписание', 'Open the schedule')}
              </Link>
            </>
          }
        />
      ) : (
        <BoardCanvas
          key="tasks"
          items={taskItems}
          loading={tasksLoading}
          error={tasksError}
          onRetry={reload}
          adapter={taskAdapter}
          onToggle={toggleTask}
          onEdit={(item) => setEditingTask(item.raw)}
          empty={
            <>
              <h2>{t('Активных задач нет', 'No open tasks')}</h2>
              <p className="muted">
                {t(
                  'Создайте задачу, и её можно будет связать с другими нитями.',
                  'Create a task and tie it to others with strings.',
                )}
              </p>
            </>
          }
        />
      )}

      <BlockEditor
        value={editingBlock}
        t={t}
        onClose={() => setEditingBlock(null)}
        onDelete={deleteBlock}
        onSave={saveBlock}
      />
      {editingTask && (
        <TaskEditor
          key={editingTask.id || 'new'}
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}
