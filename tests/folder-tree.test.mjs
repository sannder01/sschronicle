import test from 'node:test'
import assert from 'node:assert/strict'
import { wouldCreateCycle, folderDepths, folderTree, descendantIds } from '../lib/folder-shape.mjs'

const folders = [
  { id: 1, parent_id: null, name: 'Work' },
  { id: 2, parent_id: 1, name: 'Project A' },
  { id: 3, parent_id: 2, name: 'Design' },
  { id: 4, parent_id: null, name: 'Home' },
]

test('a folder cannot move into itself or its own subfolder', () => {
  assert.equal(wouldCreateCycle(folders, 1, 1), true)
  assert.equal(wouldCreateCycle(folders, 1, 3), true)
  assert.equal(wouldCreateCycle(folders, 3, 4), false)
  assert.equal(wouldCreateCycle(folders, 3, null), false)
})

test('tree order puts children right after their parent with depth', () => {
  assert.deepEqual(
    folderTree(folders).map((f) => [f.name, f.depth]),
    [['Work', 0], ['Project A', 1], ['Design', 2], ['Home', 0]],
  )
  assert.equal(folderDepths(folders).get(3), 2)
})

test('descendants include the folder and everything nested in it', () => {
  assert.deepEqual([...descendantIds(folders, 1)].sort(), [1, 2, 3])
  assert.deepEqual([...descendantIds(folders, 4)], [4])
})

test('corrupt cyclic data never loops forever, lists every folder and refuses moves into it', () => {
  const broken = [
    { id: 1, parent_id: 2 },
    { id: 2, parent_id: 1 },
  ]
  assert.equal(folderTree(broken).length, 2)
  // a parent chain that never ends is refused rather than trusted
  assert.equal(wouldCreateCycle(broken, 5, 1), true)
})
