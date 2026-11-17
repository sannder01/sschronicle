import { test, expect } from '@playwright/test'
import { login, client, call } from './helpers'

test.beforeEach(async ({ context }) => login(context))

const dragTo = async (page, fromLocator, toLocator) => {
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

test('board: nested folders, folder strings, task strings, no schedule', async ({
  page,
  playwright,
}) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const api = await client(playwright)
  await call(api, '/api/profile', 'PATCH', { settings: { theme: 'light', accent: 'blue' } })
  const stamp = Date.now()
  const work = await call(api, '/api/folders', 'POST', { name: 'Работа ' + stamp }, 201)
  const project = await call(
    api,
    '/api/folders',
    'POST',
    { name: 'Проект ' + stamp, parent_id: work.id },
    201,
  )
  const home = await call(api, '/api/folders', 'POST', { name: 'Дом ' + stamp }, 201)
  const task = await call(
    api,
    '/api/tasks',
    'POST',
    { title: 'Сверстать макет ' + stamp, folder_id: project.id },
    201,
  )
  // a folder cannot go inside its own subfolder
  await call(api, '/api/folders/' + work.id, 'PATCH', { parent_id: project.id }, 400)

  await page.goto('/app/board')
  await expect(page.getByRole('heading', { name: 'Доска', exact: true })).toBeVisible()
  // the schedule is no longer on the board
  await expect(page.getByRole('button', { name: 'Расписание', exact: true })).toHaveCount(0)
  const card = (id) => page.locator(`.board-card[data-id="${id}"]`)
  const workCard = card(-work.id),
    projectCard = card(-project.id),
    homeCard = card(-home.id),
    taskCard = card(task.id)
  await expect(workCard).toHaveClass(/folder-card/)
  await expect(projectCard).toBeVisible()
  await expect(taskCard).toBeVisible()
  // nesting is drawn: Работа → Проект → task
  await expect(
    page.locator(`.rope.fixed[data-from="${-work.id}"][data-to="${-project.id}"]`),
  ).toHaveCount(1)
  await expect(
    page.locator(`.rope.fixed[data-from="${-project.id}"][data-to="${task.id}"]`),
  ).toHaveCount(1)
  await expect
    .poll(async () => (await call(api, '/api/folders')).filter((f) => f.canvas_x != null).length)
    .toBeGreaterThanOrEqual(3)

  // tie two folders with a string
  await dragTo(page, page.locator(`.board-pin[data-id="${-work.id}"]`), homeCard)
  const tied = async () =>
    (await call(api, '/api/folders/links')).filter(
      (l) => l.from_id === Math.min(work.id, home.id) && l.to_id === Math.max(work.id, home.id),
    ).length
  await expect.poll(tied).toBe(1)

  // a task cannot be tied to a folder by hand
  await taskCard.locator('.card-body').focus()
  await page.keyboard.press('l')
  await homeCard.locator('.card-body').click()
  await page.waitForTimeout(400)
  expect(await tied()).toBe(1)
  expect((await call(api, '/api/tasks/links')).some((l) => l.from_id === task.id)).toBe(false)

  // cut the folder string: click it, then the remove button
  const point = await page
    .locator(`.rope:not(.fixed)[data-from="${-home.id}"] .rope-hit`)
    .first()
    .evaluate((path) => {
      const p = path.getPointAtLength(path.getTotalLength() / 2),
        m = path.getScreenCTM()
      return { x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f }
    })
  await page.mouse.click(point.x, point.y)
  await page.getByRole('button', { name: 'Убрать нить' }).click()
  await expect.poll(tied).toBe(0)

  // deleting a folder moves its contents up a level
  await call(api, '/api/folders/' + project.id, 'DELETE')
  expect((await call(api, '/api/tasks')).find((x) => x.id === task.id).folder_id).toBe(work.id)

  expect(errors).toEqual([])
})

test('board: tie two tasks, finished tasks leave on the next visit', async ({
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
  await expect(cardTwo).toBeVisible()
  await expect(cardOne).toHaveCount(0) // done tasks leave the board on the next visit
  expect(errors).toEqual([])
})
