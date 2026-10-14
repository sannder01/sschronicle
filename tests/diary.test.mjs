import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyDiary, validateDiary, validDiaryDate, LIMITS } from '../lib/diary/format.mjs'
import { DiaryWriter } from '../lib/diary/autosave.mjs'

const memory = () => {
  const values = new Map()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) }
}
const entry = (document = emptyDiary(), version = 0) => ({ entry_date: '2026-10-15', version, document })
const writerFor = (options = {}) => new DiaryWriter({ entry: entry(), userId: 'a', storage: memory(), delay: 60000, request: async ({ document, version }) => entry(document, version + 1), ...options })

test('diary dates remain real calendar dates within PostgreSQL bounds', () => {
  for (const day of ['2024-02-29', '0001-01-01', '9999-12-31']) assert.equal(validDiaryDate(day), true)
  for (const day of ['0000-01-01', '2026-02-29', '2026-04-31', '2026-1-01', '2026-10-15T00:00:00Z', undefined]) assert.equal(validDiaryDate(day), false)
})
test('validation preserves plain text and bounded vector strokes and strips unknown fields', () => {
  const document = { ...emptyDiary(), text: '<script>never execute</script>', unknown: 'ignored', cards: [{ id: 'card-1', color: 'sage', text: 'A thought', onclick: 'bad' }], strokes: [{ id: 'stroke-1', color: 'ink', width: 4, points: [[0.12345678, 1], [0, 0]] }] }
  const result = validateDiary(document)
  assert.equal(result.text, document.text)
  assert.equal(result.unknown, undefined)
  assert.equal(result.cards[0].onclick, undefined)
  assert.deepEqual(result.strokes[0].points, [[0.12346, 1], [0, 0]])
  assert.notEqual(result.cards, document.cards)
})
test('validation rejects unsafe shapes and excessive rendering work', () => {
  const bad = [null, [], { ...emptyDiary(), paper: 'html' }, { ...emptyDiary(), mood: {} }, { ...emptyDiary(), text: 'a'.repeat(LIMITS.text + 1) }, { ...emptyDiary(), cards: [{ id: '<svg>', text: '', color: 'sand' }] }, { ...emptyDiary(), strokes: [{ id: 'x', color: 'url(https://example.test)', width: 4, points: [[0, 0]] }] }, { ...emptyDiary(), strokes: [{ id: 'x', color: 'ink', width: 4, points: [[Infinity, 0]] }] }, { ...emptyDiary(), strokes: [{ id: 'x', color: 'ink', width: 4, points: [[-0.1, 0]] }] }, { ...emptyDiary(), cards: [{ id: 'x', color: 'sand', text: '' }, { id: 'x', color: 'rose', text: '' }] }, { ...emptyDiary(), strokes: Array.from({ length: 11 }, (_, i) => ({ id: `s${i}`, color: 'ink', width: 2, points: Array.from({ length: 2000 }, () => [0, 0]) })) }]
  for (const value of bad) assert.throws(() => validateDiary(value))
})
test('one serial writer preserves edits made during an in-flight save', async () => {
  let release
  const calls = []
  const writer = writerFor({ request: async (body) => {
    calls.push(body)
    if (calls.length === 1) await new Promise((resolve) => { release = resolve })
    return entry(body.document, body.version + 1)
  } })
  writer.update({ text: 'first' })
  const saving = writer.flush()
  writer.update({ text: 'second' })
  assert.equal(calls.length, 1)
  release()
  assert.equal(await saving, true)
  assert.deepEqual(calls.map((call) => [call.version, call.document.text]), [[0, 'first'], [1, 'second']])
  assert.equal(writer.version, 2)
  assert.equal(writer.dirty, false)
  await writer.dispose()
})
test('failed saves keep drafts and refresh requires explicit choice before replay', async () => {
  const storage = memory()
  const writer = writerFor({ storage, request: async () => { throw new Error('offline') } })
  writer.update({ text: 'private thought' })
  assert.equal(await writer.flush(), false)
  assert.equal(writer.status, 'error')
  await writer.dispose()
  let calls = 0
  const restored = writerFor({ storage, request: async (body) => { calls++; return entry(body.document, body.version + 1) } })
  assert.equal(restored.status, 'recovered')
  assert.equal(restored.document.text, 'private thought')
  assert.equal(await restored.flush(), false)
  assert.equal(calls, 0)
  await restored.resolve('local')
  assert.equal(calls, 1)
  assert.equal(storage.getItem(restored.key), null)
  await restored.dispose()
})
test('stale versions stop automatic writes and keep server content available', async () => {
  const server = entry({ ...emptyDiary(), text: 'other window' }, 7)
  const writer = writerFor({ request: async () => { throw Object.assign(new Error('conflict'), { status: 409, data: { current: server } }) } })
  writer.update({ text: 'my window' })
  await writer.flush()
  assert.equal(writer.status, 'conflict')
  assert.equal(writer.document.text, 'my window')
  await writer.resolve('server')
  assert.equal(writer.document.text, 'other window')
  assert.equal(writer.version, 7)
  assert.equal(writer.dirty, false)
  await writer.dispose()
})
test('drafts are isolated by account and date and disposal flushes pending changes', async () => {
  const storage = memory()
  const a = writerFor({ storage }), b = writerFor({ storage, userId: 'b' })
  const tomorrow = writerFor({ storage, entry: { ...entry(), entry_date: '2026-10-16' } })
  assert.notEqual(a.key, b.key)
  assert.notEqual(a.key, tomorrow.key)
  a.update({ text: 'save before leaving' })
  await a.dispose()
  assert.equal(a.version, 1)
  assert.equal(a.dirty, false)
  assert.equal(storage.getItem(a.key), null)
  await b.dispose(); await tomorrow.dispose()
})
