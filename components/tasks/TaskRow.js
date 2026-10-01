'use client'
import { useState } from 'react'
import { useApp } from '@/components/AppContext'
import Icon from '@/components/Icon'
import { useTasks } from './TasksContext'
export default function TaskRow({ task, onEdit }) {
  const { t, language, notify } = useApp(),
    { saveTask, folders } = useTasks(),
    [busy, setBusy] = useState(false)
  async function complete() {
    setBusy(true)
    try {
      await saveTask({ id: task.id, completed: !task.completed })
    } catch {
      notify(t('Не удалось изменить задачу', 'Could not update task'), 'error')
    } finally {
      setBusy(false)
    }
  }
  const folder = folders.find((f) => f.id === task.folder_id)
  return (
    <div className={`task-row ${task.completed ? 'is-completed' : ''}`}>
      <button
        className={`task-check ${task.completed ? 'checked' : ''}`}
        onClick={complete}
        disabled={busy}
        aria-label={`${task.completed ? t('Отменить выполнение', 'Mark incomplete') : t('Выполнить', 'Complete')}: ${task.title}`}
        aria-pressed={task.completed}
      >
        {task.completed && <Icon name="check" size={15} />}
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
