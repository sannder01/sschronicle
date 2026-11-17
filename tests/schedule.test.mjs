import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canvasCoordinate,
  validateCanvasPositions,
  validateScheduleBlock,
  validateScheduleLinkBody,
} from '../lib/schedule.js'
import { defaultSettings, validateSettings } from '../lib/profile.js'

const validBlock = {
  day: '2026-11-16',
  start_min: 540,
  end_min: 600,
  title: 'Focus time',
}

test('schedule block validation accepts valid input and normalizes optional note and color', () => {
  assert.deepEqual(validateScheduleBlock(validBlock), {
    day: '2026-11-16',
    start_min: 540,
    end_min: 600,
    title: 'Focus time',
    note: null,
    color: 'accent',
  })
  assert.equal(validateScheduleBlock({ ...validBlock, note: '' }).note, null)
})

test('schedule validation rejects invalid days, minutes, ranges, colors and long titles', () => {
  for (const day of [null, '', '2025-02-29', '2026-11-16T00:00:00Z'])
    assert.throws(() => validateScheduleBlock({ ...validBlock, day }), { status: 400 })
  for (const start_min of [-5, 1440, 542, 540.5, '540'])
    assert.throws(() => validateScheduleBlock({ ...validBlock, start_min }), { status: 400 })
  for (const end_min of [0, 1445, 603, 600.5, '600'])
    assert.throws(() => validateScheduleBlock({ ...validBlock, end_min }), { status: 400 })
  for (const [start_min, end_min] of [
    [600, 600],
    [605, 600],
  ])
    assert.throws(() => validateScheduleBlock({ ...validBlock, start_min, end_min }), {
      status: 400,
    })
  assert.throws(() => validateScheduleBlock({ ...validBlock, color: 'purple' }), { status: 400 })
  assert.throws(() => validateScheduleBlock({ ...validBlock, title: 'x'.repeat(121) }), {
    status: 400,
  })
})

test('schedule PATCH validates the supplied fields and rejects an empty patch', () => {
  assert.deepEqual(validateScheduleBlock({ done: true }, true), { done: true })
  assert.throws(() => validateScheduleBlock({}, true), { status: 400 })
})

test('canvas coordinates accept bounded finite numbers and null, and reject other values', () => {
  assert.equal(canvasCoordinate(null, 'canvas_x'), null)
  assert.equal(canvasCoordinate(-50000), -50000)
  assert.equal(canvasCoordinate(50000), 50000)
  for (const value of [NaN, Infinity, -Infinity, '4', -50000.1, 50000.1])
    assert.throws(() => canvasCoordinate(value), { status: 400 })
})

test('canvas positions require 1 to 60 entries with valid ids and numeric coordinates', () => {
  assert.deepEqual(validateCanvasPositions([{ id: 1, x: 0, y: -2 }]), [{ id: 1, x: 0, y: -2 }])
  assert.throws(() => validateCanvasPositions([]), { status: 400 })
  assert.throws(
    () =>
      validateCanvasPositions(Array.from({ length: 61 }, (_, id) => ({ id: id + 1, x: 0, y: 0 }))),
    { status: 400 },
  )
  for (const id of [0, -1, 1.5, 'bad'])
    assert.throws(() => validateCanvasPositions([{ id, x: 0, y: 0 }]), { status: 400 })
  for (const value of [NaN, Infinity, '0', null, -50001, 50001])
    assert.throws(() => validateCanvasPositions([{ id: 1, x: value, y: 0 }]), { status: 400 })
})

test('schedule link validation rejects self links and invalid ids and normalizes order', () => {
  assert.deepEqual(validateScheduleLinkBody({ from_id: 9, to_id: 2 }), { from_id: 2, to_id: 9 })
  assert.throws(() => validateScheduleLinkBody({ from_id: 2, to_id: 2 }), { status: 400 })
  for (const value of [0, 1.5, 'bad'])
    assert.throws(() => validateScheduleLinkBody({ from_id: value, to_id: 3 }), { status: 400 })
})

test('profile accent defaults to blue and only accepts the supported palette', () => {
  assert.equal(defaultSettings.accent, 'blue')
  for (const accent of ['blue', 'indigo', 'teal', 'green', 'orange', 'red', 'pink', 'graphite'])
    assert.equal(validateSettings({ accent }).accent, accent)
  assert.throws(() => validateSettings({ accent: 'purple' }), { status: 400 })
})
