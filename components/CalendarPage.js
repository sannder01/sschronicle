'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useApp } from './AppContext'
import { useTasks } from './tasks/TasksContext'
import { Button, EmptyState, LoadingState, ErrorState } from './ui'
import Icon from './Icon'
import TaskEditor from './tasks/TaskEditor'
import TaskRow from './tasks/TaskRow'
import { addDays, todayInZone, validDate, weekday, displayDate } from '@/lib/dates'

export default function CalendarPage() {
  const { t, language, settings } = useApp(),
    { tasks, loading, error, reload } = useTasks(),
    router = useRouter(),
    params = useSearchParams()
  const today = todayInZone(settings.timezone),
    selected = validDate(params.get('date')) ? params.get('date') : today
  const [month, setMonth] = useState(selected.slice(0, 7) + '-01'),
    [editing, setEditing] = useState(null)
  const start = addDays(month, -weekday(month)),
    days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const dayTasks = tasks
    .filter((task) => task.due_date?.slice(0, 10) === selected)
    .sort((a, b) => (a.due_time || '99:99').localeCompare(b.due_time || '99:99'))
  function moveMonth(amount) {
    const date = new Date(month + 'T12:00:00Z')
    date.setUTCMonth(date.getUTCMonth() + amount)
    setMonth(date.toISOString().slice(0, 10))
  }
  function select(day) {
    router.push('/app/calendar?date=' + day, { scroll: false })
    if (day.slice(0, 7) !== month.slice(0, 7)) setMonth(day.slice(0, 7) + '-01')
  }
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t('Всё в своё время', 'Everything in its own time')}</p>
          <h1>{t('Календарь', 'Calendar')}</h1>
          <p className="page-subtitle">
            {t('Ваши планы в одном месте.', 'Your plans, all in one place.')}
          </p>
        </div>
        <Button variant="primary" onClick={() => setEditing({ due_date: selected })}>
          <Icon name="plus" />
          {t('Новая задача', 'New task')}
        </Button>
      </header>
      <div className="calendar-layout">
        <section className="panel">
          <div className="calendar-toolbar">
            <h2>
              {displayDate(month, language, { month: 'long', year: 'numeric', day: undefined })}
            </h2>
            <div className="row">
              <Button variant="ghost" onClick={() => select(today)}>
                {t('Сегодня', 'Today')}
              </Button>
              <Button
                variant="ghost"
                aria-label={t('Предыдущий месяц', 'Previous month')}
                onClick={() => moveMonth(-1)}
              >
                <Icon name="back" />
              </Button>
              <Button
                variant="ghost"
                aria-label={t('Следующий месяц', 'Next month')}
                onClick={() => moveMonth(1)}
              >
                <Icon name="chevron" />
              </Button>
            </div>
          </div>
          <div className="calendar-grid">
            {(language === 'ru'
              ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
              : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            ).map((label) => (
              <div key={label} className="calendar-weekday">
                {label}
              </div>
            ))}
            {days.map((day) => {
              const count = tasks.filter((task) => task.due_date?.slice(0, 10) === day).length
              return (
                <button
                  key={day}
                  className={`calendar-day ${day === selected ? 'selected' : ''} ${day === today ? 'today' : ''} ${day.slice(0, 7) !== month.slice(0, 7) ? 'outside' : ''}`}
                  aria-pressed={day === selected}
                  aria-label={`${displayDate(day, language, { month: 'long', year: 'numeric' })}, ${t('задач', 'tasks')}: ${count}`}
                  onClick={() => select(day)}
                >
                  <span>{Number(day.slice(-2))}</span>
                  <span className="calendar-dots">
                    {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
        <section className="panel calendar-agenda">
          <div className="panel-heading">
            <h2>{displayDate(selected, language, { month: 'long' })}</h2>
            <span className="count-badge">{dayTasks.length}</span>
          </div>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState t={t} error={error} onRetry={reload} />
          ) : dayTasks.length ? (
            dayTasks.map((task) => <TaskRow key={task.id} task={task} onEdit={setEditing} />)
          ) : (
            <EmptyState
              icon="calendar"
              title={t('День открыт для планов', 'A little room in your day')}
              description={t('На эту дату пока нет задач.', 'There are no tasks on this date yet.')}
            />
          )}
          <button className="add-task-inline" onClick={() => setEditing({ due_date: selected })}>
            <Icon name="plus" size={18} />
            {t('Запланировать задачу', 'Plan a task')}
          </button>
        </section>
      </div>
      {editing && <TaskEditor task={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
