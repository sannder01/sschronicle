import { query } from './db.js'
import { open } from './secret-box.js'

export async function resolveAiConfig(userId) {
  const { rows } = await query(
    'SELECT provider,model,key_ciphertext FROM user_ai_settings WHERE user_id=$1',
    [userId],
  )
  const saved = rows[0]
  if (saved) {
    try {
      return {
        source: 'user',
        provider: saved.provider,
        model: saved.model,
        key: open(saved.key_ciphertext),
      }
    } catch {
      // A rotated secret or damaged ciphertext behaves like an absent personal key.
    }
  }
  const key = process.env.GROQ_API_KEY?.trim()
  if (key)
    return {
      source: 'server',
      provider: 'groq',
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      key,
    }
  return null
}
