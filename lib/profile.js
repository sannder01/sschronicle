import { query } from './db'
import { ApiError } from './api'
import { text, oneOf, boolean, timezone } from './validation'

export const defaultSettings = {
  theme: 'system',
  language: 'ru',
  timezone: 'UTC',
  animations: true,
  reduce_transparency: false,
}
export function validateSettings(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings))
    throw new ApiError(400, 'Invalid settings.')
  const result = {}
  if (settings.theme !== undefined)
    result.theme = oneOf(settings.theme, ['light', 'dark', 'system'], 'theme')
  if (settings.language !== undefined)
    result.language = oneOf(settings.language, ['ru', 'en'], 'language')
  if (settings.timezone !== undefined) result.timezone = timezone(settings.timezone)
  if (settings.animations !== undefined)
    result.animations = boolean(settings.animations, 'animations')
  if (settings.reduce_transparency !== undefined)
    result.reduce_transparency = boolean(settings.reduce_transparency, 'reduce_transparency')
  return result
}
export async function profileFor(userId) {
  const { rows } = await query(
    'SELECT id,name,email,image,avatar_id,google_image,created_at,settings FROM users WHERE id=$1',
    [userId],
  )
  const user = rows[0]
  if (!user) throw new ApiError(401, 'Please sign in again.', 'UNAUTHORIZED')
  const [counts, telegram] = await Promise.all([
    query(
      "SELECT (SELECT COUNT(*)::int FROM tasks WHERE user_id=$1) AS tasks,(SELECT COUNT(*)::int FROM tasks WHERE user_id=$1 AND completed) AS completed_tasks,(SELECT COUNT(*)::int FROM habits WHERE user_id=$1) AS habits,(SELECT COUNT(*)::int FROM habit_logs WHERE user_id=$1 AND completed) AS habit_logs,(SELECT COUNT(*)::int FROM challenges WHERE user_id=$1) AS challenges,(SELECT COUNT(*)::int FROM challenge_entries WHERE user_id=$1 AND status='success') AS successful_days,(SELECT COALESCE(SUM(CASE priority WHEN 'high' THEN 50 WHEN 'medium' THEN 25 ELSE 10 END),0)::int FROM tasks WHERE user_id=$1 AND completed) AS task_xp",
      [userId],
    ),
    query('SELECT reminders_1h,reminders_1d FROM tg_connections WHERE user_id=$1', [userId]),
  ])
  const c = counts.rows[0]
  const settings = { ...defaultSettings, ...user.settings }
  delete user.settings
  return {
    user,
    settings,
    stats: {
      tasks: c.tasks,
      completedTasks: c.completed_tasks,
      habits: c.habits,
      habitLogs: c.habit_logs,
      challenges: c.challenges,
      successfulDays: c.successful_days,
      xp: c.task_xp + c.habit_logs * 15 + c.successful_days * 20,
    },
    telegram: {
      connected: telegram.rows.length > 0,
      configured: Boolean(
        process.env.TELEGRAM_BOT_TOKEN &&
          process.env.TG_WEBHOOK_SECRET &&
          process.env.TELEGRAM_BOT_USERNAME,
      ),
      bot_username: process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, '') ?? null,
      reminders_1h: telegram.rows[0]?.reminders_1h ?? true,
      reminders_1d: telegram.rows[0]?.reminders_1d ?? true,
    },
  }
}
export function validateProfile(body) {
  const changes = {}
  if (body.name !== undefined) changes.name = text(body.name, { field: 'name', max: 100 })
  if (body.avatar_id !== undefined)
    changes.avatar_id =
      body.avatar_id === null
        ? null
        : oneOf(body.avatar_id, ['blue', 'green', 'purple', 'orange'], 'avatar')
  if (body.settings !== undefined) changes.settings = validateSettings(body.settings)
  if (!Object.keys(changes).length) throw new ApiError(400, 'Nothing to update.')
  return changes
}
