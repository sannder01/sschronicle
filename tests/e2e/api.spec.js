import { test, expect } from '@playwright/test'
import { client, call, baseURL, unique } from './helpers'
import { todayInZone, addDays } from '../../lib/dates'

test('private routes, missing session, malformed JSON and CSRF are rejected', async ({
  request,
  playwright,
}) => {
  const response = await request.get('/app/notes?folder=all&note=1')
  expect(response.url()).toContain('/auth')
  expect((await request.get('/api/tasks')).status()).toBe(401)
  const a = await client(playwright)
  expect(
    (
      await a.post('/api/tasks', {
        headers: { Origin: 'https://other.example' },
        data: { title: 'blocked' },
      })
    ).status(),
  ).toBe(403)
  expect(
    (
      await a.post('/api/tasks', { headers: { 'Content-Type': 'application/json' }, data: '{' })
    ).status(),
  ).toBe(400)
  expect(
    (await a.post('/api/tasks', { data: { title: 'wrong', priority: 'invalid' } })).status(),
  ).toBe(400)
  await a.dispose()
})

test('tasks and typed folders enforce ownership, persist completion and preserve records on folder deletion', async ({
  playwright,
}) => {
  const a = await client(playwright),
    b = await client(playwright, 'b')
  const folder = await call(
    a,
    '/api/folders',
    'POST',
    { name: unique('Проект'), entity_type: 'task', color: '#007aff' },
    201,
  )
  const secret = await call(
    b,
    '/api/folders',
    'POST',
    { name: unique('Private'), entity_type: 'task' },
    201,
  )
  const noteFolder = await call(
    a,
    '/api/folders',
    'POST',
    { name: unique('Заметки'), entity_type: 'note' },
    201,
  )
  expect(
    (await a.post('/api/tasks', { data: { title: 'foreign', folder_id: secret.id } })).status(),
  ).toBe(404)
  expect(
    (
      await a.post('/api/tasks', { data: { title: 'wrong type', folder_id: noteFolder.id } })
    ).status(),
  ).toBe(404)
  const task = await call(
    a,
    '/api/tasks',
    'POST',
    {
      title: unique('Закончить проект'),
      priority: 'high',
      folder_id: folder.id,
      due_date: '2026-10-15',
      due_time: '09:30',
    },
    201,
  )
  expect((await b.patch(`/api/tasks/${task.id}`, { data: { completed: true } })).status()).toBe(404)
  expect((await b.delete(`/api/tasks/${task.id}`)).status()).toBe(404)
  const before = await call(a, '/api/profile')
  for (let i = 0; i < 2; i++) await call(a, `/api/tasks/${task.id}`, 'PATCH', { completed: true })
  expect((await call(a, '/api/profile')).stats.xp - before.stats.xp).toBe(50)
  await call(a, `/api/tasks/${task.id}`, 'PATCH', { completed: false })
  expect((await call(a, '/api/profile')).stats.xp).toBe(before.stats.xp)
  await call(a, `/api/folders/${folder.id}`, 'PATCH', { name: 'Обновлённая папка' })
  await call(a, `/api/folders/${folder.id}`, 'DELETE')
  const stored = (await call(a, '/api/tasks')).find((item) => item.id === task.id)
  expect(stored.folder_id).toBeNull()
  expect(stored.due_date).toBe('2026-10-15')
  expect(stored.due_time).toBe('09:30')
  expect((await call(b, '/api/tasks')).some((item) => item.id === task.id)).toBe(false)
  await call(a, `/api/tasks/${task.id}`, 'DELETE')
  await call(a, `/api/folders/${noteFolder.id}`, 'DELETE')
  await call(b, `/api/folders/${secret.id}`, 'DELETE')
  await a.dispose()
  await b.dispose()
})

test('notes reject stale versions and foreign folders, preserve text through trash and folder removal', async ({
  playwright,
}) => {
  const a = await client(playwright),
    b = await client(playwright, 'b')
  const f = await call(
    a,
    '/api/folders',
    'POST',
    { name: unique('Мысли'), entity_type: 'note' },
    201,
  )
  let n = await call(
    a,
    '/api/notes',
    'POST',
    {
      title: unique('Первая заметка'),
      content: 'Строка один\n\nСтрока три <script>',
      folder_id: f.id,
    },
    201,
  )
  expect(n.document.content).toHaveLength(3)
  expect((await b.get(`/api/notes/${n.id}`)).status()).toBe(404)
  expect(
    (await b.post('/api/notes', { data: { title: 'intrusion', folder_id: f.id } })).status(),
  ).toBe(404)
  const version = n.version
  n = await call(a, `/api/notes/${n.id}`, 'PATCH', { version, title: 'Изменённый заголовок' })
  const conflict = await a.patch(`/api/notes/${n.id}`, { data: { version, title: 'STALE' } })
  expect(conflict.status()).toBe(409)
  expect((await conflict.json()).current.title).toBe('Изменённый заголовок')
  n = await call(a, `/api/notes/${n.id}`, 'PATCH', { version: n.version, deleted: true })
  expect(
    (
      await a.patch(`/api/notes/${n.id}`, { data: { version: n.version, title: 'Resurrect' } })
    ).status(),
  ).toBe(409)
  n = await call(a, `/api/notes/${n.id}`, 'PATCH', {
    version: n.version,
    deleted: false,
    pinned: true,
  })
  await call(a, `/api/folders/${f.id}`, 'DELETE')
  n = await call(a, `/api/notes/${n.id}`)
  expect(n.folder_id).toBeNull()
  expect(n.content).toContain('\n\n')
  n = await call(a, `/api/notes/${n.id}`, 'PATCH', { version: n.version, deleted: true })
  expect((await a.delete(`/api/notes/${n.id}`, { data: { version: n.version } })).status()).toBe(
    400,
  )
  await call(a, `/api/notes/${n.id}`, 'DELETE', { version: n.version, confirm: 'DELETE' })
  expect((await a.get(`/api/notes/${n.id}`)).status()).toBe(404)
  await a.dispose()
  await b.dispose()
})

test('30-day challenge has inclusive dates, explicit idempotent marks, 24/30 outcome and preserved attempts', async ({
  playwright,
}) => {
  const a = await client(playwright),
    b = await client(playwright, 'b'),
    today = todayInZone('Asia/Qyzylorda')
  const c = await call(
    a,
    '/api/challenges',
    'POST',
    {
      title: unique('30 дней без сладкого'),
      description: 'Без добавленного сахара',
      icon: 'leaf',
      color: '#007aff',
      start_date: addDays(today, -30),
      duration: 30,
    },
    201,
  )
  let detail = await call(a, `/api/challenges/${c.id}`),
    attempt = detail.attempt
  expect(detail.stats.end_date).toBe(addDays(today, -1))
  expect(detail.stats.period_ended).toBe(true)
  expect((await b.get(`/api/challenges/${c.id}`)).status()).toBe(404)
  expect(
    (
      await b.put(`/api/challenges/${c.id}/entries`, {
        data: { attempt_id: attempt.id, date: attempt.start_date, status: 'success' },
      })
    ).status(),
  ).toBe(404)
  for (let i = 0; i < 30; i++)
    await call(a, `/api/challenges/${c.id}/entries`, 'PUT', {
      attempt_id: attempt.id,
      date: addDays(attempt.start_date, i),
      status: i < 24 ? 'success' : 'failed',
      note: i === 0 ? 'Начало' : '',
    })
  await call(a, `/api/challenges/${c.id}/entries`, 'PUT', {
    attempt_id: attempt.id,
    date: attempt.start_date,
    status: 'success',
    note: 'Начало',
  })
  detail = await call(a, `/api/challenges/${c.id}`)
  expect(detail.stats.successful_days).toBe(24)
  expect(detail.stats.percentage).toBe(80)
  expect(detail.stats.goal_completed).toBe(false)
  expect(detail.entries).toHaveLength(30)
  await call(a, `/api/challenges/${c.id}`, 'PATCH', { archived: true })
  expect(
    (
      await a.put(`/api/challenges/${c.id}/entries`, {
        data: { attempt_id: attempt.id, date: attempt.start_date, status: 'success' },
      })
    ).status(),
  ).toBe(409)
  const restart = { previous_attempt_id: attempt.id, start_date: today, duration: 30 }
  const next = await call(a, `/api/challenges/${c.id}/restart`, 'POST', restart, 201)
  expect((await a.post(`/api/challenges/${c.id}/restart`, { data: restart })).status()).toBe(409)
  expect(
    (
      await a.put(`/api/challenges/${c.id}/entries`, {
        data: { attempt_id: next.id, date: addDays(today, 1), status: 'success' },
      })
    ).status(),
  ).toBe(400)
  expect(
    (await call(a, `/api/challenges/${c.id}?attempt=${attempt.id}`)).stats.successful_days,
  ).toBe(24)
  await call(a, '/api/profile', 'PATCH', { settings: { timezone: 'America/Los_Angeles' } })
  expect((await call(a, `/api/challenges/${c.id}`)).attempt.timezone).toBe('Asia/Qyzylorda')
  await call(a, '/api/profile', 'PATCH', { settings: { timezone: 'Asia/Qyzylorda' } })
  await call(a, `/api/challenges/${c.id}`, 'DELETE')
  await a.dispose()
  await b.dispose()
})

test('habit marks are explicit, scheduled, account scoped and cannot farm XP', async ({
  playwright,
}) => {
  const a = await client(playwright),
    b = await client(playwright, 'b'),
    today = todayInZone('Asia/Qyzylorda')
  const h = await call(
    a,
    '/api/habits',
    'POST',
    { name: unique('Чтение'), description: '20 минут', frequency: 'daily', color: '#007aff' },
    201,
  )
  const before = (await call(a, '/api/profile')).stats.xp
  for (let i = 0; i < 2; i++)
    await call(a, `/api/habits/${h.id}/log`, 'PUT', { date: today, completed: true })
  expect((await call(a, '/api/profile')).stats.xp - before).toBe(15)
  expect((await call(a, `/api/habits/${h.id}/log`)).dates).toEqual([today])
  expect((await b.delete(`/api/habits/${h.id}`)).status()).toBe(404)
  expect((await call(a, `/api/habits/${h.id}/log`)).dates).toEqual([today])
  expect(
    (
      await a.put(`/api/habits/${h.id}/log`, { data: { date: addDays(today, 1), completed: true } })
    ).status(),
  ).toBe(400)
  await call(a, `/api/habits/${h.id}/log`, 'PUT', { date: today, completed: false })
  expect((await call(a, '/api/profile')).stats.xp).toBe(before)
  await call(a, `/api/habits/${h.id}`, 'DELETE')
  await a.dispose()
  await b.dispose()
})

test('profile persists across sessions, export excludes secrets, session revocation and reauthentication work', async ({
  playwright,
}) => {
  const a = await client(playwright),
    secondary = await client(playwright, 'a-secondary'),
    b = await client(playwright, 'b')
  await call(a, '/api/profile', 'PATCH', {
    name: 'Александр',
    avatar_id: 'green',
    settings: { theme: 'dark', language: 'en', animations: false, reduce_transparency: true },
  })
  const p = await call(secondary, '/api/profile')
  expect(p.settings.theme).toBe('dark')
  expect(p.user.avatar_id).toBe('green')
  const exported = await call(a, '/api/profile/export')
  expect(exported.profile.id).toBe('e2e-alex')
  expect(JSON.stringify(exported)).not.toMatch(
    /access_token|refresh_token|session_token|client_secret|e2e-blair/,
  )
  expect(
    (await a.delete('/api/profile/account', { data: { confirmation: 'DELETE' } })).status(),
  ).toBe(403)
  expect(
    (await a.delete('/api/profile/account', { data: { confirmation: 'wrong' } })).status(),
  ).toBe(400)
  await call(a, '/api/profile/sessions', 'DELETE')
  expect((await secondary.get('/api/profile')).status()).toBe(401)
  expect((await b.get('/api/profile')).status()).toBe(200)
  await call(a, '/api/profile', 'PATCH', {
    avatar_id: 'blue',
    settings: { theme: 'light', language: 'ru', reduce_transparency: false },
  })
  expect(
    (
      await a.post('/api/tg-webhook', {
        data: { action: 'task_created', chat_id: '1', task: { title: 'blocked' } },
      })
    ).status(),
  ).toBe(401)
  expect((await a.get('/api/cron/notify')).status()).toBe(401)
  expect((await a.get('/api/fitness')).status()).toBe(410)
  await a.dispose()
  await secondary.dispose()
  await b.dispose()
})
