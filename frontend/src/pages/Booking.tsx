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
import { QRCodeSVG } from 'qrcode.react'
import { EquipmentArt } from '../components/EquipmentArt'
import { ErrorNotice, Loading, Modal } from '../components/ui'
import { SizeTable } from '../components/SizeGuide'
import type { BookingCreate, CategoryCode, SelectedItem } from '../types'

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
  const [selections, setSelections] = useState<Record<string, string>>({})
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
  const [showSizes, setShowSizes] = useState(false)
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const isReady = types.data?.every((t) => {
    if (t.code === 'goggles') return true
    return !t.is_required || !!selections[t.code]
  }) ?? false
  const availabilityParams = (() => {
    const params: Record<string, string | number | undefined> = { category }
    
    if (category === 'skates') {
      params.size_value = selections['skate'] ? Number(selections['skate']) : undefined
    } else {
      const boardCode = category === 'skis' ? 'ski' : 'snowboard'
      const bootCode = category === 'skis' ? 'ski_boot' : 'snowboard_boot'
      params.size_bucket = selections[boardCode]
      params.boot_size_value = selections[bootCode] ? Number(selections[bootCode]) : undefined
    }
    return params
  })()

  // Доступные часы (учитываем только базовые размеры, т.к. бэк проверяет комплект при создании)
  const isBaseReady = category === 'skates' 
    ? !!selections['skate'] 
    : !!selections['ski'] || !!selections['snowboard']

  const availability = useQuery({
    queryKey: ['availability', category, JSON.stringify(availabilityParams), now.date],
    queryFn: ({ signal }) => api.availability({ ...availabilityParams, start_date: now.date, days: 7 }, signal),
    enabled: step > 0 && isBaseReady,
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
  const setSelection = (code: string, size: string) => {
    setSelections(prev => {
      const next = { ...prev }
      if (next[code] === size) {
        delete next[code]
      } else {
        next[code] = size
      }
      return next
    })
    resetSelection()
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

    // Собираем selected_items
    const selected_items: SelectedItem[] = []
    const baseTypes = ['skate', 'ski', 'snowboard', 'ski_boot', 'snowboard_boot']
    
    if (types.data) {
      types.data.forEach(t => {
        const size = selections[t.code]
        if (!size) return
        if (baseTypes.includes(t.code)) return // базовые уходят в size_value/bucket

        const isNumeric = ['skate', 'ski_boot', 'snowboard_boot'].includes(t.code)
        const isOneSize = size === 'one-size'

        selected_items.push({
          item_type_code: t.code,
          size_value: isNumeric ? Number(size) : undefined,
          size_bucket: (!isNumeric && !isOneSize) ? size : undefined,
        })
      })
    }

    const payload: BookingCreate = {
      category,
      ...client,
      last_name: client.last_name.trim(),
      first_name: client.first_name.trim(),
      middle_name: client.middle_name.trim() || null,
      phone: normalizePhone(client.phone),
      booking_date: date,
      hours: [...hours].sort((a, b) => a - b),
      selected_items,
    }

    if (category === 'skates') {
      payload.size_value = Number(selections['skate'])
    } else {
      payload.size_bucket = selections[category === 'skis' ? 'ski' : 'snowboard']
      payload.boot_size_value = Number(selections[category === 'skis' ? 'ski_boot' : 'snowboard_boot'])
    }

    booking.mutate(payload)
  }

  if (booking.isSuccess) {
    return (
      <div className="container page success-page">
        <div className="success-icon">
          <CheckCircle2 size={42} strokeWidth={1.5} />
        </div>
        <div className="eyebrow">ВСТРЕТИМСЯ НА ПРОКАТЕ</div>
        <h1>Всё готово к вашему дню</h1>
        <p className="lead">Бронь оформлена. Сохраните ее номер и назовите при получении.</p>
        <div className="ticket">
          <div className="ticket-top">
            <span className="eyebrow">ВАША БРОНЬ № {booking.data.id}</span>
            <span className="status status-active" style={{ marginLeft: 'auto' }}>
              <span />
              Забронировано
            </span>
          </div>
          <h2>{info.name}</h2>
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
          <div style={{ display: 'flex', justifyContent: 'center', margin: '24px 0' }}>
            <QRCodeSVG 
              value={String(booking.data.id)} 
              size={140} 
              bgColor={"#ffffff"}
              fgColor={"#1e3a5f"}
              level={"H"}
            />
          </div>
        </div>
        <div className="button-row">
          <Link to="/my-bookings" state={{ phone: normalizePhone(client.phone) }} className="button primary">
            Мои брони <ArrowRight size={17} />
          </Link>
          <Link to="/" className="button secondary">На главную</Link>
        </div>
      </div>
    )
  }
  return (
    <div className="container page booking-page">
      <Link to="/" className="back-link"><ArrowLeft size={16} />К снаряжению</Link>
      
      <div className="page-heading">
        <div className="eyebrow">ВАШЕ МАЛЕНЬКОЕ ПРИКЛЮЧЕНИЕ</div>
        <h1>Забронировать {category === 'skates' ? 'коньки' : category === 'skis' ? 'лыжи' : 'сноуборд'}</h1>
        <p>Соберите комплект - остальное подождет вас в прокате.</p>
      </div>
      <ol className="steps">
        {['Снаряжение', 'Дата и время', 'Ваши данные'].map((label, index) => (
          <li key={label} className={index === step ? 'current' : index < step ? 'done' : ''}>
            <button disabled={index >= step || booking.isPending} onClick={() => goStep(index)} aria-current={index === step ? 'step' : undefined}>
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
              <div className="form-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
                <div>
                  <h2>Выберите размеры</h2>
                </div>
                <div className="segmented" style={{ marginTop: '4px' }}>
                  <button 
                    type="button" 
                    className={gender === 'male' ? 'selected' : ''} 
                    onClick={() => setGender('male')}
                  >
                    Мужской
                  </button>
                  <button 
                    type="button" 
                    className={gender === 'female' ? 'selected' : ''} 
                    onClick={() => setGender('female')}
                  >
                    Женский
                  </button>
                </div>
              </div>
              {types.isPending && <Loading />}
              <ErrorNotice error={types.error} retry={() => void types.refetch()} />

              <div className="equipment-selection">
                {types.data?.filter((t) => t.code !== 'goggles').map((type) => {
                  const isNumeric = ['skate', 'ski_boot', 'snowboard_boot'].includes(type.code)
                  const hasNoSize = type.size_options.length === 0 && !isNumeric
                  
                  return (
                    <div key={type.code} className="equipment-row">
                      <div className="equipment-label">
                        {type.name}
                      </div>
                      
                      <div className="size-options">
                        {hasNoSize ? (
                          <button
                            type="button"
                            className={`choice ${selections[type.code] ? 'selected' : ''}`}
                            onClick={() => setSelection(type.code, 'one-size')}
                          >
                            {selections[type.code] ? 'Добавлено' : 'Добавить'}
                          </button>
                        ) : isNumeric ? (
                          Array.from({ length: 11 }, (_, i) => i + 36).map(n => (
                            <button
                              type="button"
                              key={n}
                              className={`choice ${selections[type.code] === String(n) ? 'selected' : ''}`}
                              onClick={() => setSelection(type.code, String(n))}
                            >
                              {n}
                            </button>
                          ))
                        ) : (
                          type.size_options.map(opt => (
                            <button
                              type="button"
                              key={opt.id}
                              className={`choice ${selections[type.code] === opt.code ? 'selected' : ''}`}
                              onClick={() => setSelection(type.code, opt.code)}
                            >
                              {opt.code}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setShowSizes(true)}
                  style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'underline' }}
                >
                  Таблица размеров
                </button>
                <button className="button primary" disabled={!isReady || !types.isSuccess} onClick={() => goStep(1)}>
                  Выбрать время <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <div className="form-heading">
                <h2>Когда отправимся кататься?</h2>
              </div>
              <fieldset>
                <legend>Дата проката</legend>
                <div className="date-options">
                  {Array.from({ length: 7 }, (_, i) => addDays(now.date, i)).map((day) => (
                    <button
                      className={`date-choice ${day === date ? 'selected' : ''}`}
                      aria-pressed={date === day}
                      key={day}
                      onClick={() => { setDate(day); setHours([]); booking.reset(); }}
                    >
                      <span>{day === now.date ? 'Сегодня' : new Intl.DateTimeFormat('ru', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))}</span>
                      <strong>{Number(day.slice(-2))}</strong>
                      <small>{new Intl.DateTimeFormat('ru', { month: 'short', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>Время</legend>
                {availability.isPending ? (
                  <Loading text="Проверяем свободное время…" />
                ) : (
                  <>
                    <ErrorNotice error={availability.error} retry={() => void availability.refetch()} />
                    <div className="hour-options">
                      {Array.from({ length: 10 }, (_, i) => i + 10).map((hour) => (
                        <button
                          key={hour}
                          disabled={!selectable(hour) || availability.isError}
                          aria-pressed={hours.includes(hour)}
                          className={`choice hour ${hours.includes(hour) ? 'selected' : ''}`}
                          onClick={() => {
                            setHours(old => old.includes(hour) ? old.filter(h => h !== hour) : [...old, hour])
                            booking.reset()
                            setFormError('')
                          }}
                        >
                          {hour}:00–{hour + 1}:00
                        </button>
                      ))}
                    </div>
                    {!availability.isError && !Array.from({ length: 10 }, (_, i) => i + 10).some(selectable) && (
                      <p className="notice neutral">На этот день свободных часов нет. Выберите другую дату.</p>
                    )}
                  </>
                )}
              </fieldset>
              <div className="form-actions">
                <button className="text-button" onClick={() => goStep(0)}><ArrowLeft size={16} />Назад</button>
                <button className="button primary" disabled={!validHours} onClick={() => goStep(2)}>Продолжить <ArrowRight size={17} /></button>
              </div>
            </>
          )}

          {step === 2 && (
            <form onSubmit={submit}>
              <div className="form-heading">
                <h2>На кого оформим бронь?</h2>
              </div>
              <div className="field-grid">
                <label>Фамилия<input autoComplete="family-name" maxLength={100} required value={client.last_name} onChange={(e) => setClient({ ...client, last_name: e.target.value })} placeholder="Иванов" /></label>
                <label>Имя<input autoComplete="given-name" maxLength={100} required value={client.first_name} onChange={(e) => setClient({ ...client, first_name: e.target.value })} placeholder="Алексей" /></label>
                <label className="full-width">Отчество <span className="optional">необязательно</span><input autoComplete="additional-name" maxLength={100} value={client.middle_name} onChange={(e) => setClient({ ...client, middle_name: e.target.value })} placeholder="Иванович" /></label>
                <label className="full-width">Номер телефона<input type="tel" autoComplete="tel" required maxLength={25} value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} placeholder="+7 (999) 123-45-67" /></label>              </div>
              {uncertain && (
                <div className="notice neutral">
                  <Info size={19} />
                  <div>Не удалось получить подтверждение. Проверьте, появилась ли бронь.<Link className="text-link" to="/my-bookings" state={{ phone: normalizePhone(client.phone) }}>Проверить мои брони <ArrowRight size={15} /></Link></div>
                </div>
              )}
              <div className="form-actions">
                <button type="button" disabled={booking.isPending} className="text-button" onClick={() => goStep(1)}><ArrowLeft size={16} />Назад</button>
                <button className="button primary" disabled={booking.isPending || !validHours}>{booking.isPending ? 'Оформляем…' : 'Подтвердить бронь'} <Check size={17} /></button>
              </div>
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
            <dl>
              {types.data?.filter(t => selections[t.code]).map(t => (
                <div key={t.code}>
                  <dt>{t.name}</dt>
                  <dd>{selections[t.code] === 'one-size' ? '✓' : selections[t.code]}</dd>
                </div>
              ))}
              <div>
                <dt>Дата</dt>
                <dd>{step > 0 ? dateLabel(date) : 'Не выбрана'}</dd>
              </div>
              <div>
                <dt>Время</dt>
                <dd>{hours.length ? hoursLabel(hours) : 'Не выбрано'}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
      {showSizes && (
        <Modal title="Таблица размеров" close={() => setShowSizes(false)}>
          <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
            {types.data?.map(t => {
              if (['skate', 'ski_boot', 'snowboard_boot', 'ski', 'snowboard', 'helmet', 'gloves', 'jacket', 'pants'].includes(t.code)) {
                return <SizeTable key={t.code} typeCode={t.code} gender={gender} />
              }
              return null
            })}
          </div>
          <div className="button-row">
            <button className="button secondary" onClick={() => setShowSizes(false)}>Закрыть</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
