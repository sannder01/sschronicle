import { test, expect } from '@playwright/test'
import { login, client, call, unique } from './helpers'

test.beforeEach(async ({ context }) => login(context))

const SHOTS = process.env.SCHEDULE_SHOTS // optional folder for screenshots

test('timetable: weekly classes on several days, edit, copy, overlap warning, delete', async ({
  page,
  playwright,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const api = await client(playwright)
  for (const e of await call(api, '/api/timetable'))
    await call(api, '/api/timetable/' + e.id, 'DELETE')
  const title = unique('Матанализ')

  // desktop: add one class on Monday and Wednesday at once
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/app/schedule')
  await expect(page.getByRole('heading', { name: 'Расписание', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Добавить пару' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: 'Предмет' }).fill(title)
  await dialog.getByRole('radio', { name: 'Практика' }).click()
  // the new class starts on today's weekday; make exactly Monday and Wednesday selected
  for (const day of [
    'Понедельник',
    'Вторник',
    'Среда',
    'Четверг',
    'Пятница',
    'Суббота',
    'Воскресенье',
  ]) {
    const chip = dialog.getByRole('button', { name: day, exact: true })
    const want = day === 'Понедельник' || day === 'Среда'
    if (((await chip.getAttribute('aria-pressed')) === 'true') !== want) await chip.click()
  }
  await dialog.getByLabel('Начало').fill('10:00')
  await dialog.getByRole('button', { name: '1 ч 20 мин' }).click()
  await dialog.getByRole('textbox', { name: 'Аудитория' }).fill('C1.3.305')
  await dialog.getByRole('button', { name: 'Добавить', exact: true }).click()
  await expect(dialog).toHaveCount(0)

  const saved = (await call(api, '/api/timetable')).filter((e) => e.title === title)
  expect(saved.map((e) => [e.weekday, e.start_min, e.end_min, e.kind, e.room])).toEqual([
    [1, 600, 680, 'practice', 'C1.3.305'],
    [3, 600, 680, 'practice', 'C1.3.305'],
  ])
  const block = page.getByRole('button', {
    name: `Понедельник, 10:00–11:20, ${title}, ауд. C1.3.305`,
  })
  await expect(block).toBeVisible()
  await expect(
    page.getByRole('button', { name: new RegExp(`^Среда, 10:00–11:20, ${title}`) }),
  ).toBeVisible()

  // edit Monday: move to 11:00, copy to Saturday; an overlapping class is pointed out
  await call(
    api,
    '/api/timetable',
    'POST',
    { weekdays: [6], start_min: 690, end_min: 720, title: 'Английский', kind: 'seminar' },
    201,
  )
  await page.reload()
  await page
    .getByRole('button', { name: new RegExp(`^Понедельник, 10:00–11:20, ${title}`) })
    .click()
  await dialog.getByLabel('Начало').fill('11:00')
  await dialog.getByRole('button', { name: 'Копия на Суббота' }).click()
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect
    .poll(async () =>
      (await call(api, '/api/timetable'))
        .filter((e) => e.title === title)
        .map((e) => [e.weekday, e.start_min])
        .sort(),
    )
    .toEqual([
      [1, 660],
      [3, 600],
      [6, 660],
    ])
  await page.getByRole('button', { name: new RegExp(`^Суббота, 11:00–12:20, ${title}`) }).click()
  await expect(dialog.getByRole('status')).toContainText('Английский')
  await page.keyboard.press('Escape')

  // phone: day tabs and cards with the break between classes
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByRole('tab', { name: /Сб/ }).click()
  const panel = page.getByRole('tabpanel')
  await expect(panel.getByRole('button', { name: new RegExp(title) })).toBeVisible()
  await expect(panel.getByText('Пересекается с предыдущей')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)

  // delete with confirmation
  await page.getByRole('tab', { name: /Ср/ }).click()
  await panel.getByRole('button', { name: new RegExp(title) }).click()
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click()
  await dialog.getByRole('button', { name: 'Удалить пару' }).click()
  await expect
    .poll(async () => (await call(api, '/api/timetable')).filter((e) => e.weekday === 3).length)
    .toBe(0)

  // another account cannot see or change these classes
  const other = await client(playwright, 'b')
  expect((await call(other, '/api/timetable')).some((e) => e.title === title)).toBe(false)
  const mine = (await call(api, '/api/timetable')).find((e) => e.title === title)
  expect((await other.fetch('/api/timetable/' + mine.id, { method: 'DELETE' })).status()).toBe(404)
  expect(errors).toEqual([])
})

test('accent colour: picked in profile, applied everywhere, persisted', async ({
  page,
  playwright,
}) => {
  const api = await client(playwright)
  await page.goto('/app/profile')
  await page.getByRole('radio', { name: 'Розовый' }).check()
  await expect(page.locator('html')).toHaveAttribute('data-accent', 'pink')
  await expect.poll(async () => (await call(api, '/api/profile')).settings.accent).toBe('pink')
  if (SHOTS) {
    await page.waitForTimeout(600)
    await page.screenshot({ path: SHOTS + '/profile-pink.png' })
  }
  await page.goto('/app/tasks')
  const primary = page.getByRole('button', { name: 'Новая задача', exact: true })
  // light or dark pink, whichever theme an earlier test left on
  await expect(primary).toHaveCSS('background-color', /rgb\((214, 51, 108|255, 107, 157)\)/)
  if (SHOTS) {
    await call(api, '/api/profile', 'PATCH', { settings: { theme: 'dark' } })
    await page.goto('/app/schedule')
    await page.waitForTimeout(800)
    await page.screenshot({ path: SHOTS + '/schedule-dark-pink.png' })
    await call(api, '/api/profile', 'PATCH', { settings: { theme: 'light' } })
  }
  await call(api, '/api/profile', 'PATCH', { settings: { accent: 'blue' } })
})
