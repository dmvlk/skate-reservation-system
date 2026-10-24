import { test, expect, type Page } from '@playwright/test'

const categoryData = [
  { id: 1, code: 'skates', name: 'Коньки' },
  { id: 2, code: 'skis', name: 'Лыжи' },
  { id: 3, code: 'snowboard', name: 'Сноуборд' },
]
const types = [
  { id: 1, code: 'skate', name: 'Коньки', is_required: true, size_options: [] },
  {
    id: 2,
    code: 'ski',
    name: 'Лыжи горные',
    is_required: true,
    size_options: [
      { id: 1, code: 'M' },
      { id: 2, code: 'L' },
    ],
  },
  { id: 3, code: 'ski_boot', name: 'Лыжные ботинки', is_required: true, size_options: [] },
  {
    id: 4,
    code: 'snowboard',
    name: 'Сноуборд',
    is_required: true,
    size_options: [{ id: 3, code: 'M' }],
  },
  {
    id: 5,
    code: 'snowboard_boot',
    name: 'Ботинки для сноуборда',
    is_required: true,
    size_options: [],
  },
  {
    id: 6,
    code: 'helmet',
    name: 'Шлем',
    is_required: true,
    size_options: [
      { id: 4, code: 'S' },
      { id: 5, code: 'M' },
    ],
  },
]
async function mockApi(page: Page) {
  await page.clock.install({ time: new Date('2026-10-22T09:30:00Z') })
  const state = {
    status: 'active',
    inventory: [{ id: 1, code: 'SK-001', item_type: 'Коньки', size: '42', status: 'available' }],
  }
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api', '')
    const method = route.request().method()
    const fulfill = (data: unknown, status = 200) => route.fulfill({ status, json: data })
    if (path === '/categories') return fulfill(categoryData)
    if (path.includes('/item-types')) return fulfill(types)
    if (path === '/availability')
      return fulfill({
        category: url.searchParams.get('category'),
        days: Array.from({ length: 7 }, (_, i) => ({
          date: `2026-10-${22 + i}`,
          available_hours: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19],
        })),
      })
    if (path === '/bookings') {
      const body = route.request().postDataJSON()
      return fulfill({ id: 42, ...body, phone_last4: '4567', status: 'active' }, 201)
    }
    if (path === '/my-bookings')
      return fulfill([
        {
          id: 42,
          category: 'skates',
          booking_date: '2026-10-23',
          hours: [14, 15],
          status: state.status,
          items: [{ item_type: 'Коньки', size: '42' }],
        },
      ])
    if (path === '/my-bookings/42/cancel') {
      state.status = 'cancelled'
      return fulfill({ id: 42, status: state.status, message: 'Бронь успешно отменена' })
    }
    if (path === '/auth/login')
      return fulfill({
        access_token: 'test-session',
        token_type: 'bearer',
        username: 'operator',
        full_name: 'Тестовый Администратор',
      })
    if (path === '/auth/me')
      return fulfill({
        id: 1,
        username: 'operator',
        first_name: 'Тестовый',
        last_name: 'Администратор',
        middle_name: null,
      })
    if (path === '/admin/bookings' || path === '/admin/bookings/42') {
      const item = {
        id: 42,
        phone: '79991234567',
        full_name: 'Иванов Алексей',
        category: 'skates',
        booking_date: '2026-10-23',
        hours: [14, 15],
        status: state.status,
        items: ['Коньки'],
      }
      return fulfill(path.endsWith('/42') ? item : [item])
    }
    if (path.endsWith('/issue')) {
      state.status = 'issued'
      return fulfill({ id: 42, status: 'issued', message: 'Инвентарь выдан' })
    }
    if (path.endsWith('/complete')) {
      state.status = 'completed'
      return fulfill({ id: 42, status: 'completed', message: 'Возврат принят' })
    }
    if (path === '/admin/inventory' && method === 'GET')
      return fulfill(
        state.inventory.filter(
          (i) => !url.searchParams.get('status') || i.status === url.searchParams.get('status'),
        ),
      )
    if (path === '/admin/inventory' && method === 'POST') {
      const body = route.request().postDataJSON()
      const item = {
        id: 2,
        code: 'SKATE-002',
        item_type: 'Коньки',
        size: String(body.size_value),
        status: 'available',
      }
      state.inventory.push(item)
      return fulfill(item, 201)
    }
    if (path.endsWith('/status')) {
      state.inventory[0].status = route.request().postDataJSON().status_code
      return fulfill(state.inventory[0])
    }
    if (path.startsWith('/admin/inventory/') && method === 'DELETE') {
      state.inventory = state.inventory.filter((i) => i.id !== Number(path.split('/').at(-1)))
      return route.fulfill({ status: 204 })
    }
    return fulfill({ detail: `Unmocked: ${method} ${path}` }, 404)
  })
  return state
}
async function fillClient(page: Page) {
  await page.getByLabel('Фамилия', { exact: true }).fill('  Иванов  ')
  await page.getByLabel('Имя', { exact: true }).fill('Алексей')
  await page.getByLabel('Номер телефона', { exact: true }).fill('8 (999) 123-45-67')
}
async function login(page: Page) {
  await page.goto('/admin')
  await page.getByLabel('Логин', { exact: true }).fill('operator')
  await page.getByLabel('Пароль', { exact: true }).fill('secret')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Пункт проката' })).toBeVisible()
}
test('skates: exact payload, past-hour filtering and receipt', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Забронировать: Коньки' })).toBeVisible()
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true })
  await page.getByRole('link', { name: 'Забронировать: Коньки' }).click()
  await page.getByRole('button', { name: '42', exact: true }).click()
  await page.getByRole('button', { name: 'Выбрать время' }).click()
  await expect(page.getByRole('button', { name: '12:00–13:00', exact: true })).toBeDisabled()
  await page.screenshot({ path: 'test-results/booking-desktop.png', fullPage: true })
  await page.getByRole('button', { name: '14:00–15:00', exact: true }).click()
  await page.getByRole('button', { name: '15:00–16:00', exact: true }).click()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await fillClient(page)
  const request = page.waitForRequest(
    (r) => r.url().endsWith('/api/bookings') && r.method() === 'POST',
  )
  await page.getByRole('button', { name: 'Подтвердить бронь' }).click()
  expect((await request).postDataJSON()).toEqual({
    category: 'skates',
    size_value: 42,
    phone: '79991234567',
    first_name: 'Алексей',
    last_name: 'Иванов',
    middle_name: null,
    booking_date: '2026-10-22',
    hours: [14, 15],
  })
  await expect(page.getByRole('heading', { name: 'Всё готово к вашему дню' })).toBeVisible()
  await expect(page.getByText('№ 42', { exact: true })).toBeVisible()
})
for (const category of ['skis', 'snowboard']) {
  test(`${category}: board and boot sizes, without unsupported extras`, async ({ page }) => {
    await mockApi(page)
    await page.goto(`/booking/${category}`)
    await expect(page.getByRole('button', { name: 'Выбрать время' })).toBeDisabled()
    await page.getByRole('button', { name: 'M', exact: true }).click()
    await page.getByRole('button', { name: '42', exact: true }).click()
    const availability = page.waitForRequest((r) => r.url().includes('/api/availability'))
    await page.getByRole('button', { name: 'Выбрать время' }).click()
    const params = new URL((await availability).url()).searchParams
    expect(params.get('size_bucket')).toBe('M')
    expect(params.get('boot_size_value')).toBe('42')
    expect(params.has('size_value')).toBe(false)
    await page.getByRole('button', { name: '14:00–15:00', exact: true }).click()
    await page.getByRole('button', { name: 'Продолжить' }).click()
    await fillClient(page)
    const request = page.waitForRequest(
      (r) => r.url().endsWith('/api/bookings') && r.method() === 'POST',
    )
    await page.getByRole('button', { name: 'Подтвердить бронь' }).click()
    const body = (await request).postDataJSON()
    expect(body.category).toBe(category)
    expect(body.size_bucket).toBe('M')
    expect(body.boot_size_value).toBe(42)
    expect(body.size_value).toBeUndefined()
    expect(body.items).toBeUndefined()
    await expect(page.getByRole('heading', { name: 'Всё готово к вашему дню' })).toBeVisible()
  })
}
test('409 returns to time selection and preserves contact fields', async ({ page }) => {
  await mockApi(page)
  await page.route('**/api/bookings', (route) =>
    route.fulfill({
      status: 409,
      json: { detail: 'На выбранные часы нет свободной единицы: Коньки' },
    }),
  )
  await page.goto('/booking/skates')
  await page.getByRole('button', { name: '42', exact: true }).click()
  await page.getByRole('button', { name: 'Выбрать время' }).click()
  await page.getByRole('button', { name: '14:00–15:00', exact: true }).click()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await fillClient(page)
  await page.getByRole('button', { name: 'Подтвердить бронь' }).click()
  await expect(page.getByRole('alert')).toContainText('нет свободной единицы')
  await expect(page.getByRole('button', { name: 'Продолжить' })).toBeDisabled()
  await page.getByRole('button', { name: '16:00–17:00', exact: true }).click()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('Алексей')
})
test('lookup and cancel require confirmation and normalize phone', async ({ page }) => {
  await mockApi(page)
  await page.goto('/my-bookings')
  await page.getByRole('textbox').fill('8 (999) 123-45-67')
  const request = page.waitForRequest((r) => r.url().includes('/api/my-bookings?'))
  await page.getByRole('button', { name: 'Найти брони' }).click()
  expect(new URL((await request).url()).searchParams.get('phone')).toBe('79991234567')
  await page.getByRole('button', { name: 'Отменить бронь', exact: true }).click()
  await page.getByRole('button', { name: 'Оставить бронь' }).click()
  await expect(page.getByText('Забронировано', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Отменить бронь', exact: true }).click()
  await page.getByRole('button', { name: 'Да, отменить' }).click()
  await expect(page.getByText('Отменено', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Отменить бронь', exact: true })).toHaveCount(0)
})
test('admin authenticated search, issue, return and logout', async ({ page }) => {
  await mockApi(page)
  await login(page)
  await page.getByLabel('Телефон клиента', { exact: true }).fill('89991234567')
  const request = page.waitForRequest((r) => r.url().includes('/api/admin/bookings?'))
  await page.getByRole('button', { name: 'Найти', exact: true }).click()
  expect((await request).headers().authorization).toBe('Bearer test-session')
  await page.getByRole('button', { name: 'Выдать снаряжение' }).click()
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click()
  await page.getByRole('button', { name: 'Принять возврат' }).click()
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click()
  await expect(page.getByText('Завершено', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('sneg.admin.token'))).toBeNull()
})
test('inventory add, mark broken, restore, delete', async ({ page }) => {
  await mockApi(page)
  await login(page)
  await page.getByRole('link', { name: 'Инвентарь', exact: true }).click()
  await page.getByRole('button', { name: 'Добавить снаряжение' }).click()
  await page.getByLabel('Размер EU', { exact: true }).fill('42')
  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'SKATE-002', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-results/inventory-desktop.png', fullPage: true })
  await page.getByRole('button', { name: 'Отметить поломку SK-001' }).click()
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Сломан', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Вернуть в прокат SK-001' }).click()
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click()
  await page.getByRole('button', { name: 'Удалить SKATE-002', exact: true }).click()
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'SKATE-002', exact: true })).toHaveCount(0)
})
test('expired admin token redirects to login and clears token', async ({ page }) => {
  await mockApi(page)
  await login(page)
  await page.route('**/api/admin/inventory?*', (route) =>
    route.fulfill({ status: 401, json: { detail: 'Невалидный или истёкший токен' } }),
  )
  await page.getByRole('link', { name: 'Инвентарь', exact: true }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByText('Сессия завершилась. Войдите ещё раз.')).toBeVisible()
})
test('server failure stays explicit; no fictitious catalog availability', async ({ page }) => {
  await mockApi(page)
  await page.route('**/api/categories', (route) =>
    route.fulfill({ status: 503, json: { detail: 'unavailable' } }),
  )
  await page.goto('/')
  await page.clock.runFor(2000)
  await expect(page.getByRole('alert')).toContainText('Сервис временно недоступен')
  await expect(page.getByRole('link', { name: 'Забронировать: Коньки' })).toHaveCount(0)
})
test('mobile pages fit viewport and booking stays usable', async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of ['/', '/booking/skates', '/my-bookings', '/admin/login']) {
    await page.goto(path)
    await expect(page.locator('h1')).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
    if (path === '/') {
      await expect(page.getByRole('link', { name: 'Забронировать: Коньки' })).toBeVisible()
      await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true })
    }
  }
  await page.goto('/booking/skates')
  await page.getByRole('button', { name: '42', exact: true }).click()
  await page.getByRole('button', { name: 'Выбрать время' }).click()
  await page.getByRole('button', { name: '14:00–15:00', exact: true }).click()
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await fillClient(page)
  await page.getByRole('button', { name: 'Подтвердить бронь' }).click()
  await expect(page.getByRole('heading', { name: 'Всё готово к вашему дню' })).toBeVisible()
})
