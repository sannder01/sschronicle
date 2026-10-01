import test from 'node:test'
import assert from 'node:assert/strict'
import { NoteAutosave } from '../lib/notes/autosave.mjs'
import { legacyDocument, documentText, validateDocument, noteGroup } from '../lib/notes/format.mjs'

class MemoryStorage {
  data = new Map()
  get length() {
    return this.data.size
  }
  key(index) {
    return [...this.data.keys()][index]
  }
  getItem(key) {
    return this.data.get(key) ?? null
  }
  setItem(key, value) {
    this.data.set(key, String(value))
  }
  removeItem(key) {
    this.data.delete(key)
  }
}
const note = (id = 1, version = 1, title = 'Initial') => ({
  id,
  version,
  title,
  document: legacyDocument('First line\n\nLast line'),
  deleted_at: null,
  folder_id: null,
  updated_at: '2026-09-30T16:00:00Z',
  created_at: '2026-09-28T10:00:00Z',
})
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}
const setup = (request, options = {}) =>
  new NoteAutosave({
    userId: 'account-a',
    clientId: 'tab-a',
    storage: new MemoryStorage(),
    delay: 60000,
    request,
    ...options,
  })

test('legacy migration preserves blank lines, line breaks, and literal untrusted HTML', () => {
  const content = '<script>alert(1)</script>\r\n\r\nParagraph\n'
  const document = legacyDocument(content)
  assert.equal(documentText(validateDocument(document)), '<script>alert(1)</script>\n\nParagraph\n')
  assert.equal(document.content.length, 4)
  assert.deepEqual(legacyDocument(''), { type: 'doc', content: [{ type: 'paragraph' }] })
})

test('rich text validates checklists and removes unknown attributes without rendering HTML', () => {
  const document = {
    type: 'doc',
    attrs: { onclick: 'bad' },
    content: [
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: true, onclick: 'bad' },
            content: [
              {
                type: 'paragraph',
                content: [
                  { type: 'text', text: 'Walk', marks: [{ type: 'bold', attrs: { bad: 1 } }] },
                ],
              },
            ],
          },
        ],
      },
    ],
  }
  const validated = validateDocument(document)
  assert.equal(documentText(validated), 'Walk')
  assert.equal(validated.attrs, undefined)
  assert.deepEqual(validated.content[0].content[0].attrs, { checked: true })
  assert.throws(() =>
    validateDocument({
      type: 'doc',
      content: [{ type: 'image', attrs: { src: 'javascript:bad' } }],
    }),
  )
  assert.throws(() =>
    validateDocument({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'X', marks: [{ type: 'link', attrs: { href: 'javascript:x' } }] },
          ],
        },
      ],
    }),
  )
  assert.throws(() =>
    validateDocument({
      type: 'doc',
      content: [
        {
          type: 'taskList',
          content: [
            { type: 'taskItem', attrs: { checked: 'false' }, content: [{ type: 'paragraph' }] },
          ],
        },
      ],
    }),
  )
  assert.throws(() => validateDocument(legacyDocument('x'.repeat(350001))))
})

test('grouping uses the user timezone including yesterday across midnight', () => {
  const n = note()
  n.updated_at = '2026-09-30T20:00:00Z'
  assert.equal(
    noteGroup(n, {
      now: new Date('2026-09-30T21:00:00Z'),
      timezone: 'Asia/Qyzylorda',
      language: 'en',
    }),
    'Today',
  )
  n.updated_at = '2026-09-30T17:59:00Z'
  assert.equal(
    noteGroup(n, {
      now: new Date('2026-09-30T21:00:00Z'),
      timezone: 'Asia/Qyzylorda',
      language: 'en',
    }),
    'Yesterday',
  )
})

test('rapid input sends one request at a time and uses the acknowledged version for the newest text', async () => {
  const first = deferred(),
    calls = []
  const manager = setup(async (id, body) => {
    calls.push({ id, ...body })
    if (calls.length === 1) return first.promise
    return { ...note(Number(id), body.version + 1), ...body, version: body.version + 1 }
  })
  manager.seed(note())
  manager.update(1, { title: 'A' })
  const flushed = manager.flush(1)
  manager.update(1, { title: 'AB' })
  manager.update(1, { title: 'ABC' })
  assert.equal(calls.length, 1)
  assert.equal(manager.hasPending(), true)
  first.resolve(note(1, 2, 'A'))
  await flushed
  assert.deepEqual(
    calls.map((call) => [call.title, call.version]),
    [
      ['A', 1],
      ['ABC', 2],
    ],
  )
  assert.equal(manager.snapshot(1).data.title, 'ABC')
  assert.equal(manager.snapshot(1).version, 3)
  assert.equal(manager.snapshot(1).status, 'saved')
  assert.equal(manager.storage.length, 0)
  await manager.dispose()
})

test('switching A to B preserves independent queues even when B responds first', async () => {
  const waits = { 1: deferred(), 2: deferred() },
    calls = []
  const manager = setup((id, body) => {
    calls.push([id, body.title])
    return waits[id].promise
  })
  manager.seed(note(1))
  manager.seed(note(2))
  manager.update(1, { title: 'Note A draft' })
  const saveA = manager.flush(1)
  manager.update(2, { title: 'Note B draft' })
  const saveB = manager.flush(2)
  waits[2].resolve(note(2, 2, 'Note B draft'))
  await saveB
  assert.equal(manager.snapshot(1).status, 'saving')
  assert.equal(manager.snapshot(2).data.title, 'Note B draft')
  waits[1].resolve(note(1, 2, 'Note A draft'))
  await saveA
  assert.equal(manager.snapshot(2).data.title, 'Note B draft')
  assert.deepEqual(calls, [
    ['1', 'Note A draft'],
    ['2', 'Note B draft'],
  ])
  await manager.dispose()
})

test('network failure retains the draft and retry sends latest input with the same version', async () => {
  const calls = []
  const manager = setup(async (id, body) => {
    calls.push(body)
    if (calls.length === 1) throw new Error('Offline')
    return { ...note(Number(id), body.version + 1), ...body, version: body.version + 1 }
  })
  manager.seed(note())
  manager.update(1, { title: 'Offline draft' })
  assert.equal(await manager.flush(1), false)
  assert.equal(manager.snapshot(1).status, 'error')
  assert.equal(manager.storage.length, 1)
  manager.update(1, { title: 'Newest offline draft' })
  assert.equal(await manager.flush(1, true), true)
  assert.deepEqual(
    calls.map((body) => [body.title, body.version]),
    [
      ['Offline draft', 1],
      ['Newest offline draft', 1],
    ],
  )
  await manager.dispose()
})

test('lost response becomes a version conflict, not a blind overwrite; explicit local resolution uses new version', async () => {
  const calls = []
  const manager = setup(async (id, body) => {
    calls.push(body)
    if (calls.length === 1)
      throw Object.assign(new Error('Conflict'), {
        status: 409,
        data: { current: note(1, 7, 'Other device') },
      })
    return { ...note(1, body.version + 1), ...body, version: body.version + 1 }
  })
  manager.seed(note())
  manager.update(1, { title: 'My draft' })
  await manager.flush(1)
  assert.equal(manager.snapshot(1).status, 'conflict')
  assert.equal(manager.snapshot(1).data.title, 'My draft')
  assert.equal(await manager.flush(1, true), false)
  assert.equal(calls.length, 1)
  await manager.resolve(1, 'local')
  assert.equal(calls[1].version, 7)
  assert.equal(calls[1].title, 'My draft')
  assert.equal(manager.snapshot(1).version, 8)
  await manager.dispose()
})

test('server conflict resolution and recovered drafts never send an automatic overwrite', async () => {
  const storage = new MemoryStorage(),
    calls = []
  storage.setItem(
    'chronicle:note-draft:v1:account-a:1:old-tab',
    JSON.stringify({
      data: { title: 'Recovered', document: legacyDocument('recovery') },
      version: 1,
      at: 1,
    }),
  )
  const manager = setup((...args) => calls.push(args), { storage })
  const restored = manager.seed(note(1, 3, 'Server'))
  assert.equal(restored.status, 'recovered')
  assert.equal(restored.data.title, 'Recovered')
  assert.equal(await manager.flush(1, true), false)
  await manager.resolve(1, 'server')
  assert.equal(manager.snapshot(1).data.title, 'Server')
  assert.equal(calls.length, 0)
  assert.equal(storage.length, 0)
  await manager.dispose()
})

test('account and concurrent tab drafts remain isolated, including a newer foreign recovery', async () => {
  const storage = new MemoryStorage()
  const foreignKey = 'chronicle:note-draft:v1:account-a:1:foreign'
  storage.setItem(
    foreignKey,
    JSON.stringify({
      data: { title: 'Old foreign', document: legacyDocument('old') },
      version: 1,
      at: 1,
    }),
  )
  const accountB = setup(() => assert.fail('Unexpected request'), { userId: 'account-b', storage })
  assert.equal(accountB.seed(note()).status, 'saved')
  const accountA = setup(() => assert.fail('Unexpected request'), { storage })
  accountA.seed(note())
  const newer = JSON.stringify({
    data: { title: 'Newest foreign', document: legacyDocument('new') },
    version: 1,
    at: 2,
  })
  storage.setItem(foreignKey, newer)
  await accountA.resolve(1, 'server')
  assert.equal(storage.getItem(foreignKey), newer)
  await accountA.dispose()
  await accountB.dispose()
})

test('delete cannot forget a queued save, and late writes cannot resurrect a deleted note', async () => {
  const wait = deferred()
  const manager = setup(() => wait.promise)
  manager.seed(note())
  manager.update(1, { title: 'Final text' })
  const flush = manager.flush(1)
  assert.throws(() => manager.forget(1), /Unsaved changes/)
  wait.resolve(note(1, 2, 'Final text'))
  await flush
  manager.accept({ ...note(1, 3, 'Final text'), deleted_at: '2026-09-30T19:00:00Z' })
  manager.update(1, { title: 'Attempt resurrection' })
  assert.equal(manager.snapshot(1).data.title, 'Final text')
  assert.equal(manager.hasPending(), false)
  manager.forget(1)
  assert.equal(manager.snapshot(1), null)
  await manager.dispose()
})

test('unmount flushes pending text and a failed write remains recoverable', async () => {
  const storage = new MemoryStorage()
  const manager = setup(
    async () => {
      throw Object.assign(new Error('Session expired'), { status: 401 })
    },
    { storage },
  )
  manager.seed(note())
  manager.update(1, { title: 'Keep me' })
  await manager.dispose()
  assert.equal(storage.length, 1)
  const next = setup(() => assert.fail('Recovery must wait for review'), {
    storage,
    clientId: 'new-tab',
  })
  assert.equal(next.seed(note()).data.title, 'Keep me')
  await next.dispose()
})

test('unavailable local storage is reported honestly and a saved recovery copy clears the failed source draft', async () => {
  const storage = {
    setItem() {
      throw new Error('Quota exceeded')
    },
    removeItem() {},
    get length() {
      return 0
    },
  }
  const manager = setup(
    async () => {
      throw new Error('Offline')
    },
    { storage },
  )
  manager.seed(note())
  manager.update(1, { title: 'Draft' })
  assert.equal(manager.snapshot(1).storageError, true)
  await manager.flush(1)
  await manager.discardAfterCopy(1)
  assert.equal(manager.hasPending(), false)
  assert.equal(manager.snapshot(1).data.title, 'Initial')
  await manager.dispose()
})
