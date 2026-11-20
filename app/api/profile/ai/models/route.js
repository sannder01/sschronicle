import { api, json, readJson } from '@/lib/api'
import { ApiError } from '@/lib/api-error.js'
import { query } from '@/lib/db'
import { defaultModel, listModels, PROVIDERS } from '@/lib/ai-providers.js'
import { open } from '@/lib/secret-box.js'
import { oneOf, text } from '@/lib/validation'
import { consumeRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function modelsFor(provider, key, userId) {
  const limited = await consumeRateLimit('ai-keys:' + userId, 20, 3600)
  if (!limited.allowed) throw new ApiError(429, 'Too many AI key requests.', 'RATE_LIMITED')
  let models
  try {
    models = await listModels(provider, key)
  } catch (error) {
    if (error?.code === 'AI_KEY_INVALID')
      throw new ApiError(400, 'The AI key was rejected.', 'AI_KEY_INVALID')
    if (['AI_TIMEOUT', 'AI_BUSY'].includes(error?.code)) throw error
    throw new ApiError(502, 'AI provider error.', 'AI_PROVIDER_ERROR')
  }
  return { models, default_model: defaultModel(provider, models) }
}

// Models available to the saved key, for switching models without typing the key again.
export const GET = api(async (_req, _ctx, { user }) => {
  const saved = (
    await query('SELECT provider,key_ciphertext FROM user_ai_settings WHERE user_id=$1', [user.id])
  ).rows[0]
  if (!saved) throw new ApiError(404, 'No saved AI key.', 'NOT_FOUND')
  let key
  try {
    key = open(saved.key_ciphertext)
  } catch {
    throw new ApiError(404, 'No saved AI key.', 'NOT_FOUND')
  }
  return json(await modelsFor(saved.provider, key, user.id))
})

// Checks a new key by listing its models. Nothing is stored here.
export const POST = api(async (req, _ctx, { user }) => {
  const body = await readJson(req, 4096)
  const provider = oneOf(body.provider, Object.keys(PROVIDERS), 'provider')
  const key = text(body.api_key, { field: 'api_key', min: 10, max: 300, trim: false })
  if (/\s/.test(key)) throw new ApiError(400, 'Invalid api_key.', 'VALIDATION_ERROR')
  return json(await modelsFor(provider, key, user.id))
})
