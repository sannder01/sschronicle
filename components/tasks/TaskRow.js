'use client'
import { useState } from 'react'
import { useApp } from '@/components/AppContext'
import Icon from '@/components/Icon'
import { useTasks } from './TasksContext'
export default function TaskRow({ task, onEdit }) {
  const { t, language, notify, settings } = useApp(),
    { saveTask, folders } = useTasks(),
    [busy, setBusy] = useState(false),
    [celebrating, setCelebrating] = useState(false)
  async function complete() {
    const animate =
      !task.completed &&
      settings.animations &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setBusy(true)
    if (animate) setCelebrating(true)
    try {
      const revealAfter = animate ? new Promise((resolve) => setTimeout(resolve, 560)) : null
      await saveTask({ id: task.id, completed: !task.completed }, revealAfter)
    } catch {
      notify(t('Не удалось изменить задачу', 'Could not update task'), 'error')
    } finally {
      setCelebrating(false)
      setBusy(false)
    }
  }
  const folder = folders.find((f) => f.id === task.folder_id)
  return (
    <div className={`task-row ${task.completed ? 'is-completed' : ''} ${celebrating ? 'is-celebrating' : ''}`}>
      <button
        className={`task-check ${task.completed || celebrating ? 'checked' : ''} ${celebrating ? 'celebrating' : ''}`}
        onClick={complete}
        disabled={busy}
        aria-label={`${task.completed ? t('Отменить выполнение', 'Mark incomplete') : t('Выполнить', 'Complete')}: ${task.title}`}
        aria-pressed={task.completed || celebrating}
      >
        {(task.completed || celebrating) && (
          <span className="task-checkmark">
            <Icon name="check" size={15} />
          </span>
        )}
        {celebrating && <span className="task-sparkles" aria-hidden="true" />}
      </button>
      <button className="task-content" onClick={() => onEdit(task)}>
        <span className="task-title">{task.title}</span>
        <span className="task-meta">
          {task.due_date && (
            <span>
              <Icon name="calendar" size={12} />
              {new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              }).format(new Date(task.due_date.slice(0, 10) + 'T12:00:00Z'))}
              {task.due_time && ` · ${task.due_time.slice(0, 5)}`}
            </span>
          )}
          {folder && (
            <span>
              <i className="folder-dot" style={{ background: folder.color }} />
              {folder.name}
            </span>
          )}
        </span>
      </button>
      <span
        className={`priority priority-${task.priority}`}
        aria-label={t('Приоритет', 'Priority')}
      >
        {task.priority === 'high'
          ? t('Высокий', 'High')
          : task.priority === 'low'
            ? t('Низкий', 'Low')
            : t('Обычный', 'Medium')}
      </span>
      <button
        className="icon-button"
        aria-label={`${t('Изменить', 'Edit')}: ${task.title}`}
        onClick={() => onEdit(task)}
      >
        <Icon name="more" size={18} />
      </button>
    </div>
  )
}
