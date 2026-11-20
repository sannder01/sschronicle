'use client'
// Board page: task folders and open tasks on one canvas, Obsidian Canvas style.
// Folders are cards too. Nesting (task in folder, folder in folder) is drawn as fixed
// dashed arrows; hand-drawn edges join a task to a task or a folder to a folder.
import { useMemo, useState } from 'react'
import { useApp } from '@/components/AppContext'
import { useTasks } from '@/components/tasks/TasksContext'
import { Button } from '@/components/ui'
import Icon from '@/components/Icon'
import TaskEditor from '@/components/tasks/TaskEditor'
import FolderEditor from '@/components/tasks/FolderEditor'
import { api } from '@/lib/client'
import { displayDate } from '@/lib/dates'
import BoardCanvas from './BoardCanvas'

// Board node ids: tasks keep their id, folders are negative so both fit one id space.
const folderNode = (id) => -Number(id)
const isFolderNode = (id) => id < 0
// Folder string ids are prefixed so they never collide with task string ids.
const FOLDER_LINK = 'folder-link:'

const chunks = (list, size) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) =>
    list.slice(i * size, i * size + size),
  )
const splitPositions = (positions) => ({
  tasks: positions.filter((p) => !isFolderNode(p.id)),
  folders: positions.filter((p) => isFolderNode(p.id)).map((p) => ({ ...p, id: -p.id })),
})
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
  savePosition(id, x, y) {
    return adapter.savePositions([{ id, x, y }])
  },
  savePositions(positions) {
    const { tasks, folders } = splitPositions(positions)
    return Promise.all([
      ...chunks(tasks, 200).map((part) =>
        api('/api/tasks/canvas', { method: 'PUT', body: { positions: part } }),
      ),
      ...chunks(folders, 200).map((part) =>
        api('/api/folders/canvas', { method: 'PUT', body: { positions: part } }),
      ),
    ])
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
  const { t, language, notify } = useApp(),
    { tasks, folders, loading, error, reload, saveTask } = useTasks()
  const [editingTask, setEditingTask] = useState(null),
    [editingFolder, setEditingFolder] = useState(null),
    [shownDone, setShownDone] = useState(() => new Set())

  const visibleTasks = useMemo(
    () => tasks.filter((task) => !task.completed || shownDone.has(task.id)),
    [tasks, shownDone],
  )

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
        tape: f.color,
        done: false,
        canvas_x: f.canvas_x == null ? null : Number(f.canvas_x),
        canvas_y: f.canvas_y == null ? null : Number(f.canvas_y),
        raw: f,
      }
    })
    const taskItems = visibleTasks.map((task) => {
      const folder = byId.get(Number(task.folder_id))
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
        tape: folder?.color,
        done: Boolean(task.completed),
        canvas_x: task.canvas_x == null ? null : Number(task.canvas_x),
        canvas_y: task.canvas_y == null ? null : Number(task.canvas_y),
        raw: task,
      }
    })
    return [...folderItems, ...taskItems]
  }, [folders, tasks, visibleTasks, language, t])

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
      ...visibleTasks
        .filter((task) => task.folder_id != null && folderIds.has(Number(task.folder_id)))
        .map((task) => ({
          id: 'nest-task:' + task.id,
          from_id: folderNode(task.folder_id),
          to_id: task.id,
          fixed: true,
        })),
    ]
  }, [folders, visibleTasks])

  const canConnect = (a, b) =>
    isFolderNode(a) !== isFolderNode(b)
      ? t(
          'Нить связывает задачу с задачей или папку с папкой. Чтобы положить задачу в папку, откройте задачу и выберите папку.',
          'A string ties a task to a task or a folder to a folder. To put a task in a folder, open the task and pick the folder.',
        )
      : null

  // ---------- actions ----------
  async function toggleTask(item) {
    // keep a just-finished task on the board (dimmed) until the page is left
    setShownDone((set) => new Set(set).add(item.id))
    try {
      await saveTask({ id: item.id, completed: !item.done })
    } catch {
      notify(t('Не удалось сохранить задачу', 'Could not save the task'), 'error')
    }
  }
  function edit(item) {
    if (item.kind === 'folder') setEditingFolder({ ...item.raw })
    else setEditingTask(item.raw)
  }

  return (
    <div className="page board-page">
      <header className="board-header">
        <div>
          <p className="eyebrow">{t('Папки и задачи', 'Folders and tasks')}</p>
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

      <BoardCanvas
        key="tasks"
        items={items}
        structure={structure}
        canConnect={canConnect}
        loading={loading}
        error={error}
        onRetry={reload}
        adapter={adapter}
        onToggle={toggleTask}
        onEdit={edit}
        empty={
          <>
            <h2>{t('На доске пусто', 'The board is empty')}</h2>
            <p className="muted">
              {t(
                'Создайте папку или задачу. Папки можно вкладывать друг в друга и связывать нитями.',
                'Create a folder or a task. Folders nest inside each other and tie together with strings.',
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
