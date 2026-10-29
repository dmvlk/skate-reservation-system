import type {
  ActionResult,
  Admin,
  AdminBooking,
  Availability,
  BookingCreate,
  BookingReceipt,
  Category,
  InventoryCreate,
  InventoryItem,
  ItemType,
  LoginResult,
  MyBooking,
} from '../types'

const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')
export const DEMO_MODE = import.meta.env.MODE === 'demo'
const TOKEN_KEY = DEMO_MODE ? 'sneg.demo.admin.token' : 'sneg.admin.token'
export const authToken = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (token: string) => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
}
export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
const fieldNames: Record<string, string> = {
  phone: 'Телефон',
  first_name: 'Имя',
  last_name: 'Фамилия',
  hours: 'Время',
  booking_date: 'Дата',
  size_value: 'Размер',
  boot_size_value: 'Размер ботинок',
  size_bucket: 'Размер снаряжения',
}

async function request<T>(path: string, options: RequestInit = {}, admin = false): Promise<T> {
  if (DEMO_MODE) {
    const { demoRequest } = await import('./demo')
    return demoRequest<T>(path, options, admin)
  }
  const headers = new Headers(options.headers)
  if (options.body) headers.set('Content-Type', 'application/json')
  if (admin && authToken.get()) headers.set('Authorization', `Bearer ${authToken.get()}`)
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      headers,
      signal: options.signal ?? AbortSignal.timeout(15000),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(
      'Не удалось связаться с сервером. Проверьте подключение и попробуйте ещё раз.',
      0,
    )
  }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    if (admin && response.status === 401) {
      authToken.clear()
      window.dispatchEvent(new Event('sneg:session-expired'))
    }
    let message = 'Не удалось выполнить запрос. Попробуйте ещё раз.'
    if (response.status >= 500)
      message = 'Сервис временно недоступен. Попробуйте ещё раз чуть позже.'
    else if (typeof data?.detail === 'string') message = data.detail
    else if (Array.isArray(data?.detail))
      message = data.detail
        .map(
          (e: { loc?: string[] }) =>
            `${fieldNames[e.loc?.at(-1) || ''] || 'Поле формы'}: проверьте значение`,
        )
        .join('. ')
    throw new ApiError(message, response.status)
  }
  if (data === null)
    throw new ApiError('Сервер вернул неожиданный ответ. Попробуйте ещё раз.', response.status)
  return data as T
}
function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString()
}
const post = (body?: unknown): RequestInit => ({
  method: 'POST',
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
export const api = {
  categories: (signal?: AbortSignal) => request<Category[]>('/categories', { signal }),
  itemTypes: (category: string, signal?: AbortSignal) =>
    request<ItemType[]>(`/categories/${encodeURIComponent(category)}/item-types`, { signal }),
  availability: (values: Record<string, string | number | undefined>, signal?: AbortSignal) =>
    request<Availability>(`/availability?${query(values)}`, { signal }),
  book: (body: BookingCreate) => request<BookingReceipt>('/bookings', post(body)),
  myBookings: (phone: string, signal?: AbortSignal) =>
    request<MyBooking[]>(`/my-bookings?${query({ phone })}`, { signal }),
  cancel: (id: number, phone: string) =>
    request<ActionResult>(`/my-bookings/${id}/cancel?${query({ phone })}`, post()),
  login: (username: string, password: string) =>
    request<LoginResult>('/auth/login', post({ username, password })),
  me: (signal?: AbortSignal) => request<Admin>('/auth/me', { signal }, true),
  adminBookings: (phone: string, signal?: AbortSignal) =>
    request<AdminBooking[]>(`/admin/bookings?${query({ phone })}`, { signal }, true),
  adminBooking: (id: number, signal?: AbortSignal) =>
    request<AdminBooking>(`/admin/bookings/${id}`, { signal }, true),
  issue: (id: number) => request<ActionResult>(`/admin/bookings/${id}/issue`, post(), true),
  complete: (id: number) => request<ActionResult>(`/admin/bookings/${id}/complete`, post(), true),
  inventory: (item_type?: string, status?: string, signal?: AbortSignal) =>
    request<InventoryItem[]>(`/admin/inventory?${query({ item_type, status })}`, { signal }, true),
  addInventory: (body: InventoryCreate) =>
    request<InventoryItem>('/admin/inventory', post(body), true),
  deleteInventory: (id: number) =>
    request<void>(`/admin/inventory/${id}`, { method: 'DELETE' }, true),
  inventoryStatus: (id: number, status_code: string) =>
    request<InventoryItem>(
      `/admin/inventory/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status_code }) },
      true,
    ),
}
