import test from 'node:test'
import assert from 'node:assert/strict'
import { validateTaskCanvasPositions, validateTaskLinkBody } from '../lib/task-board.js'

test('task canvas positions allow up to 200 valid entries', () => {
  const positions = Array.from({ length: 200 }, (_, index) => ({
    id: index + 1,
    x: index,
    y: -index,
  }))
  assert.equal(validateTaskCanvasPositions(positions).length, 200)
  assert.throws(() => validateTaskCanvasPositions([...positions, { id: 201, x: 0, y: 0 }]), {
    status: 400,
  })
  assert.throws(() => validateTaskCanvasPositions([]), { status: 400 })
})

test('task canvas positions reject invalid coordinates and ids', () => {
  for (const value of [NaN, Infinity, -Infinity, '2', null, -50000.1, 50000.1])
    assert.throws(() => validateTaskCanvasPositions([{ id: 1, x: value, y: 0 }]), { status: 400 })
  for (const value of [NaN, Infinity, '2', null, -50000.1, 50000.1])
    assert.throws(() => validateTaskCanvasPositions([{ id: 1, x: 0, y: value }]), { status: 400 })
  for (const id of [0, -1, 1.5, 'bad'])
    assert.throws(() => validateTaskCanvasPositions([{ id, x: 0, y: 0 }]), { status: 400 })
})

test('task links reject self-links and normalize ids', () => {
  assert.deepEqual(validateTaskLinkBody({ from_id: 12, to_id: 3 }), { from_id: 3, to_id: 12 })
  assert.throws(() => validateTaskLinkBody({ from_id: 4, to_id: 4 }), { status: 400 })
})
