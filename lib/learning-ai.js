import { ApiError } from './api-error.js'
import { chatCompletion } from './ai-providers.js'
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
  config,
  fetchImpl = globalThis.fetch,
  attempt = 0,
}) {
  if (!config?.provider || !config?.key || !config?.model)
    throw new ApiError(503, 'AI assistant is not configured.', 'AI_NOT_CONFIGURED')
  const system = `${prompts[mode]} Reply only as JSON with shape {"summary":"...","nodes":[{"ref":"new:key","kind":"topic|subtopic|goal","title":"...","description":"...","parent_ref":null}],"edges":[{"from_ref":"new:key|id:1","to_ref":"new:key|id:1"}]}. Write all text in ${language === 'en' ? 'English' : 'Russian'}. Existing node refs must use id:<number>; new refs must use new:<key>. Titles under 80 characters, descriptions one or two short sentences. Output nothing but the JSON object.`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)
  const log = (reason, status) => console.error('[learning-ai]', mode, reason, status ?? '')
  try {
    const response = await chatCompletion({
      ...config,
      fetchImpl,
      signal: controller.signal,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify({ ...context, existingIds: undefined }) },
      ],
      maxTokens: mode === 'structure' || mode === 'improve' ? 3000 : 1500,
    })
    let payload
    try {
      payload = await response.json()
    } catch {
      log('invalid JSON payload')
      throw new ApiError(502, 'AI returned an invalid response.', 'AI_BAD_RESPONSE')
    }
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
      if (!suggestion.nodes.length && NEEDS_NODES.includes(mode) && attempt === 0) {
        clearTimeout(timeout)
        return requestLearningSuggestion({ mode, language, context, config, fetchImpl, attempt: 1 })
      }
      return suggestion
    } catch (error) {
      log('unusable suggestion', error?.code || 'invalid')
      throw new ApiError(502, 'AI returned an invalid response.', 'AI_BAD_RESPONSE')
    }
  } catch (error) {
    if (error instanceof ApiError) {
      log('provider response', error.code)
      throw error
    }
    if (error?.name === 'AbortError') {
      log('timeout')
      throw new ApiError(504, 'AI request timed out.', 'AI_TIMEOUT')
    }
    log('provider error')
    throw new ApiError(502, 'AI provider error.', 'AI_PROVIDER_ERROR')
  } finally {
    clearTimeout(timeout)
  }
}
