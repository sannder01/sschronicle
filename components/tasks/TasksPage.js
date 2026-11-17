'use client'
import { useMemo, useRef, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { Button, EmptyState, LoadingState, ErrorState, Select } from '@/components/ui'
import Icon from '@/components/Icon'
import { useTasks } from './TasksContext'
import TaskEditor from './TaskEditor'
import TaskRow from './TaskRow'
import FolderEditor from './FolderEditor'
import { todayInZone } from '@/lib/dates'
import { useIndicator } from '@/components/motion'
import { folderTree, descendantIds, folderOptions } from '@/lib/folder-shape.mjs'
export default function TasksPage() {
  const { t, user, settings, language, notify } = useApp(),
    { tasks, folders, loading, error, reload } = useTasks()
  const [filter, setFilter] = useState('active'),
    [folder, setFolder] = useState('all'),
    [search, setSearch] = useState(''),
    [editing, setEditing] = useState(null),
    [folderEdit, setFolderEdit] = useState(null),
    segmentedRef = useRef(null)
  const tree = useMemo(() => folderTree(folders), [folders])
  // Picking a folder also shows the tasks in its subfolders.
  const shownFolders = useMemo(
    () => (['all', 'none'].includes(folder) ? null : descendantIds(folders, Number(folder))),
    [folders, folder],
  )
  useIndicator(segmentedRef, '.selected', [filter, loading])
  const today = todayInZone(settings.timezone),
    active = tasks.filter((x) => !x.completed),
    done = tasks.filter((x) => x.completed).length
  const visible = useMemo(
    () =>
      tasks
        .filter(
          (x) =>
            (filter === 'all' ||
              (filter === 'completed'
                ? x.completed
                : filter === 'today'
                  ? !x.completed && x.due_date?.slice(0, 10) === today
                  : filter === 'upcoming'
                    ? !x.completed && x.due_date?.slice(0, 10) > today
                    : !x.completed)) &&
            (folder === 'all' ||
              (folder === 'none' ? !x.folder_id : shownFolders?.has(Number(x.folder_id)))) &&
            x.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
        )
        .sort(
          (a, b) =>
            Number(a.completed) - Number(b.completed) ||
            (a.due_date || '9999').localeCompare(b.due_date || '9999') ||
            { high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority],
        ),
    [tasks, filter, folder, shownFolders, search, today],
  )
  const overdue = visible.filter(
      (x) => !x.completed && x.due_date && x.due_date.slice(0, 10) < today,
    ),
    regular = visible
      .filter((x) => !overdue.includes(x))
      .sort(
        (a, b) =>
          (b.created_at || '').localeCompare(a.created_at || '') || Number(b.id) - Number(a.id),
      )
  return (
    <div className="page tasks-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">
            {new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: settings.timezone,
            }).format(new Date())}
          </p>
          <h1>{t('Сделайте место важному.', 'Make room for what matters.')}</h1>
          <p className="page-subtitle">
            {t('Хороший день начинается с ясного плана.', 'A good day starts with a clear plan.')}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() =>
            setEditing({ folder_id: !['all', 'none'].includes(folder) ? Number(folder) : null })
          }
        >
          <Icon name="plus" />
          {t('Новая задача', 'New task')}
        </Button>
      </header>
      <div className="overview-grid">
        <button
          className={`overview-card ${filter === 'today' ? 'selected' : ''}`}
          onClick={() => setFilter('today')}
        >
          <span className="stat-icon blue">
            <Icon name="sun" />
          </span>
          <span className="stat-number">
            {active.filter((x) => x.due_date?.slice(0, 10) === today).length}
          </span>
          <span className="stat-label">{t('На сегодня', 'Today')}</span>
          <span className="stat-hint">
            {t('Сфокусируйтесь на главном', 'Focus on what matters')}
          </span>
        </button>
        <button
          className={`overview-card ${filter === 'upcoming' ? 'selected' : ''}`}
          onClick={() => setFilter('upcoming')}
        >
          <span className="stat-icon purple">
            <Icon name="calendar" />
          </span>
          <span className="stat-number">
            {active.filter((x) => x.due_date?.slice(0, 10) > today).length}
          </span>
          <span className="stat-label">{t('Впереди', 'Upcoming')}</span>
          <span className="stat-hint">{t('Всё в своё время', 'Everything in its own time')}</span>
        </button>
        <button
          className={`overview-card ${filter === 'completed' ? 'selected' : ''}`}
          onClick={() => setFilter('completed')}
        >
          <span className="stat-icon green">
            <Icon name="check" />
          </span>
          <span className="stat-number">{done}</span>
          <span className="stat-label">{t('Завершено', 'Completed')}</span>
          <span className="stat-hint">{t('Каждый шаг имеет значение', 'Every step counts')}</span>
        </button>
      </div>
      <div className="workspace-grid">
        <section className="task-panel panel">
          <div className="panel-heading">
            <h2>
              {t('Мои задачи', 'My tasks')} <span className="count-badge">{visible.length}</span>
            </h2>
            <label className="search-input">
              <Icon name="search" size={17} />
              <input
                aria-label={t('Поиск задач', 'Search tasks')}
                placeholder={t('Найти задачу', 'Search tasks')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="task-toolbar">
            <div
              ref={segmentedRef}
              className="segmented has-indicator"
              aria-label={t('Фильтр задач', 'Task filter')}
            >
              {[
                ['active', 'Активные', 'Active'],
                ['all', 'Все', 'All'],
                ['completed', 'Выполненные', 'Completed'],
              ].map(([key, ru, en]) => (
                <button
                  key={key}
                  aria-pressed={filter === key}
                  className={filter === key ? 'selected' : ''}
                  onClick={() => setFilter(key)}
                >
                  {t(ru, en)}
                </button>
              ))}
            </div>
            <Select
              className="folder-select"
              value={folder}
              onChange={(next) => setFolder(String(next))}
              aria-label={t('Папка задач', 'Task folder')}
              options={[
                { value: 'all', label: t('Все папки', 'All folders') },
                { value: 'none', label: t('Без папки', 'No folder') },
                ...folderOptions(tree),
              ]}
            />
          </div>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState error={error} onRetry={reload} t={t} />
          ) : !visible.length ? (
            <EmptyState
              title={
                search
                  ? t('Ничего не найдено', 'No results')
                  : t('Здесь пока тихо', 'A little space to begin')
              }
              description={
                search
                  ? t('Попробуйте другой запрос или фильтр.', 'Try another search or filter.')
                  : t(
                      'Добавьте первую задачу. Остальное — шаг за шагом.',
                      'Add your first task. Take the rest one step at a time.',
                    )
              }
            >
              <Button onClick={() => setEditing({})}>
                <Icon name="plus" />
                {t('Добавить задачу', 'Add task')}
              </Button>
            </EmptyState>
          ) : (
            <>
              {regular.length > 0 && (
                <>
                  <div className="list-group-label">
                    {filter === 'today'
                      ? t('Сегодня', 'Today')
                      : filter === 'upcoming'
                        ? t('Запланировано', 'Scheduled')
                        : t('Ваш план', 'Your plan')}
                    <span>{regular.length}</span>
                  </div>
                  {regular.map((task) => (
                    <TaskRow key={task.id} task={task} onEdit={setEditing} />
                  ))}
                </>
              )}
              {overdue.length > 0 && (
                <>
                  <div className="list-group-label danger-text">
                    {t('Требуют внимания', 'Needs attention')}
                    <span>{overdue.length}</span>
                  </div>
                  {overdue.map((task) => (
                    <TaskRow key={task.id} task={task} onEdit={setEditing} />
                  ))}
                </>
              )}
            </>
          )}
          <button
            className="add-task-inline"
            onClick={() =>
              setEditing({ folder_id: !['all', 'none'].includes(folder) ? Number(folder) : null })
            }
          >
            <Icon name="plus" size={18} />
            {t('Добавить задачу', 'Add task')}
          </button>
        </section>
        <aside className="task-aside">
          <section className="panel folder-panel">
            <div className="panel-heading">
              <h2>{t('Папки', 'Folders')}</h2>
              <Button
                variant="ghost"
                aria-label={t('Создать папку', 'Create folder')}
                onClick={() => {
                  setFolderEdit({ name: '', color: '#007aff', parent_id: null })
                }}
              >
                <Icon name="plus" size={18} />
              </Button>
            </div>
            {tree.map((f) => (
              <div
                className={`folder-row ${folder === String(f.id) ? 'selected' : ''}`}
                key={f.id}
                style={{ '--depth': f.depth }}
              >
                <button onClick={() => setFolder(folder === String(f.id) ? 'all' : String(f.id))}>
                  <span className="folder-color" style={{ color: f.color }}>
                    <Icon name="folder" size={18} />
                  </span>
                  <span>{f.name}</span>
                  <small>{tasks.filter((x) => x.folder_id === f.id && !x.completed).length}</small>
                </button>
                <button
                  className="icon-button"
                  aria-label={`${t('Изменить папку', 'Edit folder')}: ${f.name}`}
                  onClick={() => {
                    setFolderEdit(f)
                  }}
                >
                  <Icon name="more" size={16} />
                </button>
              </div>
            ))}
            {!folders.length && (
              <p className="aside-hint">
                {t(
                  'Разделите задачи по проектам или сферам жизни.',
                  'Organize tasks by project or area of your life.',
                )}
              </p>
            )}
          </section>
        </aside>
      </div>
      {editing && (
        <TaskEditor key={editing.id || 'new'} task={editing} onClose={() => setEditing(null)} />
      )}
      <FolderEditor
        value={folderEdit}
        onChange={setFolderEdit}
        onClose={() => setFolderEdit(null)}
        onDeleted={() => setFolder('all')}
      />
    </div>
  )
}
