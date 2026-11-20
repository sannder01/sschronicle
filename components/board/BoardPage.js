'use client'
// Board page: task folders and tasks as one graph, like Obsidian's graph view.
// Every folder and task is a dot. Nesting (task in folder, folder in folder) is drawn
// as fixed lines; hand-made links join a task to a task or a folder to a folder.
import { useMemo, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { useTasks } from '@/components/tasks/TasksContext'
import { Button } from '@/components/ui'
import Icon from '@/components/Icon'
import TaskEditor from '@/components/tasks/TaskEditor'
import FolderEditor from '@/components/tasks/FolderEditor'
import { api } from '@/lib/client'
import { displayDate } from '@/lib/dates'
import GraphView from './GraphView'

// Board node ids: tasks keep their id, folders are negative so both fit one id space.
const folderNode = (id) => -Number(id)
const isFolderNode = (id) => id < 0
// Folder string ids are prefixed so they never collide with task string ids.
const FOLDER_LINK = 'folder-link:'

const fromFolderLink = (link) => ({
  id: FOLDER_LINK + link.id,
  from_id: folderNode(link.to_id),
  to_id: folderNode(link.from_id),
})

const adapter = {
  async listLinks() {
    const [taskLinks, folderLinks] = await Promise.all([
      api('/api/tasks/links'),
      api('/api/folders/links'),
    ])
    return [...taskLinks, ...folderLinks.map(fromFolderLink)]
  },
  async createLink(a, b) {
    if (!isFolderNode(a))
      return api('/api/tasks/links', { method: 'POST', body: { from_id: a, to_id: b } })
    const created = await api('/api/folders/links', {
      method: 'POST',
      body: { from_id: -a, to_id: -b },
    })
    return fromFolderLink(created)
  },
  deleteLink(id) {
    return typeof id === 'string' && id.startsWith(FOLDER_LINK)
      ? api('/api/folders/links/' + id.slice(FOLDER_LINK.length), { method: 'DELETE' })
      : api('/api/tasks/links/' + id, { method: 'DELETE' })
  },
}

const count = (n, ru, en, t) => {
  const mod10 = n % 10,
    mod100 = n % 100
  const form =
    mod10 === 1 && mod100 !== 11
      ? 0
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 1
        : 2
  return `${n} ${t(ru[form], n === 1 ? en[0] : en[1])}`
}

export default function BoardPage() {
  const { t, language } = useApp(),
    { tasks, folders, loading, error, reload } = useTasks()
  const [editingTask, setEditingTask] = useState(null),
    [editingFolder, setEditingFolder] = useState(null)

  // ---------- items for the canvas ----------
  const items = useMemo(() => {
    const byId = new Map(folders.map((f) => [Number(f.id), f]))
    const folderItems = folders.map((f) => {
      const openTasks = tasks.filter((x) => x.folder_id === f.id && !x.completed).length,
        subfolders = folders.filter((x) => x.parent_id === f.id).length
      const parent = f.parent_id != null ? byId.get(Number(f.parent_id)) : null
      return {
        id: folderNode(f.id),
        kind: 'folder',
        title: f.name,
        meta: [
          openTasks ? count(openTasks, ['задача', 'задачи', 'задач'], ['task', 'tasks'], t) : '',
          subfolders
            ? count(subfolders, ['папка', 'папки', 'папок'], ['folder', 'folders'], t)
            : '',
        ]
          .filter(Boolean)
          .join(', '),
        note: parent ? t('в папке «', 'in “') + parent.name + t('»', '”') : '',
        color: f.color,
        done: false,
        raw: f,
      }
    })
    const taskItems = tasks.map((task) => {
      const due = task.due_date
        ? displayDate(task.due_date.slice(0, 10), language) +
          (task.due_time ? ', ' + task.due_time : '')
        : ''
      const important = task.priority === 'high' ? t('Важная', 'Important') : ''
      return {
        id: task.id,
        kind: 'task',
        title: task.title,
        meta: [due, important].filter(Boolean).join(', '),
        note: '',
        done: Boolean(task.completed),
        raw: task,
      }
    })
    return [...folderItems, ...taskItems]
  }, [folders, tasks, language, t])

  // Nesting is drawn, not tied by hand: folder → subfolder, folder → task.
  const structure = useMemo(() => {
    const folderIds = new Set(folders.map((f) => Number(f.id)))
    return [
      ...folders
        .filter((f) => f.parent_id != null && folderIds.has(Number(f.parent_id)))
        .map((f) => ({
          id: 'nest-folder:' + f.id,
          from_id: folderNode(f.parent_id),
          to_id: folderNode(f.id),
          fixed: true,
        })),
      ...tasks
        .filter((task) => task.folder_id != null && folderIds.has(Number(task.folder_id)))
        .map((task) => ({
          id: 'nest-task:' + task.id,
          from_id: folderNode(task.folder_id),
          to_id: task.id,
          fixed: true,
        })),
    ]
  }, [folders, tasks])

  const canConnect = (a, b) =>
    isFolderNode(a) !== isFolderNode(b)
      ? t(
          'Связь соединяет задачу с задачей или папку с папкой. Чтобы положить задачу в папку, откройте задачу и выберите папку.',
          'A link joins a task to a task or a folder to a folder. To put a task in a folder, open the task and pick the folder.',
        )
      : null

  // ---------- actions ----------
  function edit(item) {
    if (item.kind === 'folder') setEditingFolder({ ...item.raw })
    else setEditingTask(item.raw)
  }

  return (
    <div className="page board-page">
      <header className="board-header">
        <div>
          <p className="eyebrow">{t('Граф папок и задач', 'Graph of folders and tasks')}</p>
          <h1>{t('Доска', 'Board')}</h1>
        </div>
        <div className="board-day-nav">
          <Button onClick={() => setEditingFolder({ name: '', color: '#007aff', parent_id: null })}>
            <Icon name="folder" size={18} />
            {t('Новая папка', 'New folder')}
          </Button>
          <Button variant="primary" onClick={() => setEditingTask({})}>
            <Icon name="plus" size={18} />
            {t('Новая задача', 'New task')}
          </Button>
        </div>
      </header>

      <GraphView
        items={items}
        structure={structure}
        canConnect={canConnect}
        loading={loading}
        error={error}
        onRetry={reload}
        adapter={adapter}
        onOpen={edit}
        empty={
          <>
            <h2>{t('На доске пусто', 'The board is empty')}</h2>
            <p className="muted">
              {t(
                'Создайте папку или задачу. Каждая станет точкой на графе, а вложенность и связи — линиями.',
                'Create a folder or a task. Each becomes a dot on the graph; nesting and links become lines.',
              )}
            </p>
          </>
        }
      />

      {editingTask && (
        <TaskEditor
          key={editingTask.id || 'new'}
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
      <FolderEditor
        value={editingFolder}
        onChange={setEditingFolder}
        onClose={() => setEditingFolder(null)}
      />
    </div>
  )
}
