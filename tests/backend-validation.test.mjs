import test from 'node:test'
import assert from 'node:assert/strict'
import { date, time, timezone, text, positiveId, boolean, hexColor } from '../lib/validation.js'

test('calendar input rejects rollover dates and ambiguous timestamps', () => {
  assert.equal(date('2024-02-29'), '2024-02-29')
  assert.equal(date(null), null)
  for (const value of [
    '2025-02-29',
    '2026-04-31',
    '2026-09-30T23:00:00Z',
    '2026-9-1',
    'not-a-date',
  ]) {
    assert.throws(() => date(value), { status: 400 })
  }
})
test('deadline times are exact local HH:mm without offsets', () => {
  assert.equal(time('00:00'), '00:00')
  assert.equal(time('23:59'), '23:59')
  for (const value of ['24:00', '12:60', '9:00', '09:00Z', 123])
    assert.throws(() => time(value), { status: 400 })
  assert.equal(time(''), null)
})
test('timezone, identifiers and bounded fields validate types and sizes', () => {
  assert.equal(timezone('Asia/Qyzylorda'), 'Asia/Qyzylorda')
  assert.throws(() => timezone('Mars/Olympus'), { status: 400 })
  assert.equal(positiveId('12'), 12)
  for (const value of [0, -1, '1 OR 1=1', true, {}, 2147483648])
    assert.throws(() => positiveId(value), { status: 400 })
  assert.equal(text('  title  '), 'title')
  assert.throws(() => text('x'.repeat(101), { max: 100 }), { status: 400 })
  assert.throws(() => text('a\0b'), { status: 400 })
  assert.throws(() => boolean('true'), { status: 400 })
  assert.equal(hexColor('#00AaFF'), '#00AaFF')
  assert.throws(() => hexColor('red;display:none'), { status: 400 })
})
