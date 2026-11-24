import { ApiError } from './api-error.js'

export const PROVIDERS = {
  groq: {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keysUrl: 'https://console.groq.com/keys',
  },
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keysUrl: 'https://aistudio.google.com/apikey',
  },
}

function retryAfter(response) {
  const seconds = Number(response.headers?.get?.('retry-after'))
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(60, Math.ceil(seconds)) : 10
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
      },
      { once: true },
    )
  })
}

// "Busy" answers: rate limits (429) and overloaded models (503, Gemini says so often)
const busy = (status) => status === 429 || status === 503

async function providerError(response, provider) {
  // the provider's text is read only to classify the failure; it is never sent to the browser
  let detail = ''
  try {
    detail = (await response.text()).slice(0, 2000)
  } catch {}
  console.error('[ai-provider]', provider, response.status)
  if (busy(response.status))
    return new ApiError(429, 'The AI provider is busy.', 'AI_BUSY', {
      retry_after: retryAfter(response),
    })
  // Gemini answers a bad key with 400 "Please pass a valid API key" / API_KEY_INVALID
  if (
    response.status === 401 ||
    response.status === 403 ||
    (response.status === 400 && /api[ _]?key/i.test(detail))
  )
    return new ApiError(503, 'The AI key was rejected.', 'AI_KEY_INVALID')
  // a listed model can still be closed to new users (Gemini) or retired
  if (
    response.status === 404 ||
    /model.*(not found|no longer available|decommissioned)/i.test(detail)
  )
    return new ApiError(502, 'This AI model is not available.', 'AI_MODEL_UNAVAILABLE')
  return new ApiError(502, 'AI provider error.', 'AI_PROVIDER_ERROR')
}

export async function fetchProviderResponse({
  provider,
  key,
  path,
  body,
  fetchImpl = globalThis.fetch,
  signal,
  timeoutMs,
  deadline,
  now = Date.now,
}) {
  const info = PROVIDERS[provider]
  if (!info) throw new ApiError(400, 'Invalid provider.', 'VALIDATION_ERROR')
  const controller = timeoutMs ? new AbortController() : null
  const timeout = controller && setTimeout(() => controller.abort(), timeoutMs)
  const requestSignal = signal || controller?.signal
  const call = () =>
    fetchImpl(`${info.baseUrl}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      signal: requestSignal,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  try {
    let response = await call()
    const wait = retryAfter(response) * 1000
    // retry a short "busy" only when the wait still leaves time before the caller's deadline
    if (
      busy(response.status) &&
      wait <= 12000 &&
      !requestSignal?.aborted &&
      (!deadline || now() + wait < deadline)
    ) {
      await sleep(wait, requestSignal)
      response = await call()
    }
    if (!response.ok) throw await providerError(response, provider)
    return response
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error?.name === 'AbortError') throw new ApiError(504, 'AI request timed out.', 'AI_TIMEOUT')
    throw new ApiError(502, 'AI provider error.', 'AI_PROVIDER_ERROR')
  } finally {
    clearTimeout(timeout)
  }
}

const excluded =
  /embed|tts|whisper|guard|image|audio|vision|\baqa\b|imagen|\bveo\b|learnlm-free|orpheus|allam/i
// Gemini lists dozens of special models (music, live audio, robotics, research agents…).
// Only plain text chat models fit the assistant: gemini-<version>-flash|pro[-lite][-preview],
// the *-latest aliases and the instruction-tuned Gemma models.
const geminiChat =
  /^(gemini-\d+(\.\d+)*-(flash|pro)(-lite)?(-preview)?|gemini-(flash|flash-lite|pro)-latest|gemma-[\w.-]+-it)$/i

export async function listModels(
  provider,
  key,
  { fetchImpl = globalThis.fetch, timeoutMs = 10000 } = {},
) {
  const response = await fetchProviderResponse({
    provider,
    key,
    path: '/models',
    fetchImpl,
    timeoutMs,
  })
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new ApiError(502, 'AI provider error.', 'AI_PROVIDER_ERROR')
  }
  const models = Array.isArray(payload?.data) ? payload.data : []
  return models
    .map((model) => String(model?.id || '').replace(/^models\//, ''))
    .filter((id) => id && !excluded.test(id))
    .filter((id) => provider !== 'gemini' || geminiChat.test(id))
}

export function defaultModel(provider, ids) {
  if (provider === 'groq')
    return ids.includes('openai/gpt-oss-120b') ? 'openai/gpt-oss-120b' : ids[0] || null
  if (provider === 'gemini') {
    // the newest flash is often overloaded right after release; this one answered steadily in
    // ~3 s when tested (Nov 2026). Users can pick any other model in their profile.
    if (ids.includes('gemini-3.5-flash')) return 'gemini-3.5-flash'
    const flash = ids
      .filter((id) => /flash/i.test(id) && !/lite|preview/i.test(id))
      .sort((a, b) => compareGeminiVersions(b, a))
    return flash[0] || ids[0] || null
  }
  return null
}

function compareGeminiVersions(a, b) {
  const version = (id) =>
    id
      .match(/gemini-(\d+(?:\.\d+)*)/i)?.[1]
      .split('.')
      .map(Number) || []
  const left = version(a)
  const right = version(b)
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] || 0) - (right[index] || 0)
    if (difference) return difference
  }
  return 0
}

export function chatCompletion({
  provider,
  key,
  model,
  messages,
  maxTokens,
  fetchImpl,
  signal,
  deadline,
  now,
}) {
  return fetchProviderResponse({
    provider,
    key,
    path: '/chat/completions',
    fetchImpl,
    signal,
    deadline,
    now,
    body: {
      model,
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_completion_tokens: maxTokens,
      ...(/gpt-oss/i.test(model) || provider === 'gemini' ? { reasoning_effort: 'low' } : {}),
    },
  })
}
