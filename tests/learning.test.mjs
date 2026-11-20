import test from 'node:test'
import assert from 'node:assert/strict'
import {
  nextSteps,
  mapStats,
  wouldCreateCycle,
  topoOrder,
  nodeTree,
  sanitizeSuggestion,
} from '../lib/learning-shape.mjs'
import { requestLearningSuggestion } from '../lib/learning-ai.js'

const testConfig = { provider: 'groq', key: 'test-only', model: 'openai/gpt-oss-120b' }

const nodes = [
  { id: 1, kind: 'topic', title: 'A', status: 'mastered', position: 0 },
  { id: 2, kind: 'goal', title: 'B', status: 'learning', position: 1 },
  { id: 3, kind: 'topic', title: 'C', status: 'not_started', position: 2 },
]
const edges = [
  { from_id: 1, to_id: 2 },
  { from_id: 2, to_id: 3 },
]

test('next step waits for prerequisites and prioritizes the active status', () => {
  assert.deepEqual(
    nextSteps(nodes, edges, 2).map((node) => node.id),
    [2],
  )
  assert.deepEqual(
    nextSteps(
      nodes.map((n) => ({ ...n, status: n.id === 1 ? 'mastered' : 'not_started' })),
      edges,
      2,
    ).map((n) => n.id),
    [2],
  )
})

test('map stats include status, goals, percent and latest activity', () => {
  const result = mapStats(
    nodes.map((n, i) => ({ ...n, status_changed_at: `2026-01-0${i + 1}T00:00:00Z` })),
  )
  assert.equal(result.nodes, 3)
  assert.equal(result.mastered, 1)
  assert.equal(result.goals, 1)
  assert.equal(result.goals_done, 0)
  assert.equal(result.percent, 33)
  assert.equal(result.last_activity, '2026-01-03T00:00:00.000Z')
})

test('cycle detection and topological order follow prerequisites', () => {
  assert.equal(wouldCreateCycle(edges, 3, 1), true)
  assert.equal(wouldCreateCycle(edges, 1, 3), false)
  assert.deepEqual(
    topoOrder([...nodes].reverse(), edges).map((n) => n.id),
    [1, 2, 3],
  )
})

test('node tree is depth first and handles broken parent links', () => {
  assert.deepEqual(
    nodeTree([
      { id: 1, parent_id: null },
      { id: 2, parent_id: 1 },
      { id: 3, parent_id: 2 },
    ]).map((n) => [n.id, n.depth]),
    [
      [1, 0],
      [2, 1],
      [3, 2],
    ],
  )
  assert.equal(nodeTree([{ id: 4, parent_id: 99 }])[0].depth, 0)
})

test('suggestion sanitizing keeps valid parts and drops unsafe ones', () => {
  const clean = sanitizeSuggestion(
    {
      summary: 'ok',
      nodes: [
        { ref: 'new:a', kind: 'topic', title: ' A ' },
        { ref: 'b', kind: 'subtopic', title: 'B', parent_ref: 'new:a' },
        { ref: 'new:c', kind: 'folder', title: 'C', parent_ref: 'id:9' },
        { ref: 'new:d', kind: 'topic', title: '   ' },
        { ref: 'new:a', kind: 'topic', title: 'duplicate' },
        { ref: 'new:e', kind: 'topic', title: 'x'.repeat(200) },
      ],
      edges: [
        { from_ref: 'new:a', to_ref: 'id:2' },
        { from_ref: 'id:2', to_ref: 'new:a' },
        { from_ref: 'new:a', to_ref: 'id:9' },
        { from_ref: 'new:a', to_ref: 'new:a' },
        { from_ref: 'new:a', to_ref: 'id:2' },
        { from_ref: 'new:a', to_ref: 'b' },
      ],
    },
    [2],
  )
  assert.deepEqual(
    clean.nodes.map((n) => [n.ref, n.kind, n.title.length, n.parent_ref]),
    [
      ['new:a', 'topic', 1, null],
      ['new:b', 'subtopic', 1, 'new:a'],
      ['new:c', 'topic', 1, null],
      ['new:e', 'topic', 160, null],
    ],
  )
  assert.deepEqual(clean.edges, [
    { from_ref: 'new:a', to_ref: 'id:2' },
    { from_ref: 'new:a', to_ref: 'new:b' },
  ])
  const loop = sanitizeSuggestion({
    summary: '',
    nodes: [
      { ref: 'new:a', kind: 'topic', title: 'A', parent_ref: 'new:b' },
      { ref: 'new:b', kind: 'subtopic', title: 'B', parent_ref: 'new:a' },
    ],
    edges: [],
  })
  assert.ok(loop.nodes.some((n) => n.parent_ref === null))
  const many = sanitizeSuggestion({
    summary: '',
    nodes: Array.from({ length: 50 }, (_, i) => ({ ref: 'n' + i, kind: 'goal', title: 'A' })),
    edges: [],
  })
  assert.equal(many.nodes.length, 40)
  for (const bad of [null, [], 'text', { summary: '', nodes: [], edges: [] }])
    assert.throws(() => sanitizeSuggestion(bad, [2]))
})

test('cycle check works for map nesting and string refs', () => {
  // maps 1 > 2 > 3: putting 1 inside 3 (new link 3 -> 1) would loop
  const nesting = [
    { from_id: 1, to_id: 2 },
    { from_id: 2, to_id: 3 },
  ]
  assert.equal(wouldCreateCycle(nesting, 3, 1), true)
  assert.equal(wouldCreateCycle(nesting, 1, 3), false)
  assert.equal(wouldCreateCycle([{ from_id: 'new:a', to_id: 'new:b' }], 'new:b', 'new:a'), true)
})

test('AI module uses mocked fetch and rejects an invalid provider payload', async () => {
  const previous = process.env.GROQ_API_KEY
  process.env.GROQ_API_KEY = 'test-only'
  try {
    const suggestion = await requestLearningSuggestion({
      mode: 'structure',
      context: {},
      config: testConfig,
      fetchImpl: async (_url, options) => {
        assert.equal(options.headers.Authorization, 'Bearer test-only')
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"summary":"ok","nodes":[],"edges":[]}' } }],
          }),
        }
      },
    })
    assert.equal(suggestion.summary, 'ok')
    await assert.rejects(
      requestLearningSuggestion({
        mode: 'structure',
        context: {},
        config: testConfig,
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({ choices: [{ message: { content: 'nope' } }] }),
        }),
      }),
      { code: 'AI_BAD_RESPONSE' },
    )
  } finally {
    if (previous === undefined) delete process.env.GROQ_API_KEY
    else process.env.GROQ_API_KEY = previous
  }
})

test('AI module waits out a short provider rate limit and names other failures', async () => {
  const previous = process.env.GROQ_API_KEY
  process.env.GROQ_API_KEY = 'test-only'
  const reply = (status, content, retry = '1') => ({
    ok: status === 200,
    status,
    headers: { get: (name) => (name === 'retry-after' ? retry : null) },
    json: async () => ({ choices: [{ message: { content } }] }),
  })
  const good = '{"summary":"ok","nodes":[],"edges":[]}'
  try {
    // busy once, then fine: one retry, and the low reasoning effort is requested
    let calls = 0
    const ok = await requestLearningSuggestion({
      mode: 'route',
      context: {},
      config: testConfig,
      fetchImpl: async (_url, options) => {
        calls++
        assert.equal(JSON.parse(options.body).reasoning_effort, 'low')
        return calls === 1 ? reply(429, '') : reply(200, good)
      },
    })
    assert.equal(ok.summary, 'ok')
    assert.equal(calls, 2)
    // still busy after the retry: a clear "busy" error with the wait time
    await assert.rejects(
      requestLearningSuggestion({
        mode: 'route',
        context: {},
        config: testConfig,
        fetchImpl: async () => reply(429, ''),
      }),
      (error) =>
        error.code === 'AI_BUSY' && error.status === 429 && error.details.retry_after === 1,
    )
    // a long wait is not retried in the request
    calls = 0
    await assert.rejects(
      requestLearningSuggestion({
        mode: 'route',
        context: {},
        config: testConfig,
        fetchImpl: async () => (calls++, reply(429, '', '40')),
      }),
      { code: 'AI_BUSY' },
    )
    assert.equal(calls, 1)
    await assert.rejects(
      requestLearningSuggestion({
        mode: 'route',
        context: {},
        config: testConfig,
        fetchImpl: async () => reply(401, ''),
      }),
      { code: 'AI_KEY_INVALID' },
    )
    await assert.rejects(
      requestLearningSuggestion({
        mode: 'route',
        context: {},
        config: testConfig,
        fetchImpl: async () => reply(500, ''),
      }),
      { code: 'AI_PROVIDER_ERROR' },
    )
  } finally {
    if (previous === undefined) delete process.env.GROQ_API_KEY
    else process.env.GROQ_API_KEY = previous
  }
})

test('AI module asks once more when a structure answer has no topics', async () => {
  const previous = process.env.GROQ_API_KEY
  process.env.GROQ_API_KEY = 'test-only'
  let calls = 0
  try {
    const result = await requestLearningSuggestion({
      mode: 'structure',
      context: {},
      config: testConfig,
      fetchImpl: async () => {
        calls++
        const content =
          calls === 1
            ? '{"summary":"only words","nodes":[],"edges":[]}'
            : '{"summary":"ok","nodes":[{"ref":"new:a","kind":"topic","title":"A"}],"edges":[]}'
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content } }] }),
        }
      },
    })
    assert.equal(calls, 2)
    assert.equal(result.nodes.length, 1)
  } finally {
    if (previous === undefined) delete process.env.GROQ_API_KEY
    else process.env.GROQ_API_KEY = previous
  }
})
