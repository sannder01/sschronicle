import { createHash } from 'node:crypto'

const str = (maxLength = 500) => ({ type: 'string', maxLength })
const id = { type: 'integer', minimum: 1, maximum: 2147483647 }
const flag = { type: 'boolean' }
const nullableId = { anyOf: [id, { type: 'null' }] }
const due = { anyOf: [{ type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, { type: 'null' }] }
const clock = {
  anyOf: [{ type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' }, { type: 'null' }],
}
const priority = { type: 'string', enum: ['low', 'medium', 'high'] }
const paging = {
  limit: { type: 'integer', minimum: 1, maximum: 100 },
  offset: { type: 'integer', minimum: 0, maximum: 100000 },
  query: str(200),
}
const task = {
  title: { ...str(), minLength: 1 },
  priority,
  due_date: due,
  due_time: clock,
  folder_id: nullableId,
  completed: flag,
}
const note = { title: str(), content: str(100000), folder_id: nullableId, pinned: flag }

const tool = (
  name,
  description,
  properties = {},
  required = [],
  readOnly = true,
  destructive = false,
) => ({
  name,
  description,
  inputSchema: { type: 'object', properties, required, additionalProperties: false },
  annotations: {
    readOnlyHint: readOnly,
    destructiveHint: destructive,
    idempotentHint: readOnly,
    openWorldHint: false,
  },
})

export const tools = [
  tool(
    'get_connection',
    'Check whether this ChatGPT account is linked to a Chronicle account. Never ask for a password or session cookie.',
  ),
  tool(
    'link_account',
    'Link this ChatGPT account to Chronicle with the one-time code the user created in Chronicle → Profile → ChatGPT. Only use a code the user typed in this conversation.',
    { code: { type: 'string', minLength: 6, maxLength: 32 } },
    ['code'],
    false,
  ),
  tool(
    'list_tasks',
    'Read your Chronicle tasks, optionally filtered by completion, folder or title. Dates and times use your Chronicle timezone.',
    { ...paging, completed: flag, folder_id: nullableId },
  ),
  tool(
    'create_task',
    'Create a task in Chronicle. Resolve relative dates using the user timezone, then pass YYYY-MM-DD and local HH:MM. Do not retry automatically after an uncertain write.',
    task,
    ['title'],
    false,
  ),
  tool(
    'update_task',
    'Update a task. First read it and pass its updated_at as expected_updated_at to avoid overwriting newer changes.',
    { id, ...task, expected_updated_at: str(100) },
    ['id', 'expected_updated_at'],
    false,
  ),
  tool(
    'delete_task',
    'Permanently delete a task only when the user requests deletion. Read it first and pass its updated_at.',
    { id, expected_updated_at: str(100) },
    ['id', 'expected_updated_at'],
    false,
    true,
  ),
  tool(
    'list_notes',
    'Read your notes. Paginated responses include complete plain text and version. Deleted notes are excluded by default.',
    { ...paging, deleted: flag, folder_id: nullableId },
  ),
  tool(
    'create_note',
    'Create a plain-text note compatible with the Chronicle editor. Do not retry automatically after an uncertain write.',
    note,
    [],
    false,
  ),
  tool(
    'update_note',
    'Update a note using the version from list_notes. Setting content replaces the entire document with plain text; do this only when the user requests replacing the content. Metadata edits preserve rich formatting. Trash or restore with deleted.',
    { id, version: id, ...note, deleted: flag },
    ['id', 'version'],
    false,
  ),
  tool('list_folders', 'List your task and note folders.', {
    entity_type: { type: 'string', enum: ['task', 'note'] },
  }),
  tool(
    'create_folder',
    'Create a task or note folder in Chronicle.',
    {
      name: { ...str(100), minLength: 1 },
      entity_type: { type: 'string', enum: ['task', 'note'] },
      emoji: { ...str(20), minLength: 1 },
      color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
    },
    ['name', 'entity_type'],
    false,
  ),
]

export class BridgeError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}
const fail = (code, message) => {
  throw new BridgeError(code, message)
}

function check(value, schema, path) {
  if (schema.anyOf) {
    const ok = schema.anyOf.some((option) => {
      try {
        check(value, option, path)
        return true
      } catch {
        return false
      }
    })
    if (!ok) fail('INVALID_ARGUMENT', `Invalid ${path}`)
    return
  }
  if (schema.type === 'null') {
    if (value !== null) fail('INVALID_ARGUMENT', `Invalid ${path}`)
    return
  }
  if (
    schema.type === 'integer' &&
    (!Number.isInteger(value) || value < schema.minimum || value > schema.maximum)
  )
    fail('INVALID_ARGUMENT', `Invalid ${path}`)
  if (
    schema.type === 'string' &&
    (typeof value !== 'string' ||
      value.length > (schema.maxLength ?? Infinity) ||
      value.length < (schema.minLength ?? 0) ||
      value.includes('\0') ||
      (schema.pattern && !new RegExp(schema.pattern).test(value)))
  )
    fail('INVALID_ARGUMENT', `Invalid ${path}`)
  if (schema.type === 'boolean' && typeof value !== 'boolean')
    fail('INVALID_ARGUMENT', `Invalid ${path}`)
  if (schema.enum && !schema.enum.includes(value)) fail('INVALID_ARGUMENT', `Invalid ${path}`)
}

export function validate(name, args) {
  const definition = tools.find((t) => t.name === name)
  if (!definition) fail('UNKNOWN_TOOL', 'Unknown tool')
  if (!args || typeof args !== 'object' || Array.isArray(args))
    fail('INVALID_ARGUMENT', 'Arguments must be an object')
  for (const key of definition.inputSchema.required)
    if (!Object.hasOwn(args, key)) fail('INVALID_ARGUMENT', `Missing ${key}`)
  for (const [key, value] of Object.entries(args)) {
    if (!Object.hasOwn(definition.inputSchema.properties, key))
      fail('INVALID_ARGUMENT', `Unexpected ${key}`)
    check(value, definition.inputSchema.properties[key], key)
  }
  if (args.due_date) {
    const day = new Date(args.due_date + 'T12:00:00Z')
    if (
      !Number.isFinite(+day) ||
      day.toISOString().slice(0, 10) !== args.due_date ||
      args.due_date < '1900-01-01' ||
      args.due_date > '2200-12-31'
    )
      fail('INVALID_ARGUMENT', 'Invalid due_date')
  }
  if (args.title !== undefined && name.includes('task') && !args.title.trim())
    fail('INVALID_ARGUMENT', 'Title cannot be empty')
  if (args.name !== undefined && !args.name.trim()) fail('INVALID_ARGUMENT', 'Name cannot be empty')
  if (
    args.expected_updated_at !== undefined &&
    !Number.isFinite(Date.parse(args.expected_updated_at))
  )
    fail('INVALID_ARGUMENT', 'Invalid expected_updated_at')
  return args
}

/** Normalizes a user-typed link code ("abcd-efgh-jk" → "ABCDEFGHJK") and hashes it. */
export function linkCodeHash(code) {
  const normalized = String(code)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  return createHash('sha256').update(normalized).digest('hex')
}

const documentFromText = (value) => {
  const lines = value.split(/\r\n|\r|\n/)
  if (lines.length > 4500) fail('INVALID_ARGUMENT', 'Note has too many lines')
  const doc = {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : {}),
    })),
  }
  if (JSON.stringify(doc).length > 350000) fail('INVALID_ARGUMENT', 'Note document is too large')
  return doc
}

const sameDate = (a, b) => (a ?? null) === (b ?? null)

export async function execute(db, name, args, email, { siteUrl = '' } = {}) {
  validate(name, args)
  if (typeof email !== 'string' || !email.includes('@') || email.length > 320)
    fail('UNAUTHORIZED', 'Verified caller email is required')

  if (name === 'link_account') {
    return await db.begin(async (q) => {
      const redeemed = (
        await q.unsafe(
          'DELETE FROM chatgpt_link_codes WHERE code_hash=$1 AND expires_at>NOW() RETURNING user_id',
          [linkCodeHash(args.code)],
        )
      )[0]
      if (!redeemed)
        fail(
          'LINK_EXPIRED',
          'This code has expired or was already used. Create a new one in Chronicle.',
        )
      // The verified email belongs to the caller, so re-linking it moves it to the new account.
      await q.unsafe('DELETE FROM chatgpt_links WHERE lower(email)=lower($1) AND user_id<>$2', [
        email,
        redeemed.user_id,
      ])
      await q.unsafe(
        'INSERT INTO chatgpt_links(user_id,email) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,created_at=NOW()',
        [redeemed.user_id, email],
      )
      return { connected: true }
    })
  }

  // Access is granted only to accounts that explicitly linked this ChatGPT email.
  const user = (
    await db.unsafe(
      'SELECT u.id,u.email,u.name,u.settings FROM chatgpt_links l JOIN users u ON u.id=l.user_id WHERE lower(l.email)=lower($1) LIMIT 1',
      [email],
    )
  )[0]
  if (name === 'get_connection')
    return user
      ? {
          connected: true,
          name: user.name,
          timezone: user.settings?.timezone || 'UTC',
          ...(siteUrl ? { site: siteUrl + '/app/tasks' } : {}),
        }
      : {
          connected: false,
          code: 'ACCOUNT_NOT_LINKED',
          message:
            'This ChatGPT account is not linked. Open Chronicle → Profile → ChatGPT, create a code and give it to link_account.',
        }
  if (!user)
    fail('ACCOUNT_NOT_LINKED', 'Link this ChatGPT account in Chronicle → Profile → ChatGPT first.')
  const uid = user.id

  const assertFolder = async (q, folderId, type) => {
    if (
      folderId != null &&
      !(
        await q.unsafe('SELECT id FROM folders WHERE id=$1 AND user_id=$2 AND entity_type=$3', [
          folderId,
          uid,
          type,
        ])
      ).length
    )
      fail('NOT_FOUND', 'Folder not found')
  }

  if (name === 'list_tasks' || name === 'list_notes') {
    const isTask = name === 'list_tasks'
    const params = [uid]
    const conditions = ['user_id=$1']
    const add = (column, value) => {
      params.push(value)
      conditions.push(`${column}=$${params.length}`)
    }
    if (isTask && args.completed !== undefined) add('completed', args.completed)
    if (!isTask) conditions.push(args.deleted ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL')
    if (Object.hasOwn(args, 'folder_id')) {
      if (args.folder_id === null) conditions.push('folder_id IS NULL')
      else add('folder_id', args.folder_id)
    }
    if (args.query) {
      params.push('%' + args.query.replace(/[\\%_]/g, '\\$&') + '%')
      conditions.push(`title ILIKE $${params.length}`)
    }
    const limit = args.limit ?? 30
    const offset = args.offset ?? 0
    params.push(limit + 1, offset)
    const columns = isTask
      ? 'id,title,completed,due_date::text,due_time,priority,folder_id,status,source,created_at,updated_at'
      : 'id,title,content,folder_id,pinned,version,deleted_at,created_at,updated_at'
    const order = isTask ? 'created_at DESC,id DESC' : 'pinned DESC,updated_at DESC,id DESC'
    const rows = await db.unsafe(
      `SELECT ${columns} FROM ${isTask ? 'tasks' : 'notes'} WHERE ${conditions.join(' AND ')} ORDER BY ${order} LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    )
    return {
      items: rows.slice(0, limit),
      next_offset: rows.length > limit ? offset + limit : null,
      timezone: user.settings?.timezone || 'UTC',
    }
  }

  if (name === 'list_folders')
    return {
      items: await db.unsafe(
        'SELECT id,name,emoji,color,entity_type,parent_id FROM folders WHERE user_id=$1 AND ($2::text IS NULL OR entity_type=$2) ORDER BY created_at,id',
        [uid, args.entity_type ?? null],
      ),
    }

  if (name === 'create_folder')
    return (
      await db.unsafe(
        'INSERT INTO folders(user_id,name,entity_type,emoji,color) VALUES($1,$2,$3,$4,$5) RETURNING id,name,entity_type,emoji,color',
        [uid, args.name.trim(), args.entity_type, args.emoji ?? '📁', args.color ?? '#007aff'],
      )
    )[0]

  return await db.begin(async (q) => {
    if (name === 'create_task') {
      await assertFolder(q, args.folder_id, 'task')
      if (args.due_time && !args.due_date) fail('INVALID_ARGUMENT', 'A time requires a due date')
      // Tasks created already completed earn no XP (completed_at stays NULL), matching the web app.
      return (
        await q.unsafe(
          "INSERT INTO tasks(user_id,title,due_date,due_time,priority,folder_id,source,completed,status) VALUES($1,$2,$3,$4,$5,$6,'chatgpt',$7,$8) RETURNING *",
          [
            uid,
            args.title.trim(),
            args.due_date ?? null,
            args.due_time ?? null,
            args.priority ?? 'medium',
            args.folder_id ?? null,
            args.completed ?? false,
            args.completed ? 'done' : 'todo',
          ],
        )
      )[0]
    }

    if (name === 'update_task' || name === 'delete_task') {
      const current = (
        await q.unsafe('SELECT * FROM tasks WHERE id=$1 AND user_id=$2 FOR UPDATE', [args.id, uid])
      )[0]
      if (!current) fail('NOT_FOUND', 'Task not found')
      if (+new Date(current.updated_at) !== Date.parse(args.expected_updated_at))
        fail('VERSION_CONFLICT', 'Task changed. Read it again before editing.')
      if (name === 'delete_task') {
        await q.unsafe('DELETE FROM tasks WHERE id=$1 AND user_id=$2', [args.id, uid])
        return { deleted: true, id: args.id }
      }
      const values = Object.fromEntries(
        Object.entries(args).filter(([key]) => Object.hasOwn(task, key)),
      )
      if (!Object.keys(values).length) fail('INVALID_ARGUMENT', 'Nothing to update')
      if (values.title !== undefined) values.title = values.title.trim()
      await assertFolder(q, values.folder_id, 'task')
      const merged = { ...current, ...values }
      if (merged.due_time && !merged.due_date && args.due_time)
        fail('INVALID_ARGUMENT', 'A time requires a due date')
      if (!merged.due_date) values.due_time = null
      if (values.completed !== undefined) {
        values.status = values.completed ? 'done' : 'todo'
        if (values.completed !== current.completed)
          values.completed_at = values.completed ? new Date() : null
      }
      // Same rule as lib/tasks.js: reminders reset only when the deadline really changes.
      if (
        (values.due_date !== undefined && !sameDate(values.due_date, current.due_date)) ||
        (values.due_time !== undefined && !sameDate(values.due_time, current.due_time))
      ) {
        values.notified_1h = false
        values.notified_1d = false
      }
      const params = Object.values(values)
      const sets = Object.keys(values).map((key, index) => `${key}=$${index + 1}`)
      params.push(args.id, uid)
      return (
        await q.unsafe(
          `UPDATE tasks SET ${sets.join(',')},updated_at=NOW() WHERE id=$${params.length - 1} AND user_id=$${params.length} RETURNING *`,
          params,
        )
      )[0]
    }

    if (name === 'create_note') {
      await assertFolder(q, args.folder_id, 'note')
      const content = args.content ?? ''
      return (
        await q.unsafe(
          'INSERT INTO notes(user_id,title,content,document,folder_id,pinned) VALUES($1,$2,$3,$4::jsonb,$5,$6) RETURNING id,title,content,folder_id,pinned,version,updated_at',
          [
            uid,
            args.title ?? '',
            content,
            JSON.stringify(documentFromText(content)),
            args.folder_id ?? null,
            args.pinned ?? false,
          ],
        )
      )[0]
    }

    if (name === 'update_note') {
      const current = (
        await q.unsafe('SELECT * FROM notes WHERE id=$1 AND user_id=$2 FOR UPDATE', [args.id, uid])
      )[0]
      if (!current) fail('NOT_FOUND', 'Note not found')
      if (current.version !== args.version)
        fail('VERSION_CONFLICT', 'Note changed. Read it again before editing.')
      if (current.deleted_at && args.deleted !== false)
        fail('NOTE_DELETED', 'Restore this note before editing')
      const values = Object.fromEntries(
        Object.entries(args).filter(([key]) => Object.hasOwn(note, key)),
      )
      if (args.deleted !== undefined) values.deleted_at = args.deleted ? new Date() : null
      if (!Object.keys(values).length) fail('INVALID_ARGUMENT', 'Nothing to update')
      await assertFolder(q, values.folder_id, 'note')
      if (args.content !== undefined)
        values.document = JSON.stringify(documentFromText(args.content))
      const params = Object.values(values)
      const sets = Object.keys(values).map(
        (key, index) => `${key}=$${index + 1}${key === 'document' ? '::jsonb' : ''}`,
      )
      params.push(args.id, uid, args.version)
      return (
        await q.unsafe(
          `UPDATE notes SET ${sets.join(',')},version=version+1,updated_at=NOW() WHERE id=$${params.length - 2} AND user_id=$${params.length - 1} AND version=$${params.length} RETURNING id,title,content,folder_id,pinned,version,deleted_at,updated_at`,
          params,
        )
      )[0]
    }

    fail('UNKNOWN_TOOL', 'Unknown tool')
  })
}
