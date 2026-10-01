import { ApiError } from './api-error.js'

const invalid = field => { throw new ApiError(400, 'Invalid ' + field + '.', 'VALIDATION_ERROR') }
export function positiveId(value, field = 'id') {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 2147483647) invalid(field)
  return Number(value)
}
export function text(value, { field = 'value', max = 255, min = 1, trim = true } = {}) {
  if (typeof value !== 'string') invalid(field)
  const result = trim ? value.trim() : value
  if (result.length < min || result.length > max || result.includes('\0')) invalid(field)
  return result
}
export function oneOf(value, allowed, field = 'value') { if (!allowed.includes(value)) invalid(field); return value }
export function boolean(value, field = 'value') { if (typeof value !== 'boolean') invalid(field); return value }
export function date(value, field = 'date') {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(field)
  const parsed = new Date(value + 'T12:00:00Z')
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value || value < '1900-01-01' || value > '2200-12-31') invalid(field)
  return value
}
export function time(value, field = 'time') {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) invalid(field)
  return value
}
export function timezone(value) {
  const zone = text(value, { field: 'timezone', max: 100 })
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format() } catch { invalid('timezone') }
  return zone
}
export function hexColor(value) { if (typeof value !== 'string' || !/^#[\da-f]{6}$/i.test(value)) invalid('color'); return value }
