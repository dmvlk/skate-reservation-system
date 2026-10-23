import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  ShieldCheck,
} from 'lucide-react'
import { Link, useParams } from 'react-router'
import { api, ApiError } from '../lib/api'
import {
  addDays,
  categories,
  dateLabel,
  hoursLabel,
  isCategory,
  normalizePhone,
  rentalNow,
  validPhone,
} from '../lib/format'
import { EquipmentArt } from '../components/EquipmentArt'
import { ErrorNotice, Loading } from '../components/ui'
import type { BookingCreate, CategoryCode } from '../types'

export function Booking() {
  const { category = '' } = useParams()
  if (!isCategory(category))
    return (
      <div className="container page">
        <h1>Снаряжение не найдено</h1>
        <Link to="/">Вернуться к выбору</Link>
      </div>
    )
  return <BookingFlow key={category} category={category} />
}
function BookingFlow({ category }: { category: CategoryCode }) {
  const cache = useQueryClient()
  const info = categories[category]
  const [step, setStep] = useState(0)
  const [size, setSize] = useState('')
  const [bucket, setBucket] = useState('')
  const [now, setNow] = useState(rentalNow)
  const [date, setDate] = useState(() => addDays(rentalNow().date, rentalNow().hour >= 19 ? 1 : 0))
  const [hours, setHours] = useState<number[]>([])
  const [client, setClient] = useState({
    last_name: '',
    first_name: '',
    middle_name: '',
    phone: '',
  })
  const [formError, setFormError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(rentalNow()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  const types = useQuery({
    queryKey: ['item-types', category],
    queryFn: ({ signal }) => api.itemTypes(category, signal),
  })
  const bucketOptions =
    types.data?.find((t) => t.code === (category === 'skis' ? 'ski' : 'snowboard'))?.size_options ||
    []
  const sizeReady =
    /^\d+$/.test(size) &&
    Number(size) >= 20 &&
    Number(size) <= 55 &&
    (category === 'skates' || bucketOptions.some((option) => option.code === bucket))
  const sizes =
    category === 'skates'
      ? { size_value: Number(size) }
      : { size_bucket: bucket, boot_size_value: Number(size) }
  const availability = useQuery({
    queryKey: ['availability', category, size, bucket, now.date],
    queryFn: ({ signal }) =>
      api.availability({ category, ...sizes, start_date: now.date, days: 7 }, signal),
    enabled: step > 0 && sizeReady,
    staleTime: 0,
    refetchInterval: 30000,
  })
  const availableHours = availability.data?.days.find((d) => d.date === date)?.available_hours || []
  const selectable = (hour: number) =>
    date >= now.date && (date !== now.date || hour > now.hour) && availableHours.includes(hour)
  const validHours = hours.length > 0 && hours.every(selectable) && !availability.isError
  const booking = useMutation({
    mutationFn: (payload: BookingCreate) => api.book(payload),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['availability'] })
      void cache.invalidateQueries({ queryKey: ['my-bookings'] })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setHours([])
        setStep(1)
        void availability.refetch()
      }
      if (error instanceof ApiError && (error.status === 0 || error.status >= 500))
        setUncertain(true)
    },
  })
  const resetSelection = () => {
    setHours([])
    booking.reset()
    setUncertain(false)
    setFormError('')
  }
  const goStep = (next: number) => {
    setStep(next)
    setFormError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (booking.isPending) return
    if (!client.last_name.trim() || !client.first_name.trim() || !validPhone(client.phone)) {
      setFormError('Укажите фамилию, имя и телефон (от 10 до 15 цифр).')
      return
    }
    if (!validHours) {
      setFormError('Выбранное время уже недоступно. Пожалуйста, выберите часы заново.')
      setStep(1)
      return
    }
    setFormError('')
    booking.mutate({
      category,
      ...sizes,
      ...client,
      last_name: client.last_name.trim(),
      first_name: client.first_name.trim(),
      middle_name: client.middle_name.trim() || null,
      phone: normalizePhone(client.phone),
      booking_date: date,
      hours: [...hours].sort((a, b) => a - b),
    })
  }
  if (booking.isSuccess)
    return (
      <div className="container page success-page">
        <div className="success-icon">
          <CheckCircle2 size={42} strokeWidth={1.5} />
        </div>
        <div className="eyebrow">ВСТРЕТИМСЯ НА ПРОКАТЕ</div>
        <h1>Всё готово к вашему дню</h1>
        <p className="lead">Бронь оформлена. Сохраните её номер и назовите при получении.</p>
        <div className="ticket">
          <div className="ticket-top">
            <span>ВАША БРОНЬ</span>
            <strong>№ {booking.data.id}</strong>
            <span className="status status-active">
              <span />
              Забронировано
            </span>
          </div>
          <h2>{info.name}</h2>
          <p>
            {category === 'skates' ? `Размер ${size} EU` : `Размер ${bucket} · ботинки ${size} EU`}
          </p>
          <div className="ticket-details">
            <span>
              <CalendarDays size={18} />
              {dateLabel(booking.data.booking_date)}
            </span>
            <span>
              <Clock3 size={18} />
              {hoursLabel(booking.data.hours)}
            </span>
          </div>
          <div className="ticket-foot">Телефон заканчивается на {booking.data.phone_last4}</div>
        </div>
        <div className="button-row">
          <Link
            to="/my-bookings"
            state={{ phone: normalizePhone(client.phone) }}
            className="button primary"
          >
            Мои брони <ArrowRight size={17} />
          </Link>
          <Link to="/" className="button secondary">
            На главную
          </Link>
        </div>
      </div>
    )
  return (
    <div className="container page booking-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} />К снаряжению
      </Link>
      <div className="page-heading">
        <div className="eyebrow">ВАШЕ МАЛЕНЬКОЕ ПРИКЛЮЧЕНИЕ</div>
        <h1>
          Забронировать{' '}
          {category === 'skates' ? 'коньки' : category === 'skis' ? 'лыжи' : 'сноуборд'}
        </h1>
        <p>Подберите размер и время — остальное подождёт вас в прокате.</p>
      </div>
      <ol className="steps">
        {['Размер', 'Дата и время', 'Ваши данные'].map((label, index) => (
          <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''}>
            <button
              disabled={index >= step || booking.isPending}
              onClick={() => goStep(index)}
              aria-current={index === step ? 'step' : undefined}
            >
              <span>{index < step ? <Check size={16} /> : index + 1}</span>
              {label}
            </button>
          </li>
        ))}
      </ol>
      <div className="booking-layout">
        <section className="panel booking-form">
          <ErrorNotice error={booking.error} />
          <ErrorNotice error={formError} />
          {step === 0 && (
            <>
              <div className="form-heading">
                <span className="eyebrow"></span>
                <h2>Всё начинается с размера</h2>
                <p>
                  {category === 'skates'
                    ? 'Выберите привычный размер обуви.'
                    : 'Выберите размер снаряжения и ботинок.'}
                </p>
              </div>
              {types.isPending && <Loading />}
              <ErrorNotice
                error={types.error}
                retry={() => {
                  void types.refetch()
                }}
              />
              {category !== 'skates' && (
                <fieldset>
                  <legend>Размер {category === 'skis' ? 'лыж' : 'сноуборда'}</legend>
                  <div className="size-options">
                    {bucketOptions.map((option) => (
                      <button
                        type="button"
                        key={option.id}
                        aria-pressed={bucket === option.code}
                        className={`choice ${bucket === option.code ? 'selected' : ''}`}
                        onClick={() => {
                          setBucket(option.code)
                          resetSelection()
                        }}
                      >
                        {option.code}
                      </button>
                    ))}
                  </div>
                  {types.isSuccess && bucketOptions.length === 0 && (
                    <p className="muted">Размеры пока не добавлены. Попробуйте другую категорию.</p>
                  )}
                </fieldset>
              )}
              <fieldset>
                <legend>
                  {category === 'skates' ? 'Размер коньков' : 'Размер ботинок'} <span>EU</span>
                </legend>
                <div className="size-options">
                  {Array.from({ length: 11 }, (_, i) => i + 36).map((n) => (
                    <button
                      type="button"
                      key={n}
                      aria-pressed={size === String(n)}
                      className={`choice ${size === String(n) ? 'selected' : ''}`}
                      onClick={() => {
                        setSize(String(n))
                        resetSelection()
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <label className="custom-size">
                  Другой размер EU
                  <input
                    type="number"
                    min="20"
                    max="55"
                    step="1"
                    placeholder="Например, 35"
                    value={size && (Number(size) < 36 || Number(size) > 46) ? size : ''}
                    onChange={(event) => {
                      setSize(event.target.value)
                      resetSelection()
                    }}
                  />
                </label>
              </fieldset>
              <div className="notice neutral">
                <Info size={18} />
                <span>Наличие вашего размера проверим на следующем шаге.</span>
              </div>
              <div className="form-actions">
                <span>Подбор займёт всего пару минут</span>
                <button
                  className="button primary"
                  disabled={!sizeReady || !types.isSuccess}
                  onClick={() => goStep(1)}
                >
                  Выбрать время <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <div className="form-heading">
                <span className="eyebrow"></span>
                <h2>Когда отправимся кататься?</h2>
                <p>Выберите день и один или несколько часовых интервалов.</p>
              </div>
              <fieldset>
                <legend>Дата проката</legend>
                <div className="date-options">
                  {Array.from({ length: 7 }, (_, i) => addDays(now.date, i)).map((day) => (
                    <button
                      className={`date-choice ${day === date ? 'selected' : ''}`}
                      aria-pressed={date === day}
                      key={day}
                      onClick={() => {
                        setDate(day)
                        setHours([])
                        booking.reset()
                      }}
                    >
                      <span>
                        {day === now.date
                          ? 'Сегодня'
                          : new Intl.DateTimeFormat('ru', {
                              weekday: 'short',
                              timeZone: 'UTC',
                            }).format(new Date(`${day}T12:00:00Z`))}
                      </span>
                      <strong>{Number(day.slice(-2))}</strong>
                      <small>
                        {new Intl.DateTimeFormat('ru', { month: 'short', timeZone: 'UTC' }).format(
                          new Date(`${day}T12:00:00Z`),
                        )}
                      </small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  Время <span>Каждый интервал — 1 час</span>
                </legend>
                {availability.isPending ? (
                  <Loading text="Проверяем свободное время…" />
                ) : (
                  <>
                    <ErrorNotice
                      error={availability.error}
                      retry={() => {
                        void availability.refetch()
                      }}
                    />
                    <div className="hour-options">
                      {Array.from({ length: 10 }, (_, i) => i + 10).map((hour) => (
                        <button
                          key={hour}
                          disabled={!selectable(hour) || availability.isError}
                          aria-pressed={hours.includes(hour)}
                          className={`choice hour ${hours.includes(hour) ? 'selected' : ''}`}
                          onClick={() => {
                            setHours((old) =>
                              old.includes(hour) ? old.filter((h) => h !== hour) : [...old, hour],
                            )
                            booking.reset()
                            setFormError('')
                          }}
                        >
                          {hour}:00–{hour + 1}:00
                        </button>
                      ))}
                    </div>
                    {!availability.isError &&
                      !Array.from({ length: 10 }, (_, i) => i + 10).some(selectable) && (
                        <p className="notice neutral">
                          На этот день свободных часов нет. Выберите другую дату или размер.
                        </p>
                      )}
                  </>
                )}
              </fieldset>
              <div className="slot-legend">
                <span>
                  <i />
                  Свободно
                </span>
                <span>
                  <i />
                  Выбрано
                </span>
                <span>
                  <i />
                  Недоступно
                </span>
              </div>
              {hours.length > 0 && !validHours && (
                <div className="notice error" role="alert">
                  Доступность изменилась. Выберите свободные часы заново.
                </div>
              )}
              <div className="form-actions">
                <button className="text-button" onClick={() => goStep(0)}>
                  <ArrowLeft size={16} />
                  Назад
                </button>
                <button className="button primary" disabled={!validHours} onClick={() => goStep(2)}>
                  Продолжить <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {step === 2 && (
            <form onSubmit={submit}>
              <div className="form-heading">
                <span className="eyebrow"></span>
                <h2>На кого оформим бронь?</h2>
                <p>Эти данные понадобятся, чтобы найти вашу бронь при выдаче.</p>
              </div>
              <div className="field-grid">
                <label>
                  Фамилия
                  <input
                    autoComplete="family-name"
                    maxLength={100}
                    required
                    value={client.last_name}
                    onChange={(e) => setClient({ ...client, last_name: e.target.value })}
                    placeholder="Иванов"
                  />
                </label>
                <label>
                  Имя
                  <input
                    autoComplete="given-name"
                    maxLength={100}
                    required
                    value={client.first_name}
                    onChange={(e) => setClient({ ...client, first_name: e.target.value })}
                    placeholder="Алексей"
                  />
                </label>
                <label className="full-width">
                  Отчество <span className="optional">необязательно</span>
                  <input
                    autoComplete="additional-name"
                    maxLength={100}
                    value={client.middle_name}
                    onChange={(e) => setClient({ ...client, middle_name: e.target.value })}
                    placeholder="Иванович"
                  />
                </label>
                <label className="full-width">
                  Номер телефона
                  <input
                    type="tel"
                    aria-label="Номер телефона"
                    aria-describedby="phone-help"
                    autoComplete="tel"
                    required
                    maxLength={25}
                    value={client.phone}
                    onChange={(e) => setClient({ ...client, phone: e.target.value })}
                    placeholder="+7 (999) 123-45-67"
                  />
                  <small id="phone-help">По этому номеру можно найти и отменить бронь.</small>
                </label>
              </div>
              <div className="notice neutral">
                <ShieldCheck size={19} />
                <span>
                  Регистрация не нужна. На один телефон можно оформить до 4 активных броней.
                </span>
              </div>
              {uncertain && (
                <div className="notice neutral">
                  <Info size={19} />
                  <div>
                    Не удалось получить подтверждение. Перед повторной отправкой проверьте,
                    появилась ли бронь.
                    <Link
                      className="text-link"
                      to="/my-bookings"
                      state={{ phone: normalizePhone(client.phone) }}
                    >
                      Проверить мои брони <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              )}
              <div className="form-actions">
                <button
                  type="button"
                  disabled={booking.isPending}
                  className="text-button"
                  onClick={() => goStep(1)}
                >
                  <ArrowLeft size={16} />
                  Назад
                </button>
                <button className="button primary" disabled={booking.isPending || !validHours}>
                  {booking.isPending ? 'Оформляем…' : 'Подтвердить бронь'}
                  <Check size={17} />
                </button>
              </div>
              {!validHours && (
                <p className="muted">
                  Вернитесь на шаг «Дата и время», чтобы проверить доступность.
                </p>
              )}
            </form>
          )}
        </section>
        <aside className="booking-summary">
          <div className="summary-art">
            <EquipmentArt kind={category} />
          </div>
          <div className="summary-body">
            <div className="eyebrow">ВАШ ВЫБОР</div>
            <h2>{info.name}</h2>
            <p>
              {category === 'skates'
                ? 'Пара коньков'
                : category === 'skis'
                  ? 'Лыжи + лыжные ботинки'
                  : 'Сноуборд + ботинки'}
            </p>
            <dl>
              <div>
                <dt>Размер</dt>
                <dd>
                  {category === 'skates'
                    ? size
                      ? `${size} EU`
                      : 'Не выбран'
                    : bucket || 'Не выбран'}
                </dd>
              </div>
              {category !== 'skates' && (
                <div>
                  <dt>Ботинки</dt>
                  <dd>{size ? `${size} EU` : 'Не выбраны'}</dd>
                </div>
              )}
              <div>
                <dt>Дата</dt>
                <dd>{step > 0 ? dateLabel(date) : 'Не выбрана'}</dd>
              </div>
              <div>
                <dt>Время</dt>
                <dd>{hours.length ? hoursLabel(hours) : 'Не выбрано'}</dd>
              </div>
            </dl>
            <div className="summary-note">
              <Clock3 size={16} />
              Прокат работает с 10:00 до 20:00
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
