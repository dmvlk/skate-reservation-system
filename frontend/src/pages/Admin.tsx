import { useEffect, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import {
  ArrowRight,
  Boxes,
  Check,
  ClipboardList,
  LogOut,
  Plus,
  Search,
  Trash2,
  Wrench,
} from 'lucide-react'
import { api, authToken } from '../lib/api'
import {
  categoryName,
  dateLabel,
  hoursLabel,
  normalizePhone,
  numberSized,
  validPhone,
} from '../lib/format'
import { Empty, ErrorNotice, Loading, Modal, Status, SuccessNotice } from '../components/ui'
import type { AdminBooking, InventoryCreate, InventoryItem } from '../types'

export function AdminLogin() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const mutation = useMutation({
    mutationFn: () => api.login(username.trim(), password),
    onSuccess: (result) => {
      authToken.set(result.access_token)
      const destination = location.state?.from
      navigate(
        typeof destination === 'string' &&
          destination.startsWith('/admin') &&
          destination !== '/admin/login'
          ? destination
          : '/admin',
        { replace: true },
      )
    },
  })
  if (authToken.get()) return <Navigate to="/admin" replace />
  return (
    <div className="container page login-page">
      <form
        className="panel login-panel"
        onSubmit={(e) => {
          e.preventDefault()
          if (!mutation.isPending) mutation.mutate()
        }}
      >
        <h1>Вход для сотрудников</h1>
        {location.state?.expired && (
          <div className="notice neutral">Сессия завершилась. Войдите еще раз.</div>
        )}
        <ErrorNotice error={mutation.error} />
        <label>
          Логин
          <input
            autoComplete="username"
            required
            maxLength={50}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ваш логин"
          />
        </label>
        <label>
          Пароль
          <input
            type="password"
            autoComplete="current-password"
            required
            maxLength={100}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ваш пароль"
          />
        </label>
        <button className="button primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}

export function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const cache = useQueryClient()
  const token = authToken.get()
  const me = useQuery({
    queryKey: ['admin', 'me', token],
    queryFn: ({ signal }) => api.me(signal),
    enabled: !!token,
    retry: false,
  })
  useEffect(() => {
    function expired() {
      cache.removeQueries({ queryKey: ['admin'] })
      navigate('/admin/login', { replace: true, state: { expired: true, from: location.pathname } })
    }
    window.addEventListener('sneg:session-expired', expired)
    return () => window.removeEventListener('sneg:session-expired', expired)
  }, [cache, navigate, location.pathname])
  if (!token) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />
  if (me.isPending)
    return (
      <div className="container page">
        <Loading text="Проверяем доступ…" />
      </div>
    )
  if (me.isError)
    return (
      <div className="container page">
        <ErrorNotice
          error={me.error}
          retry={() => {
            void me.refetch()
          }}
        />
        <button
          className="button secondary"
          onClick={() => {
            authToken.clear()
            cache.removeQueries({ queryKey: ['admin'] })
            navigate('/admin/login')
          }}
        >
          Вернуться ко входу
        </button>
      </div>
    )
  return (
    <div className="container page admin-page">
      <div className="admin-heading" style={{ justifyContent: 'flex-end' }}>
        <div className="admin-user">
          <span>
            {[me.data.first_name, me.data.last_name].filter(Boolean).join(' ') || me.data.username}
            <small>Администратор</small>
          </span>
          <button
            className="icon-button"
            aria-label="Выйти"
            onClick={() => {
              authToken.clear()
              cache.removeQueries({ queryKey: ['admin'] })
              navigate('/admin/login')
            }}
          >
            <LogOut size={19} />
          </button>
        </div>
      </div>
      <nav className="admin-tabs" aria-label="Управление прокатом">
        <NavLink to="/admin" end>
          <ClipboardList size={18} />
          Бронирования
        </NavLink>
        <NavLink to="/admin/inventory">
          <Boxes size={18} />
          Инвентарь
        </NavLink>
      </nav>
      <Outlet />
    </div>
  )
}

export function AdminBookings() {
  const [mode, setMode] = useState<'phone' | 'id'>('phone')
  const [input, setInput] = useState('')
  const [search, setSearch] = useState<{ mode: 'phone' | 'id'; value: string } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [action, setAction] = useState<{
    booking: AdminBooking
    kind: 'issue' | 'complete'
  } | null>(null)
  const cache = useQueryClient()
  const bookings = useQuery({
    queryKey: ['admin', 'bookings', search],
    queryFn: async ({ signal }) =>
      search!.mode === 'phone'
        ? api.adminBookings(search!.value, signal)
        : [await api.adminBooking(Number(search!.value), signal)],
    enabled: !!search,
  })
  const mutation = useMutation({
    mutationFn: (value: NonNullable<typeof action>) =>
      value.kind === 'issue' ? api.issue(value.booking.id) : api.complete(value.booking.id),
    onSuccess: (result) => {
      setNotice(result.message)
      setAction(null)
      void cache.invalidateQueries({ queryKey: ['admin', 'bookings'] })
      void cache.invalidateQueries({ queryKey: ['admin', 'inventory'] })
      void cache.invalidateQueries({ queryKey: ['availability'] })
    },
  })
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (
      mode === 'phone'
        ? !validPhone(input)
        : !/^\d+$/.test(input) || !Number.isSafeInteger(Number(input)) || Number(input) < 1
    ) {
      setError(
        mode === 'phone'
          ? 'Введите полный номер телефона: от 10 до 15 цифр.'
          : 'Введите положительный целый номер брони.',
      )
      return
    }
    setError('')
    setNotice('')
    const value = mode === 'phone' ? normalizePhone(input) : input
    if (search?.mode === mode && search.value === value) void bookings.refetch()
    else setSearch({ mode, value })
  }
  return (
    <>

      <form className="panel admin-search" onSubmit={submit}>
        <div className="segmented">
          {(['phone', 'id'] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={mode === value}
              className={mode === value ? 'selected' : ''}
              onClick={() => {
                setMode(value)
                setInput('')
                setError('')
              }}
            >
              {value === 'phone' ? 'По телефону' : 'По номеру брони'}
            </button>
          ))}
        </div>
        <div className="search-row">
          <label className="sr-only" htmlFor="admin-search">
            {mode === 'phone' ? 'Телефон клиента' : 'Номер брони'}
          </label>
          <div className="input-with-icon">
            <Search size={19} />
            <input
              id="admin-search"
              type={mode === 'phone' ? 'tel' : 'text'}
              inputMode={mode === 'id' ? 'numeric' : 'tel'}
              maxLength={25}
              required
              placeholder={mode === 'phone' ? '+7 (999) 123-45-67' : 'Например, 42'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
          <button className="button primary" disabled={bookings.isFetching}>
            Найти <ArrowRight size={17} />
          </button>
        </div>
      </form>
      <ErrorNotice error={error || bookings.error} />
      {notice && <SuccessNotice>{notice}</SuccessNotice>}
      {search && bookings.isPending && <Loading />}
      {bookings.isSuccess && bookings.data.length === 0 && (
        <Empty title="Бронирования не найдены">Проверьте полный номер телефона клиента.</Empty>
      )}
      <div className="booking-list">
        {bookings.data?.map((booking) => (
          <article className="panel reservation-card" key={booking.id}>
            <div className="reservation-top">
              <span className="eyebrow">БРОНЬ № {booking.id}</span>
              <Status value={booking.status} />
            </div>
            <h2>{booking.full_name}</h2>
            <p className="muted">
              +{booking.phone} · {categoryName(booking.category)}
            </p>
            <div className="reservation-meta">
              <span>{dateLabel(booking.booking_date)}</span>
              <span>{hoursLabel(booking.hours)}</span>
            </div>
            <div className="item-tags">
              {booking.items.map((item, i) => (
                <span key={i}>{item}</span>
              ))}
            </div>
            {['active', 'issued'].includes(booking.status) && (
              <div className="reservation-bottom">
                <span className="muted">
                  {booking.status === 'active'
                    ? 'Сверьте данные клиента перед выдачей.'
                    : 'Проверьте комплектность и состояние снаряжения.'}
                </span>
                <button
                  className="button primary"
                  onClick={() => {
                    mutation.reset()
                    setAction({ booking, kind: booking.status === 'active' ? 'issue' : 'complete' })
                  }}
                >
                  {booking.status === 'active' ? 'Выдать снаряжение' : 'Принять возврат'}
                  <Check size={17} />
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
      {action && (
        <Modal
          title={action.kind === 'issue' ? 'Подтвердить выдачу?' : 'Принять возврат?'}
          close={() => setAction(null)}
          busy={mutation.isPending}
        >
          <p>
            Бронь № {action.booking.id} · {action.booking.full_name}
          </p>
          <p className="muted">
            {action.kind === 'issue'
              ? 'Снаряжение будет отмечено как выданное.'
              : 'Бронь завершится, а снаряжение станет доступным. Если обнаружена поломка, отметьте ее затем во вкладке «Инвентарь».'}
          </p>
          <ErrorNotice error={mutation.error} />
          <div className="button-row">
            <button
              className="button secondary"
              disabled={mutation.isPending}
              onClick={() => setAction(null)}
            >
              Назад
            </button>
            <button
              className="button primary"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(action)}
            >
              {mutation.isPending ? 'Сохраняем…' : 'Подтвердить'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}

type InventoryAction = { kind: 'delete' | 'status'; item: InventoryItem; status?: string }
export function AdminInventory() {
  const [type, setType] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [action, setAction] = useState<InventoryAction | null>(null)
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState({ type: '', size: '', bucket: '' })
  const [error, setError] = useState('')
  const cache = useQueryClient()
  const catalog = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => api.categories(signal),
  })
  const typeQueries = useQueries({
    queries: (catalog.data || []).map((category) => ({
      queryKey: ['item-types', category.code],
      queryFn: ({ signal }: { signal: AbortSignal }) => api.itemTypes(category.code, signal),
    })),
  })
  const types = [
    ...new Map(typeQueries.flatMap((q) => q.data || []).map((t) => [t.code, t])).values(),
  ]
  const typesReady = catalog.isSuccess && typeQueries.every((q) => q.isSuccess)
  const typesError = catalog.error || typeQueries.find((q) => q.error)?.error
  const selectedType = types.find((t) => t.code === draft.type)
  const inventory = useQuery({
    queryKey: ['admin', 'inventory', type, status],
    queryFn: ({ signal }) => api.inventory(type, status, signal),
  })
  function refresh() {
    void cache.invalidateQueries({ queryKey: ['admin', 'inventory'] })
    void cache.invalidateQueries({ queryKey: ['availability'] })
  }
  const add = useMutation({
    mutationFn: (payload: InventoryCreate) => api.addInventory(payload),
    onSuccess: (item) => {
      setAdding(false)
      setNotice(`Добавлено: ${item.code}`)
      refresh()
    },
  })
  const change = useMutation({
    mutationFn: async (value: InventoryAction) => {
      if (value.kind === 'delete') await api.deleteInventory(value.item.id)
      else await api.inventoryStatus(value.item.id, value.status!)
    },
    onSuccess: () => {
      setAction(null)
      setNotice('Изменения сохранены.')
      refresh()
    },
  })
  const rows = (inventory.data || []).filter((item) =>
    `${item.code} ${item.item_type} ${item.size || ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  )
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedType) {
      setError('Выберите тип снаряжения.')
      return
    }
    const payload: InventoryCreate = { item_type_code: draft.type }
    if (numberSized(draft.type)) {
      if (!/^\d+$/.test(draft.size) || Number(draft.size) < 20 || Number(draft.size) > 55) {
        setError('Укажите целый EU-размер от 20 до 55.')
        return
      }
      payload.size_value = Number(draft.size)
    } else if (selectedType.size_options.length) {
      if (!selectedType.size_options.some((s) => s.code === draft.bucket)) {
        setError('Выберите размер.')
        return
      }
      payload.size_bucket = draft.bucket
    }
    setError('')
    if (!add.isPending) add.mutate(payload)
  }
  return (
    <>
      <div className="section-heading admin-section-title">
        <div>
          <h2>Инвентарь</h2>
          <p>Снаряжение, размеры и текущее состояние.</p>
        </div>
        <button
          className="button primary"
          disabled={!typesReady}
          onClick={() => {
            setDraft({ type: types[0]?.code || '', size: '', bucket: '' })
            setError('')
            add.reset()
            setAdding(true)
          }}
        >
          <Plus size={18} />
          Добавить снаряжение
        </button>
      </div>
      <ErrorNotice
        error={typesError}
        retry={
          typesError
            ? () => {
                void catalog.refetch()
                typeQueries.forEach((q) => {
                  void q.refetch()
                })
              }
            : undefined
        }
      />
      {notice && <SuccessNotice>{notice}</SuccessNotice>}
      <div className="panel inventory-panel">
        <div className="inventory-filters">
          <label>
            Тип
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Все типы</option>
              {types.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Состояние
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Все состояния</option>
              <option value="available">Доступен</option>
              <option value="rented">Выдан</option>
              <option value="broken">Сломан</option>
            </select>
          </label>
          <label>
            Поиск
            <input
              placeholder="Код, название или размер"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <ErrorNotice
          error={inventory.error}
          retry={() => {
            void inventory.refetch()
          }}
        />
        {inventory.isPending && <Loading />}
        {inventory.isSuccess &&
          (rows.length ? (
            <>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Код</th>
                      <th>Снаряжение</th>
                      <th>Размер</th>
                      <th>Состояние</th>
                      <th>
                        <span className="sr-only">Действия</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <tr key={item.id}>
                        <td className="inventory-code">{item.code}</td>
                        <td>{item.item_type}</td>
                        <td>{item.size || '—'}</td>
                        <td>
                          <Status value={item.status} />
                        </td>
                        <td>
                          <div className="table-actions">
                            {item.status !== 'rented' && (
                              <button
                                className="icon-button"
                                aria-label={
                                  item.status === 'broken'
                                    ? `Вернуть в прокат ${item.code}`
                                    : `Отметить поломку ${item.code}`
                                }
                                title={
                                  item.status === 'broken' ? 'Вернуть в прокат' : 'Отметить поломку'
                                }
                                onClick={() => {
                                  change.reset()
                                  setAction({
                                    kind: 'status',
                                    item,
                                    status: item.status === 'broken' ? 'available' : 'broken',
                                  })
                                }}
                              >
                                {item.status === 'broken' ? (
                                  <Check size={17} />
                                ) : (
                                  <Wrench size={17} />
                                )}
                              </button>
                            )}
                            <button
                              className="icon-button danger-text"
                              disabled={item.status === 'rented'}
                              aria-label={`Удалить ${item.code}`}
                              title={
                                item.status === 'rented' ? 'Сначала примите возврат' : 'Удалить'
                              }
                              onClick={() => {
                                change.reset()
                                setAction({ kind: 'delete', item })
                              }}
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">
                Найдено единиц: {rows.length}
                <span>Выдача и возврат - во вкладке «Бронирования»</span>
              </div>
            </>
          ) : (
            <Empty title="Снаряжение не найдено">
              Измените фильтры или добавьте новую единицу инвентаря.
            </Empty>
          ))}
      </div>
      {adding && (
        <Modal title="Добавить снаряжение" close={() => setAdding(false)} busy={add.isPending}>
          <form onSubmit={submit}>
            <label>
              Тип снаряжения
              <select
                value={draft.type}
                onChange={(e) => {
                  setDraft({ type: e.target.value, size: '', bucket: '' })
                  setError('')
                }}
              >
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            {numberSized(draft.type) ? (
              <label>
                Размер EU
                <input
                  type="number"
                  min="20"
                  max="55"
                  step="1"
                  required
                  value={draft.size}
                  onChange={(e) => setDraft({ ...draft, size: e.target.value })}
                />
              </label>
            ) : selectedType && selectedType.size_options.length > 0 ? (
              <label>
                Размер
                <select
                  required
                  value={draft.bucket}
                  onChange={(e) => setDraft({ ...draft, bucket: e.target.value })}
                >
                  <option value="" disabled>
                    Выберите размер
                  </option>
                  {selectedType.size_options.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="muted">Этот тип снаряжения без размера.</p>
            )}
            <p className="muted">
              Код присвоится автоматически. Новое снаряжение будет доступно для проката.
            </p>
            <ErrorNotice error={error || add.error} />
            <div className="button-row">
              <button
                type="button"
                className="button secondary"
                disabled={add.isPending}
                onClick={() => setAdding(false)}
              >
                Отмена
              </button>
              <button className="button primary" disabled={add.isPending}>
                {add.isPending ? 'Добавляем…' : 'Добавить'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {action && (
        <Modal
          title={
            action.kind === 'delete'
              ? 'Удалить снаряжение?'
              : action.status === 'broken'
                ? 'Отметить поломку?'
                : 'Вернуть в прокат?'
          }
          close={() => setAction(null)}
          busy={change.isPending}
        >
          <p>
            <strong>{action.item.code}</strong> · {action.item.item_type} ·{' '}
            {action.item.size || 'Без размера'}
          </p>
          <p className="muted">
            {action.kind === 'delete'
              ? 'Удаление необратимо. Если снаряжение связано с бронями, сервер не разрешит его удалить.'
              : action.status === 'broken'
                ? 'Снаряжение станет недоступным для новых броней. Уже оформленные брони автоматически не отменяются.'
                : 'Подтвердите, что снаряжение исправно и готово к прокату.'}
          </p>
          <ErrorNotice error={change.error} />
          <div className="button-row">
            <button
              className="button secondary"
              disabled={change.isPending}
              onClick={() => setAction(null)}
            >
              Отмена
            </button>
            <button
              className={`button ${action.kind === 'delete' ? 'danger' : 'primary'}`}
              disabled={change.isPending}
              onClick={() => change.mutate(action)}
            >
              {change.isPending ? 'Сохраняем…' : 'Подтвердить'}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
