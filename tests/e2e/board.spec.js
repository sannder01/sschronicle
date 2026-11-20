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

test('graph: nested folders, folder links, task links, no schedule', async ({
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
  const node = (id) => page.locator(`.graph-node[data-node="${id}"]`)
  const dot = (id) => node(id).locator('.graph-dot')
  await expect(node(-work.id)).toHaveClass(/folder/)
  await expect(node(-project.id)).toBeVisible()
  await expect(node(task.id)).toBeVisible()
  // nesting is drawn: Работа → Проект → task
  await expect(
    page.locator(`.graph-edge.fixed[data-from="${-work.id}"][data-to="${-project.id}"]`),
  ).toHaveCount(1)
  await expect(
    page.locator(`.graph-edge.fixed[data-from="${-project.id}"][data-to="${task.id}"]`),
  ).toHaveCount(1)
  await page.waitForTimeout(1500) // let the layout settle

  // link two folders: Shift+drag from one dot onto the other
  await page.keyboard.down('Shift')
  await dragTo(page, dot(-work.id), dot(-home.id))
  await page.keyboard.up('Shift')
  const tied = async () =>
    (await call(api, '/api/folders/links')).filter(
      (l) => l.from_id === Math.min(work.id, home.id) && l.to_id === Math.max(work.id, home.id),
    ).length
  await expect.poll(tied).toBe(1)

  // a task cannot be linked to a folder by hand
  await page.waitForTimeout(800)
  await page.keyboard.down('Shift')
  await dragTo(page, dot(task.id), dot(-home.id))
  await page.keyboard.up('Shift')
  await page.waitForTimeout(400)
  expect(await tied()).toBe(1)
  expect((await call(api, '/api/tasks/links')).some((l) => l.from_id === task.id)).toBe(false)

  // remove the folder link: click the line, then the remove button
  await page.waitForTimeout(800)
  const point = await page
    .locator(
      `.graph-edge:not(.fixed)[data-to="${-home.id}"], .graph-edge:not(.fixed)[data-from="${-home.id}"]`,
    )
    .locator('.graph-hit')
    .first()
    .evaluate((line) => {
      const len = line.getTotalLength(),
        p = line.getPointAtLength(len * 0.5),
        m = line.getScreenCTM()
      return { x: p.x * m.a + p.y * m.c + m.e, y: p.x * m.b + p.y * m.d + m.f }
    })
  await page.mouse.click(point.x, point.y)
  await page.getByRole('button', { name: 'Убрать связь' }).click()
  await expect.poll(tied).toBe(0)

  // clicking a dot opens the task
  await dot(task.id).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')

  // deleting a folder moves its contents up a level
  await call(api, '/api/folders/' + project.id, 'DELETE')
  expect((await call(api, '/api/tasks')).find((x) => x.id === task.id).folder_id).toBe(work.id)

  expect(errors).toEqual([])
})

test('graph: link two tasks, finished tasks hidden by the filter', async ({ page, playwright }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  const api = await client(playwright)
  const stamp = Date.now()
  const one = await call(api, '/api/tasks', 'POST', { title: 'Прочитать статью ' + stamp }, 201)
  const two = await call(api, '/api/tasks', 'POST', { title: 'Написать конспект ' + stamp }, 201)

  await page.goto('/app/board')
  await expect(page.getByRole('button', { name: 'Новая задача' })).toBeVisible()
  const node = (id) => page.locator(`.graph-node[data-node="${id}"]`)
  const dot = (id) => node(id).locator('.graph-dot')
  await expect(node(one.id)).toBeVisible()
  await expect(node(two.id)).toBeVisible()
  await page.waitForTimeout(1500)

  await page.keyboard.down('Shift')
  await dragTo(page, dot(one.id), dot(two.id))
  await page.keyboard.up('Shift')
  await expect
    .poll(async () =>
      (await call(api, '/api/tasks/links')).some(
        (l) => l.from_id === Math.min(one.id, two.id) && l.to_id === Math.max(one.id, two.id),
      ),
    )
    .toBe(true)

  // finished tasks are hidden unless the filter shows them
  await call(api, '/api/tasks/' + one.id, 'PATCH', { completed: true })
  await page.reload()
  await expect(node(two.id)).toBeVisible()
  await expect(node(one.id)).toHaveCount(0)
  await page.getByRole('button', { name: 'Настройки графа' }).click()
  await page.getByRole('switch', { name: 'Выполненные задачи' }).check()
  await expect(node(one.id)).toHaveClass(/done/)
  await page.getByRole('switch', { name: 'Выполненные задачи' }).uncheck()
  expect(errors).toEqual([])
})
