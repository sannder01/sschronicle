import { test, expect } from '@playwright/test'
import { login, client, call } from './helpers'
import { todayInZone } from '../../lib/dates'

test.beforeEach(async ({ context }) => login(context))

const SHOTS = process.env.SCHEDULE_SHOTS // optional folder for screenshots

test('board: cards from the schedule, tie and cut strings, drag, arrange', async ({
  page,
  playwright,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const api = await client(playwright),
    day = todayInZone('Asia/Qyzylorda')
  await call(api, '/api/profile', 'PATCH', { settings: { theme: 'light', accent: 'blue' } })
  for (const block of await call(api, '/api/schedule?day=' + day))
    await call(api, '/api/schedule/' + block.id, 'DELETE')
  const make = (title, start, color = 'accent', note) =>
    call(
      api,
      '/api/schedule',
      'POST',
      { day, start_min: start, end_min: start + 60, title, color, note },
      201,
    )
  const a = await make('Курсовая: глава 2', 9 * 60, 'accent', 'Дописать выводы')
  const b = await make('Библиотека', 11 * 60, 'green')
  const c = await make('Созвон с научруком', 14 * 60, 'orange')
  await make('Спортзал', 18 * 60, 'red')

  await page.goto('/app/board')
  await page.evaluate(() => localStorage.setItem('chronicle-board-source', 'schedule'))
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Доска', exact: true })).toBeVisible()
  const cardA = page.locator(`.board-card[data-id="${a.id}"]`),
    cardB = page.locator(`.board-card[data-id="${b.id}"]`),
    cardC = page.locator(`.board-card[data-id="${c.id}"]`)
  await expect(cardA).toBeVisible()
  // never-placed cards get a place on the board, saved once
  await expect
    .poll(async () =>
      (await call(api, '/api/schedule?day=' + day)).every((x) => x.canvas_x != null),
    )
    .toBe(true)

  // tie a string: drag from A's pin onto B
  const dragTo = async (fromLocator, toLocator) => {
    const f = await fromLocator.boundingBox(),
      t = await toLocator.boundingBox()
    await page.mouse.move(f.x + f.width / 2, f.y + f.height / 2)
    await page.mouse.down()
    for (let i = 1; i <= 10; i++)
      await page.mouse.move(
        f.x + f.width / 2 + ((t.x + t.width / 2 - f.x - f.width / 2) * i) / 10,
        f.y + f.height / 2 + ((t.y + t.height / 2 - f.y - f.height / 2) * i) / 10,
      )
    await page.mouse.up()
  }
  await dragTo(page.locator(`.board-pin[data-id="${a.id}"]`), cardB)
  await dragTo(page.locator(`.board-pin[data-id="${b.id}"]`), cardC)
  await expect.poll(async () => (await call(api, '/api/schedule/links?day=' + day)).length).toBe(2)
  await expect(page.locator('.rope')).toHaveCount(2)

  // keyboard linking: L on a card, then pick another
  await cardA.locator('.card-body').focus()
  await page.keyboard.press('l')
  await cardC.locator('.card-body').click()
  await expect.poll(async () => (await call(api, '/api/schedule/links?day=' + day)).length).toBe(3)

  // drag a card: the position is saved
  const before = (await call(api, '/api/schedule?day=' + day)).find((x) => x.id === c.id)
  const box = await cardC.locator('.card-time').boundingBox()
  await page.mouse.move(box.x + 10, box.y + 5)
  await page.mouse.down()
  for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + 10 + i * 8, box.y + 5 + i * 5)
  await page.waitForTimeout(150)
  await page.mouse.up()
  await expect
    .poll(
      async () => (await call(api, '/api/schedule?day=' + day)).find((x) => x.id === c.id).canvas_x,
    )
    .not.toBe(before.canvas_x)

  // arrange (force layout) saves every position
  await page.getByRole('button', { name: 'Разложить' }).click()
  await expect(page.getByRole('button', { name: 'Разложить' })).toBeEnabled({ timeout: 10000 })

  if (SHOTS) {
    await page.waitForTimeout(900)
    await cardA.hover()
    await page.waitForTimeout(400)
    await page.screenshot({ path: SHOTS + '/board-light.png' })
    await call(api, '/api/profile', 'PATCH', { settings: { theme: 'dark' } })
    await page.reload()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: SHOTS + '/board-dark.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.reload()
    await page.waitForTimeout(1200)
    await page.screenshot({ path: SHOTS + '/board-390.png' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await call(api, '/api/profile', 'PATCH', { settings: { theme: 'light' } })
    await page.reload()
  }

  // cut a string: click it, then the scissors button
  const linksBefore = (await call(api, '/api/schedule/links?day=' + day)).length
  // click a point that really lies on the (curved) string
  const point = await page
    .locator('.rope-hit')
    .first()
    .evaluate((path) => {
      const p = path.getPointAtLength(path.getTotalLength() / 2),
        m = path.getScreenCTM()
      return { x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f }
    })
  await page.mouse.click(point.x, point.y)
  await page.getByRole('button', { name: 'Убрать нить' }).click()
  await expect
    .poll(async () => (await call(api, '/api/schedule/links?day=' + day)).length)
    .toBe(linksBefore - 1)

  expect(errors).toEqual([])
})

test('board: switch to tasks, tie two tasks, the choice is remembered', async ({
  page,
  playwright,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const api = await client(playwright)
  const stamp = Date.now()
  const one = await call(api, '/api/tasks', 'POST', { title: 'Прочитать статью ' + stamp }, 201)
  const two = await call(api, '/api/tasks', 'POST', { title: 'Написать конспект ' + stamp }, 201)

  await page.goto('/app/board')
  await page.getByRole('button', { name: 'Задачи', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Новая задача' })).toBeVisible()
  const cardOne = page.locator(`.board-card[data-id="${one.id}"]`),
    cardTwo = page.locator(`.board-card[data-id="${two.id}"]`)
  await expect(cardOne).toBeVisible()
  await expect(cardTwo).toBeVisible()
  await expect
    .poll(async () => {
      const list = await call(api, '/api/tasks')
      return [one, two].every((x) => list.find((t) => t.id === x.id).canvas_x != null)
    })
    .toBe(true)

  // tie with the keyboard: L on one, click the other
  await cardOne.locator('.card-body').focus()
  await page.keyboard.press('l')
  await cardTwo.locator('.card-body').click()
  await expect
    .poll(async () =>
      (await call(api, '/api/tasks/links')).some(
        (l) => l.from_id === Math.min(one.id, two.id) && l.to_id === Math.max(one.id, two.id),
      ),
    )
    .toBe(true)

  // finishing a task keeps it on the board, dimmed
  await cardOne.getByRole('button', { name: 'Отметить как выполненное' }).click()
  await expect(cardOne).toHaveClass(/done/)
  await expect
    .poll(async () => (await call(api, '/api/tasks')).find((t) => t.id === one.id).completed)
    .toBe(true)

  await page.reload()
  await expect(page.getByRole('button', { name: 'Задачи', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(cardTwo).toBeVisible()
  await expect(cardOne).toHaveCount(0) // done tasks leave the board on the next visit
  expect(errors).toEqual([])
})
