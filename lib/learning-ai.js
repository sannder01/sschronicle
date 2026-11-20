import { ApiError } from './api-error.js'
import { sanitizeSuggestion } from './learning-shape.mjs'

const prompts = {
  structure:
    'Design a learning map for the requested subject and goal: 4-8 top-level topics (kind "topic"), each with 2-5 subtopics (kind "subtopic", parent_ref = its topic) and, where useful, a few concrete learning goals (kind "goal"). Add edges for prerequisites (from_ref must be learned before to_ref) so the map reads as a path from basics to advanced. If the map already has nodes, do not repeat them; you may reference them as parents or in edges.',
  route:
    'Order the existing nodes into a sensible learning route from basics to advanced. Return edges only (from_ref is learned before to_ref) between existing nodes, using id:<n> refs, and no new nodes. Explain the route briefly in summary.',
  dependencies:
    'Suggest prerequisite edges between existing nodes only (from_ref must be understood before to_ref), using id:<n> refs. Only include clear, real dependencies. Return no new nodes.',
  breakdown:
    'Break the selected node into 3-7 smaller, ordered steps: new nodes of kind "subtopic" with parent_ref = id:<selected node id>, plus edges between them in learning order.',
  questions:
    'Write 3-6 learning goals and self-check questions for the selected node as new nodes of kind "goal" with parent_ref = id:<selected node id>. Put the question or measurable goal in title and a short hint in description.',
  improve:
    'Review the existing map and suggest what is missing: new topics, subtopics or goals (attach them with parent_ref where it fits) and missing prerequisite edges. Do not repeat existing nodes.',
}

const NEEDS_NODES = ['structure', 'breakdown', 'questions']

export async function requestLearningSuggestion({
  mode,
  language = 'ru',
  context = {},
  fetchImpl = globalThis.fetch,
  attempt = 0,
}) {
  const key = process.env.GROQ_API_KEY
  if (!key?.trim()) throw new ApiError(503, 'AI assistant is not configured.', 'AI_NOT_CONFIGURED')
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
  const system = `${prompts[mode]} Reply only as JSON with shape {"summary":"...","nodes":[{"ref":"new:key","kind":"topic|subtopic|goal","title":"...","description":"...","parent_ref":null}],"edges":[{"from_ref":"new:key|id:1","to_ref":"new:key|id:1"}]}. Write all text in ${language === 'en' ? 'English' : 'Russian'}. Existing node refs must use id:<number>; new refs must use new:<key>. Titles under 80 characters, descriptions one or two short sentences. Output nothing but the JSON object.`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)
  // gpt-oss models think before answering; low effort keeps answers fast and, on Groq's free
  // tier (8000 tokens per minute), leaves room for several requests a minute
  const reasoning = /gpt-oss/.test(model) ? { reasoning_effort: 'low' } : {}
  const call = () =>
    fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify({ ...context, existingIds: undefined }) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4,
        max_completion_tokens: mode === 'structure' || mode === 'improve' ? 3000 : 1500,
        ...reasoning,
      }),
    })
  // the provider's own words go to the server log only (never the key), so failures can be traced
  const log = (reason, status) => console.error('[learning-ai]', mode, reason, status ?? '')
  try {
    let response = await call()
    if (response.status === 429) {
      // the free tier frees up within seconds: wait once (if short) and try again
      const wait = retryAfter(response)
      if (wait <= 12) {
        await sleep(wait * 1000, controller.signal)
        response = await call()
      }
    }
    if (response.status === 429) {
      log('rate limited', 429)
      throw new ApiError(429, 'The AI provider is busy.', 'AI_BUSY', {
        retry_after: retryAfter(response),
      })
    }
    if (response.status === 401 || response.status === 403) {
      log('key rejected', response.status)
      throw new ApiError(503, 'The AI key was rejected.', 'AI_KEY_INVALID')
    }
    if (!response.ok) {
      log('provider error', response.status)
      throw new ApiError(502, 'AI provider error.', 'AI_PROVIDER_ERROR')
    }
    const payload = await response.json()
    const choice = payload?.choices?.[0]
    const content = choice?.message?.content
    if (typeof content !== 'string') {
      log('no content', choice?.finish_reason)
      throw new ApiError(502, 'AI returned an invalid response.', 'AI_BAD_RESPONSE')
    }
    let raw
    try {
      raw = JSON.parse(content)
    } catch {
      log('invalid JSON', choice?.finish_reason)
      throw new ApiError(502, 'AI returned an invalid response.', 'AI_BAD_RESPONSE')
    }
    try {
      const suggestion = sanitizeSuggestion(raw, context.existingIds || [])
      // now and then the model answers with only a summary; modes that add topics ask once more
      if (!suggestion.nodes.length && NEEDS_NODES.includes(mode) && attempt === 0) {
        clearTimeout(timeout)
        return requestLearningSuggestion({ mode, language, context, fetchImpl, attempt: 1 })
      }
      return suggestion
    } catch (error) {
      log('unusable suggestion', error?.message)
      throw new ApiError(502, 'AI returned an invalid response.', 'AI_BAD_RESPONSE')
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (error?.name === 'AbortError') throw new ApiError(504, 'AI request timed out.', 'AI_TIMEOUT')
    log('network', error?.name)
    throw new ApiError(502, 'AI provider error.', 'AI_PROVIDER_ERROR')
  } finally {
    clearTimeout(timeout)
  }
}

function retryAfter(response) {
  const seconds = Number(response.headers?.get?.('retry-after'))
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(60, Math.ceil(seconds)) : 10
}
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(id)
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    })
  })
}
