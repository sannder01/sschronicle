import { test, expect } from '@playwright/test'
import { login, client, call, unique } from './helpers'
import { todayInZone } from '../../lib/dates'

test.beforeEach(async ({ context }) => login(context))

const SHOTS = process.env.SCHEDULE_SHOTS // optional folder for screenshots

test('schedule: create, drag to move, resize, mark done and delete a block', async ({
  page,
  playwright,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const api = await client(playwright),
    day = todayInZone('Asia/Qyzylorda'),
    title = unique('Пара по матанализу')
  for (const block of await call(api, '/api/schedule?day=' + day))
    await call(api, '/api/schedule/' + block.id, 'DELETE')

  await page.goto('/app/schedule')
  await expect(page.getByRole('heading', { name: 'Расписание дня' })).toBeVisible()

  // create through the editor
  await page.getByRole('button', { name: 'Новый блок', exact: true }).click()
  await page.getByLabel('Название', { exact: true }).fill(title)
  await page.getByLabel('Начало', { exact: true }).fill('10:00')
  await page.getByRole('button', { name: '1 ч 30 мин', exact: true }).click()
  await page.getByRole('radio', { name: 'Зелёный' }).check()
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByRole('dialog')).not.toBeVisible()
  const main = page.getByRole('button', { name: `${title}, 10:00 – 11:30` })
  await expect(main).toBeVisible()
  await expect
    .poll(async () => (await call(api, '/api/schedule?day=' + day))[0])
    .toMatchObject({ title, start_min: 600, end_min: 690, color: 'green', done: false })

  // drag down by one hour (72 px) with the mouse
  await main.scrollIntoViewIfNeeded()
  const box = await main.boundingBox()
  await page.mouse.move(box.x + 40, box.y + 10)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 40, box.y + 10 + i * 6)
  await page.waitForTimeout(150) // let velocity decay: a slow, placed drop
  await page.mouse.up()
  await expect(page.getByRole('button', { name: `${title}, 11:00 – 12:30` })).toBeVisible()
  await expect
    .poll(async () => (await call(api, '/api/schedule?day=' + day))[0].start_min)
    .toBe(660)

  // keyboard: Alt+Shift+Down makes it 15 minutes longer
  await page.getByRole('button', { name: `${title}, 11:00 – 12:30` }).focus()
  await page.keyboard.press('Alt+Shift+ArrowDown')
  await expect(page.getByRole('button', { name: `${title}, 11:00 – 12:45` })).toBeVisible()

  // done toggle
  await page.getByRole('button', { name: 'Отметить как выполненное' }).click()
  await expect(page.getByRole('button', { name: 'Отметить как невыполненное' })).toBeVisible()
  await expect.poll(async () => (await call(api, '/api/schedule?day=' + day))[0].done).toBe(true)

  if (SHOTS) {
    await call(
      api,
      '/api/schedule',
      'POST',
      {
        day,
        start_min: 13 * 60,
        end_min: 14 * 60,
        title: 'Обед',
        color: 'orange',
      },
      201,
    )
    await call(
      api,
      '/api/schedule',
      'POST',
      {
        day,
        start_min: 13 * 60 + 30,
        end_min: 15 * 60,
        title: 'Созвон по проекту',
      },
      201,
    )
    await page.reload()
    await page.waitForTimeout(600)
    await page.locator('.timeline-scroll').evaluate((el) => (el.scrollTop = 10.5 * 72))
    await page.waitForTimeout(200)
    await page.screenshot({ path: SHOTS + '/schedule-light.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(400)
    await page.locator('.timeline-scroll').evaluate((el) => (el.scrollTop = 10.5 * 72))
    await page.screenshot({ path: SHOTS + '/schedule-390.png', fullPage: true })
    await page.setViewportSize({ width: 1440, height: 1000 })
  }

  // delete
  await page.getByRole('button', { name: `${title}, 11:00 – 12:45` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click()
  await expect(page.getByRole('button', { name: new RegExp(title) })).toHaveCount(0)
  await expect
    .poll(async () => (await call(api, '/api/schedule?day=' + day)).some((b) => b.title === title))
    .toBe(false)
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
