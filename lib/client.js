'use client'
export async function api(url, { body, headers, ...options } = {}) {
  let response
  try { response = await fetch(url, { ...options, cache: 'no-store', credentials: 'same-origin', headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }) }
  catch (cause) { const error = new Error('NETWORK_ERROR', { cause }); error.code = 'NETWORK_ERROR'; throw error }
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok) { const error = new Error(data?.error || `HTTP ${response.status}`); error.status = response.status; error.code = data?.code; error.data = data; throw error }
  return data
}
export function clearPrivateCache(userId) {
  for (const storage of [localStorage, sessionStorage]) for (const key of Object.keys(storage)) if (key.includes(String(userId)) || /^(chronicle|chr)[-_:]/i.test(key)) storage.removeItem(key)
}
