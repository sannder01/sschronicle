import { validDate, validTimezone } from './dates.js';

export class TrackingError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
export function trackingId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new TrackingError('Invalid identifier');
  return id;
}
export function trackingText(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new TrackingError('Invalid text');
  return value.trim();
}
export function trackingColor(value) {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new TrackingError('Invalid color');
  return value;
}
export function attemptInput(body, timezone) {
  if (!validDate(body.start_date) || body.start_date < '1900-01-01' || body.start_date > '9998-12-31' || !Number.isInteger(body.duration) || body.duration < 1 || body.duration > 366 || !validTimezone(timezone)) throw new TrackingError('Invalid period');
  return { start_date: body.start_date, duration: body.duration, timezone };
}
export function challengeInput(body) {
  return { title: trackingText(body.title, 160, true), description: trackingText(body.description ?? '', 4000), icon: trackingText(body.icon ?? '🌱', 24, true), color: trackingColor(body.color ?? '#34a853') };
}
export function habitInput(body) {
  const name = trackingText(body.name, 160, true), description = trackingText(body.description ?? '', 2000);
  if (!['daily', 'custom'].includes(body.frequency)) throw new TrackingError('Invalid schedule');
  const days = body.frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : body.days;
  if (!Array.isArray(days) || !days.length || days.length > 7 || days.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(days).size !== days.length) throw new TrackingError('Choose at least one weekday');
  return { name, description, frequency: body.frequency, days: [...days].sort(), color: trackingColor(body.color ?? '#007aff') };
}
