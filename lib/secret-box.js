import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

function secret() {
  return process.env.AI_KEYS_SECRET || process.env.NEXTAUTH_SECRET || ''
}

export function sealAvailable() {
  return Boolean(secret())
}

function encryptionKey() {
  const value = secret()
  if (!value) throw new Error('AI_KEYS_UNAVAILABLE')
  return createHash('sha256')
    .update('chronicle-ai-keys:' + value)
    .digest()
}

export function seal(plaintext) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`
}

export function open(sealed) {
  const [version, ivText, tagText, ciphertextText, extra] = String(sealed).split('.')
  if (
    version !== 'v1' ||
    !ivText ||
    !tagText ||
    ciphertextText === undefined ||
    extra !== undefined
  )
    throw new Error('Invalid sealed value')
  try {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(ivText, 'base64url'),
    )
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'))
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    throw new Error('Unable to decrypt value')
  }
}
