import test from 'node:test'
import assert from 'node:assert/strict'
import { open, seal, sealAvailable } from '../lib/secret-box.js'
import { chatCompletion, defaultModel, listModels, PROVIDERS } from '../lib/ai-providers.js'
import { requestLearningSuggestion } from '../lib/learning-ai.js'

function withEnv(values, callback) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]))
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    })
}

test('secret box round trips and detects tampering and wrong secrets', async () => {
  await withEnv({ AI_KEYS_SECRET: 'secret-one', NEXTAUTH_SECRET: undefined }, () => {
    const sealed = seal('private-key-value')
    assert.match(sealed, /^v1\./)
    assert.equal(open(sealed), 'private-key-value')
    const parts = sealed.split('.')
    parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1)
    assert.throws(() => open(parts.join('.')))
  })
  await withEnv({ AI_KEYS_SECRET: 'secret-one', NEXTAUTH_SECRET: undefined }, () => {
    const sealed = seal('private-key-value')
    process.env.AI_KEYS_SECRET = 'secret-two'
    assert.throws(() => open(sealed))
  })
})

test('secret box reports unavailable when no secret is configured', async () => {
  await withEnv({ AI_KEYS_SECRET: undefined, NEXTAUTH_SECRET: undefined }, () => {
    assert.equal(sealAvailable(), false)
    assert.throws(() => seal('value'), /AI_KEYS_UNAVAILABLE/)
  })
})

test('model listing filters non-chat models, strips Gemini prefixes and selects defaults', async () => {
  const fixture = {
    data: [
      { id: 'models/gemini-2.5-flash' },
      { id: 'models/gemini-2.5-flash-lite' },
      { id: 'models/text-embedding-004' },
      { id: 'models/gemini-2.5-pro-preview' },
    ],
  }
  const models = await listModels('gemini', 'secret-key', {
    fetchImpl: async (url, options) => {
      assert.equal(url, PROVIDERS.gemini.baseUrl + '/models')
      assert.equal(options.headers.Authorization, 'Bearer secret-key')
      return { ok: true, status: 200, json: async () => fixture }
    },
  })
  assert.deepEqual(models, ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro-preview'])
  assert.equal(defaultModel('gemini', models), 'gemini-2.5-flash')
  const groq = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'whisper-large-v3']
  assert.equal(defaultModel('groq', groq), 'openai/gpt-oss-120b')
  assert.equal(defaultModel('groq', ['llama-3.3-70b-versatile']), 'llama-3.3-70b-versatile')
})

test('chat completion uses provider URL, bearer key and Gemini low reasoning', async () => {
  let sentBody
  const response = { ok: true, status: 200 }
  const result = await chatCompletion({
    provider: 'gemini',
    key: 'gemini-secret',
    model: 'gemini-2.5-flash',
    messages: [{ role: 'user', content: 'hello' }],
    maxTokens: 1500,
    fetchImpl: async (url, options) => {
      assert.equal(url, PROVIDERS.gemini.baseUrl + '/chat/completions')
      assert.equal(options.headers.Authorization, 'Bearer gemini-secret')
      sentBody = JSON.parse(options.body)
      return response
    },
  })
  assert.equal(result, response)
  assert.equal(sentBody.reasoning_effort, 'low')
})

test('learning suggestion accepts Gemini config and provider errors never expose keys', async () => {
  const config = { provider: 'gemini', key: 'sensitive-gemini-key', model: 'gemini-2.5-flash' }
  const suggestion = await requestLearningSuggestion({
    mode: 'route',
    config,
    context: {},
    fetchImpl: async (url, options) => {
      assert.equal(url, PROVIDERS.gemini.baseUrl + '/chat/completions')
      assert.equal(options.headers.Authorization, 'Bearer sensitive-gemini-key')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"summary":"ok","nodes":[],"edges":[]}' } }],
        }),
      }
    },
  })
  assert.equal(suggestion.summary, 'ok')
  await assert.rejects(
    requestLearningSuggestion({
      mode: 'route',
      config,
      fetchImpl: async () => ({ ok: false, status: 401, headers: { get: () => null } }),
    }),
    (error) => error.code === 'AI_KEY_INVALID' && !error.message.includes(config.key),
  )
})

const answer = (status, text = '', retry = null) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name) => (name === 'retry-after' ? retry : null) },
  text: async () => text,
  json: async () => JSON.parse(text || '{}'),
})

test('Gemini list keeps plain chat models only', async () => {
  const ids = [
    'gemini-3.8-flash',
    'gemini-3.8-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-flash-latest',
    'gemma-4-31b-it',
    'gemini-3.8-flash-tts',
    'lyria-3.5',
    'gemini-3.8-live',
    'deep-research-preview-04-2026',
    'gemini-robotics-er-2-preview',
    'gemini-3.1-pro-preview-customtools',
    'gemini-embedding-2',
  ]
  const models = await listModels('gemini', 'test-key-123', {
    fetchImpl: async () =>
      answer(200, JSON.stringify({ data: ids.map((id) => ({ id: 'models/' + id })) })),
  })
  assert.deepEqual(models, [
    'gemini-3.8-flash',
    'gemini-3.8-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-flash-latest',
    'gemma-4-31b-it',
  ])
  assert.equal(defaultModel('gemini', models), 'gemini-3.8-flash')
})

test('provider failures are told apart: bad Gemini key, closed model, overloaded', async () => {
  const run = (fetchImpl) => listModels('gemini', 'test-key-123', { fetchImpl })
  await assert.rejects(
    run(async () =>
      answer(
        400,
        '{"error":{"code":400,"message":"Please pass a valid API key","status":"INVALID_ARGUMENT"}}',
      ),
    ),
    { code: 'AI_KEY_INVALID' },
  )
  await assert.rejects(
    run(async () =>
      answer(404, '{"error":{"message":"This model is no longer available to new users"}}'),
    ),
    { code: 'AI_MODEL_UNAVAILABLE' },
  )
  // overloaded once, then fine: retried after the short wait
  let calls = 0
  const models = await run(async () =>
    ++calls === 1
      ? answer(503, 'overloaded', '1')
      : answer(200, '{"data":[{"id":"gemini-3.8-flash"}]}'),
  )
  assert.deepEqual(models, ['gemini-3.8-flash'])
  assert.equal(calls, 2)
})
