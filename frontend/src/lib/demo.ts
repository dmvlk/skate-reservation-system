// Explicit, opt-in UI preview. Production and `npm run dev` never use this adapter.
import { ApiError, authToken } from './api'
import { addDays, normalizePhone, rentalNow } from './format'
import type { BookingCreate, Category, InventoryItem, ItemType } from '../types'

const catalog: Category[] = [
  { id: 1, code: 'skates', name: 'Коньки' },
  { id: 2, code: 'skis', name: 'Лыжи' },
  { id: 3, code: 'snowboard', name: 'Сноуборд' },
]
const definitions: [string, string, string[], string[]][] = [
  ['skate', 'Коньки', ['skates'], []],
  ['ski', 'Лыжи горные', ['skis'], ['S', 'M', 'L', 'XL']],
  ['ski_boot', 'Лыжные ботинки', ['skis'], []],
  ['snowboard', 'Сноуборд', ['snowboard'], ['S', 'M', 'L', 'XL']],
  ['snowboard_boot', 'Ботинки для сноуборда', ['snowboard'], []],
  ['helmet', 'Шлем', ['skis', 'snowboard'], ['S', 'M', 'L']],
  ['goggles', 'Очки (маска)', ['skis', 'snowboard'], []],
  ['jacket', 'Куртка', ['skis', 'snowboard'], ['S', 'M', 'L', 'XL']],
  ['pants', 'Штаны', ['skis', 'snowboard'], ['S', 'M', 'L', 'XL']],
  ['gloves', 'Перчатки', ['skis', 'snowboard'], ['S', 'M', 'L', 'XL']],
  ['elbow_pads', 'Налокотники', ['skates', 'skis', 'snowboard'], ['S', 'M', 'L', 'XL']],
  ['knee_pads', 'Наколенники', ['skates', 'skis', 'snowboard'], ['S', 'M', 'L', 'XL']],
]
const types: ItemType[] = definitions.map(([code, name, , sizes], i) => ({
  id: i + 1,
  code,
  name,
  is_required: i < 10,
  size_options: sizes.map((size, j) => ({ id: i * 10 + j + 1, code: size })),
}))
interface DemoItem extends InventoryItem {
  typeCode: string
}
interface DemoBooking extends BookingCreate {
  id: number
  status: string
  itemIds: number[]
}
interface DemoState {
  inventory: DemoItem[]
  bookings: DemoBooking[]
  nextItem: number
  nextBooking: number
}
const STORAGE = 'sneg.demo.v1'
function initialState(): DemoState {
  const inventory: DemoItem[] = []
  types.forEach((type) => {
    const sizes = ['skate', 'ski_boot', 'snowboard_boot'].includes(type.code)
      ? ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46']
      : type.size_options.length
        ? type.size_options.map((s) => s.code)
        : [null]
    sizes.forEach((size) => {
      for (let i = 0; i < 2; i++) {
        const id = inventory.length + 1
        inventory.push({
          id,
          typeCode: type.code,
          item_type: type.name,
          size,
          status: 'available',
          code: `${type.code.toUpperCase().replace(/_/g, '').slice(0, 6)}-${String(id).padStart(3, '0')}`,
        })
      }
    })
  })
  const item = inventory.find((i) => i.typeCode === 'skate' && i.size === '42')!
  return {
    inventory,
    nextItem: inventory.length + 1,
    nextBooking: 1043,
    bookings: [
      {
        id: 1042,
        category: 'skates',
        phone: '79991234567',
        first_name: 'Алексей',
        last_name: 'Иванов',
        booking_date: addDays(rentalNow().date, 1),
        hours: [14, 15],
        size_value: 42,
        status: 'active',
        itemIds: [item.id],
      },
    ],
  }
}
function getState(): DemoState {
  try {
    const raw = sessionStorage.getItem(STORAGE)
    if (raw) return JSON.parse(raw) as DemoState
  } catch {
    /* Start a fresh preview if the old session data is invalid. */
  }
  const state = initialState()
  save(state)
  return state
}
function save(state: DemoState) {
  sessionStorage.setItem(STORAGE, JSON.stringify(state))
}
function chooseItems(
  state: DemoState,
  category: string,
  date: string,
  hours: number[],
  size: string,
  bucket: string,
): number[] | null {
  const required =
    category === 'skates'
      ? [['skate', size]]
      : category === 'skis'
        ? [
            ['ski', bucket],
            ['ski_boot', size],
          ]
        : [
            ['snowboard', bucket],
            ['snowboard_boot', size],
          ]
  const ids: number[] = []
  for (const [type, value] of required) {
    const item = state.inventory.find(
      (i) =>
        i.typeCode === type &&
        i.size === value &&
        i.status === 'available' &&
        !state.bookings.some(
          (b) =>
            ['active', 'issued'].includes(b.status) &&
            b.booking_date === date &&
            b.itemIds.includes(i.id) &&
            hours.some((h) => b.hours.includes(h)),
        ),
    )
    if (!item) return null
    ids.push(item.id)
  }
  return ids
}
export async function demoRequest<T>(
  path: string,
  options: RequestInit,
  admin: boolean,
): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, 180))
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  if (admin && authToken.get() !== 'sneg-demo-session') {
    authToken.clear()
    window.dispatchEvent(new Event('sneg:session-expired'))
    throw new ApiError('Войдите с логином demo и паролем demo.', 401)
  }
  const url = new URL(path, 'http://demo.local')
  const route = url.pathname
  const params = url.searchParams
  const body = options.body ? JSON.parse(String(options.body)) : {}
  const method = options.method || 'GET'
  const state = getState()
  let result: unknown
  const bookingView = (b: DemoBooking, full = false) => ({
    id: b.id,
    category: b.category,
    booking_date: b.booking_date,
    hours: b.hours,
    status: b.status,
    ...(full
      ? {
          phone: b.phone,
          full_name: [b.last_name, b.first_name, b.middle_name].filter(Boolean).join(' '),
        }
      : {}),
    items: b.itemIds.map((id) => {
      const item = state.inventory.find((i) => i.id === id)!
      return full ? item.item_type : { item_type: item.item_type, size: item.size }
    }),
  })
  if (route === '/categories') result = catalog
  else if (route.startsWith('/categories/')) {
    const code = route.split('/')[2]
    result = types.filter((_, i) => definitions[i][2].includes(code))
  } else if (route === '/auth/login') {
    if (body.username !== 'demo' || body.password !== 'demo')
      throw new ApiError('В деморежиме используйте логин demo и пароль demo.', 401)
    result = {
      access_token: 'sneg-demo-session',
      token_type: 'bearer',
      username: 'demo',
      full_name: 'Анна Соколова',
    }
  } else if (route === '/auth/me')
    result = {
      id: 1,
      username: 'demo',
      first_name: 'Анна',
      last_name: 'Соколова',
      middle_name: null,
    }
  else if (route === '/availability') {
    const category = params.get('category') || 'skates'
    result = {
      category,
      days: Array.from({ length: Number(params.get('days') || 7) }, (_, i) => {
        const date = addDays(params.get('start_date') || rentalNow().date, i)
        return {
          date,
          available_hours: Array.from({ length: 10 }, (_, h) => h + 10).filter((h) =>
            chooseItems(
              state,
              category,
              date,
              [h],
              params.get('size_value') || params.get('boot_size_value') || '',
              params.get('size_bucket') || '',
            ),
          ),
        }
      }),
    }
  } else if (route === '/bookings' && method === 'POST') {
    const data = body as BookingCreate
    const phone = normalizePhone(data.phone)
    if (state.bookings.filter((b) => b.phone === phone && b.status === 'active').length >= 4)
      throw new ApiError('У вас уже 4 активные брони. Отмените одну, чтобы создать новую.', 429)
    const now = rentalNow()
    if (
      data.booking_date < now.date ||
      (data.booking_date === now.date && data.hours.some((h) => h <= now.hour))
    )
      throw new ApiError('Нельзя бронировать на прошедшие часы.', 400)
    const ids = chooseItems(
      state,
      data.category,
      data.booking_date,
      data.hours,
      String(data.size_value || data.boot_size_value),
      data.size_bucket || '',
    )
    if (!ids)
      throw new ApiError('На выбранные часы нет свободного комплекта. Выберите другое время.', 409)
    const booking: DemoBooking = {
      ...data,
      phone,
      id: state.nextBooking++,
      itemIds: ids,
      status: 'active',
    }
    state.bookings.unshift(booking)
    save(state)
    result = {
      id: booking.id,
      phone_last4: phone.slice(-4),
      category: booking.category,
      booking_date: booking.booking_date,
      hours: booking.hours,
      status: booking.status,
    }
  } else if (route === '/my-bookings')
    result = state.bookings
      .filter((b) => b.phone === normalizePhone(params.get('phone') || ''))
      .map((b) => bookingView(b))
  else if (route.startsWith('/my-bookings/')) {
    const booking = state.bookings.find(
      (b) =>
        b.id === Number(route.split('/')[2]) &&
        b.phone === normalizePhone(params.get('phone') || ''),
    )
    if (!booking) throw new ApiError('Бронь не найдена', 404)
    if (booking.status !== 'active') throw new ApiError('Эту бронь уже нельзя отменить.', 400)
    booking.status = 'cancelled'
    save(state)
    result = { id: booking.id, status: booking.status, message: 'Бронь успешно отменена' }
  } else if (route === '/admin/bookings')
    result = state.bookings
      .filter((b) => b.phone === normalizePhone(params.get('phone') || ''))
      .map((b) => bookingView(b, true))
  else if (route.startsWith('/admin/bookings/')) {
    const booking = state.bookings.find((b) => b.id === Number(route.split('/')[3]))
    if (!booking) throw new ApiError('Бронь не найдена', 404)
    if (method === 'GET') result = bookingView(booking, true)
    else {
      const issuing = route.endsWith('/issue')
      if (booking.status !== (issuing ? 'active' : 'issued'))
        throw new ApiError('Недопустимый статус брони.', 400)
      booking.status = issuing ? 'issued' : 'completed'
      state.inventory
        .filter((i) => booking.itemIds.includes(i.id))
        .forEach((i) => {
          i.status = issuing ? 'rented' : 'available'
        })
      save(state)
      result = {
        id: booking.id,
        status: booking.status,
        message: issuing ? 'Инвентарь выдан' : 'Возврат принят',
      }
    }
  } else if (route === '/admin/inventory') {
    if (method === 'GET')
      result = state.inventory.filter(
        (i) =>
          (!params.get('item_type') || i.typeCode === params.get('item_type')) &&
          (!params.get('status') || i.status === params.get('status')),
      )
    else {
      const type = types.find((t) => t.code === body.item_type_code)
      if (!type) throw new ApiError('Тип снаряжения не найден.', 400)
      const id = state.nextItem++
      const item: DemoItem = {
        id,
        typeCode: type.code,
        item_type: type.name,
        size: body.size_value ? String(body.size_value) : body.size_bucket || null,
        status: 'available',
        code: `${type.code.toUpperCase().replace(/_/g, '').slice(0, 6)}-${String(id).padStart(3, '0')}`,
      }
      state.inventory.push(item)
      save(state)
      result = item
    }
  } else if (route.startsWith('/admin/inventory/')) {
    const item = state.inventory.find((i) => i.id === Number(route.split('/')[3]))
    if (!item) throw new ApiError('Единица инвентаря не найдена.', 400)
    if (method === 'DELETE') {
      if (state.bookings.some((b) => b.itemIds.includes(item.id)))
        throw new ApiError('Нельзя удалить: единица используется в бронях', 400)
      state.inventory = state.inventory.filter((i) => i.id !== item.id)
      save(state)
      return undefined as T
    }
    item.status = body.status_code
    save(state)
    result = item
  } else throw new ApiError('Этот запрос недоступен в деморежиме.', 404)
  return result as T
}
