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

export async function requestLearningSuggestion({
  mode,
  language = 'ru',
  context = {},
  fetchImpl = globalThis.fetch,
}) {
  const key = process.env.GROQ_API_KEY
  if (!key?.trim()) throw new ApiError(503, 'AI assistant is not configured.', 'AI_NOT_CONFIGURED')
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b'
  const system = `${prompts[mode]} Reply only as JSON with shape {"summary":"...","nodes":[{"ref":"new:key","kind":"topic|subtopic|goal","title":"...","description":"...","parent_ref":null}],"edges":[{"from_ref":"new:key|id:1","to_ref":"new:key|id:1"}]}. Write all text in ${language === 'en' ? 'English' : 'Russian'}. Existing node refs must use id:<number>; new refs must use new:<key>. Titles under 80 characters, descriptions one or two short sentences. Output nothing but the JSON object.`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25000)
  try {
    const response = await fetchImpl('https://api.groq.com/openai/v1/chat/completions', {
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
        max_completion_tokens: 4000,
      }),
    })
    if (!response.ok) throw new Error('provider error')
    const payload = await response.json()
    const content = payload?.choices?.[0]?.message?.content
    if (typeof content !== 'string') throw new Error('missing content')
    let raw
    try {
      raw = JSON.parse(content)
    } catch {
      throw new Error('invalid JSON')
    }
    return sanitizeSuggestion(raw, context.existingIds || [])
  } catch (error) {
    if (error?.name === 'AbortError') throw new ApiError(504, 'AI request timed out.', 'AI_TIMEOUT')
    throw new ApiError(502, 'AI returned an invalid response.', 'AI_BAD_RESPONSE')
  } finally {
    clearTimeout(timeout)
  }
}
