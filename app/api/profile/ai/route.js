import { api, json, readJson } from '@/lib/api'
import { query } from '@/lib/db'
import { ApiError } from '@/lib/api-error.js'
import { PROVIDERS, listModels } from '@/lib/ai-providers.js'
import { open, seal, sealAvailable } from '@/lib/secret-box.js'
import { oneOf, text } from '@/lib/validation'
import { consumeRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

async function settingsFor(userId) {
  const { rows } = await query(
    'SELECT provider,model,key_ciphertext,key_last4,verified_at FROM user_ai_settings WHERE user_id=$1',
    [userId],
  )
  const setting = rows[0]
  let configured = Boolean(setting)
  let broken = false
  if (setting) {
    try {
      open(setting.key_ciphertext)
    } catch {
      configured = false
      broken = true
    }
  }
  return {
    configured,
    ...(broken ? { broken: true } : {}),
    provider: configured ? setting.provider : null,
    model: configured ? setting.model : null,
    last4: configured ? setting.key_last4 : null,
    verified_at: configured ? setting.verified_at : null,
    server_available: Boolean(process.env.GROQ_API_KEY?.trim()),
    providers: Object.values(PROVIDERS).map(({ id, label, keysUrl }) => ({
      id,
      label,
      keys_url: keysUrl,
    })),
  }
}

export const GET = api(async (_req, _ctx, { user }) => json(await settingsFor(user.id)))

async function verifiedModels(provider, key, userId) {
  const limited = await consumeRateLimit('ai-keys:' + userId, 20, 3600)
  if (!limited.allowed) throw new ApiError(429, 'Too many AI key requests.', 'RATE_LIMITED')
  try {
    return await listModels(provider, key)
  } catch (error) {
    if (error?.code === 'AI_KEY_INVALID')
      throw new ApiError(400, 'The AI key was rejected.', 'AI_KEY_INVALID')
    if (['AI_TIMEOUT', 'AI_BUSY'].includes(error?.code)) throw error
    throw new ApiError(502, 'AI provider error.', 'AI_PROVIDER_ERROR')
  }
}

export const PUT = api(async (req, _ctx, { user }) => {
  const body = await readJson(req, 4096)
  const provider = oneOf(body.provider, Object.keys(PROVIDERS), 'provider')
  const model = text(body.model, { field: 'model', max: 120 })
  let key
  let verifiedAt
  if (body.api_key !== undefined) {
    key = text(body.api_key, { field: 'api_key', min: 10, max: 300, trim: false })
    if (/\s/.test(key)) throw new ApiError(400, 'Invalid api_key.', 'VALIDATION_ERROR')
    if (!sealAvailable())
      throw new ApiError(503, 'AI key storage is unavailable.', 'AI_KEYS_UNAVAILABLE')
    const models = await verifiedModels(provider, key, user.id)
    if (!models.includes(model)) throw new ApiError(400, 'Invalid model.', 'VALIDATION_ERROR')
    verifiedAt = new Date()
  } else {
    const { rows } = await query(
      'SELECT provider,model,key_ciphertext,verified_at FROM user_ai_settings WHERE user_id=$1',
      [user.id],
    )
    const saved = rows[0]
    if (!saved || saved.provider !== provider)
      throw new ApiError(400, 'A matching saved AI key is required.', 'AI_KEY_INVALID')
    try {
      key = open(saved.key_ciphertext)
    } catch {
      throw new ApiError(400, 'A matching saved AI key is required.', 'AI_KEY_INVALID')
    }
    const models = await verifiedModels(provider, key, user.id)
    if (!models.includes(model)) throw new ApiError(400, 'Invalid model.', 'VALIDATION_ERROR')
    verifiedAt = saved.verified_at
  }
  if (body.api_key !== undefined) {
    await query(
      `INSERT INTO user_ai_settings(user_id,provider,model,key_ciphertext,key_last4,verified_at)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(user_id) DO UPDATE SET provider=EXCLUDED.provider,model=EXCLUDED.model,
         key_ciphertext=EXCLUDED.key_ciphertext,key_last4=EXCLUDED.key_last4,
         verified_at=EXCLUDED.verified_at,updated_at=NOW()`,
      [user.id, provider, model, seal(key), key.slice(-4), verifiedAt],
    )
  } else {
    await query('UPDATE user_ai_settings SET model=$1,updated_at=NOW() WHERE user_id=$2', [
      model,
      user.id,
    ])
  }
  return json(await settingsFor(user.id))
})

export const DELETE = api(async (_req, _ctx, { user }) => {
  await query('DELETE FROM user_ai_settings WHERE user_id=$1', [user.id])
  return json({ ok: true })
})
