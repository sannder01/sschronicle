import test from 'node:test'
import assert from 'node:assert/strict'
import { validateTimetableEntry } from '../lib/timetable.js'

const validEntry = {
  weekday: 1,
  start_min: 540,
  end_min: 600,
  title: 'Mathematics',
}

test('timetable validation accepts defaults and every weekday', () => {
  assert.deepEqual(validateTimetableEntry(validEntry), {
    ...validEntry,
    kind: 'lecture',
    room: '',
    teacher: '',
    note: '',
    color: 'accent',
  })
  for (let weekday = 1; weekday <= 7; weekday++)
    assert.equal(validateTimetableEntry({ ...validEntry, weekday }).weekday, weekday)
})

test('timetable creation weekdays must contain one to seven distinct valid days', () => {
  for (const weekdays of [[], [1, 1], [0], [8], [1, 2, 3, 4, 5, 6, 7, 1]])
    assert.throws(() => validateTimetableEntry({ ...validEntry, weekdays, weekday: undefined }), {
      status: 400,
    })
  assert.deepEqual(
    validateTimetableEntry({
      start_min: 540,
      end_min: 600,
      title: 'Mathematics',
      weekdays: [1, 3, 5],
    }).weekdays,
    [1, 3, 5],
  )
})

test('timetable times require five minute steps, bounds, and end after start', () => {
  for (const [field, values] of [
    ['start_min', [-5, 1440, 542, 540.5, '540']],
    ['end_min', [0, 1445, 603, 600.5, '600']],
  ])
    for (const value of values)
      assert.throws(() => validateTimetableEntry({ ...validEntry, [field]: value }), {
        status: 400,
      })
  for (const [start_min, end_min] of [
    [600, 600],
    [605, 600],
  ])
    assert.throws(() => validateTimetableEntry({ ...validEntry, start_min, end_min }), {
      status: 400,
    })
})

test('timetable text fields enforce their length limits', () => {
  for (const [field, max] of [
    ['title', 120],
    ['room', 60],
    ['teacher', 80],
    ['note', 500],
  ])
    assert.throws(() => validateTimetableEntry({ ...validEntry, [field]: 'x'.repeat(max + 1) }), {
      status: 400,
    })
})

test('timetable kind and color accept only supported values', () => {
  for (const kind of ['lecture', 'practice', 'lab', 'seminar', 'other'])
    assert.equal(validateTimetableEntry({ ...validEntry, kind }).kind, kind)
  for (const color of [
    'accent',
    'blue',
    'indigo',
    'teal',
    'green',
    'orange',
    'red',
    'pink',
    'graphite',
  ])
    assert.equal(validateTimetableEntry({ ...validEntry, color }).color, color)
  assert.throws(() => validateTimetableEntry({ ...validEntry, kind: 'unknown' }), { status: 400 })
  assert.throws(() => validateTimetableEntry({ ...validEntry, color: 'purple' }), { status: 400 })
})

test('timetable partial updates validate supplied fields and reject empty patches', () => {
  assert.deepEqual(validateTimetableEntry({ title: '  Updated  ' }, true), { title: 'Updated' })
  assert.deepEqual(validateTimetableEntry({ weekday: 7, note: '' }, true), { weekday: 7, note: '' })
  assert.throws(() => validateTimetableEntry({}, true), { status: 400 })
  assert.throws(() => validateTimetableEntry({ start_min: 541 }, true), { status: 400 })
})
