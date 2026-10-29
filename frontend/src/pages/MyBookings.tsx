import { useState } from 'react'
import { useLocation } from 'react-router'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Clock3, Search, Timer } from 'lucide-react'
import { api } from '../lib/api'
import { categoryName, dateLabel, hoursLabel, normalizePhone, validPhone } from '../lib/format'
import { QRCodeSVG } from 'qrcode.react'
import { Empty, ErrorNotice, Loading, Modal, SuccessNotice } from '../components/ui'
import type { MyBooking } from '../types'

export function MyBookings() {
  const location = useLocation()
  const initial = typeof location.state?.phone === 'string' ? (location.state.phone as string) : ''
  const [input, setInput] = useState(initial)
  const [phone, setPhone] = useState(initial)
  const [error, setError] = useState('')
  const [selectedCancel, setSelectedCancel] = useState<MyBooking | null>(null)
  const [selectedExtend, setSelectedExtend] = useState<{
    booking: MyBooking
    maxHours: number
  } | null>(null)
  const [extendSlider, setExtendSlider] = useState(1)
  const [notice, setNotice] = useState('')
  const cache = useQueryClient()
  const [zoomQr, setZoomQr] = useState<number | null>(null)

  const bookings = useQuery({
    queryKey: ['my-bookings', phone],
    queryFn: ({ signal }) => api.myBookings(phone, signal),
    enabled: !!phone,
    gcTime: 0,
  })

  const activeBookings = bookings.data?.filter((b) => b.status === 'active') || []
  const extensionQueries = useQueries({
    queries: activeBookings.map((b) => ({
      queryKey: ['extension-options', b.id, phone],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        api.extensionOptions(b.id, phone, signal),
      enabled: !!phone,
      staleTime: 0,
    })),
  })

  const cancel = useMutation({
    mutationFn: (id: number) => api.cancel(id, phone),
    onSuccess: () => {
      setSelectedCancel(null)
      setNotice('Бронь отменена. Вы можете выбрать другое время.')
      void cache.invalidateQueries({ queryKey: ['my-bookings', phone] })
      void cache.invalidateQueries({ queryKey: ['extension-options'] })
      void cache.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  const extend = useMutation({
    mutationFn: ({ id, hours }: { id: number; hours: number[] }) =>
      api.extend(id, phone, hours),
    onSuccess: (result) => {
      setSelectedExtend(null)
      setNotice(result.message)
      void cache.invalidateQueries({ queryKey: ['my-bookings', phone] })
      void cache.invalidateQueries({ queryKey: ['extension-options'] })
      void cache.invalidateQueries({ queryKey: ['availability'] })
    },
  })

  function search(event: React.FormEvent) {
    event.preventDefault()
    if (!validPhone(input)) {
      setError('Введите телефон: от 10 до 15 цифр.')
      return
    }
    setError('')
    setNotice('')
    const next = normalizePhone(input)
    if (next === phone) void bookings.refetch()
    else setPhone(next)
  }

  function openExtend(booking: MyBooking) {
    const idx = activeBookings.findIndex((b) => b.id === booking.id)
    const options = extensionQueries[idx]?.data
    if (!options || options.available_extension_hours.length === 0) return
    extend.reset()
    setExtendSlider(1)
    setSelectedExtend({
      booking,
      maxHours: options.available_extension_hours.length,
    })
  }

  function confirmExtend() {
    if (!selectedExtend) return
    const idx = activeBookings.findIndex((b) => b.id === selectedExtend.booking.id)
    const options = extensionQueries[idx]?.data
    if (!options) return

    const hours = options.available_extension_hours.slice(0, extendSlider)
    extend.mutate({ id: selectedExtend.booking.id, hours })
  }

  return (
    <div className="container page my-bookings-page">
      <div className="page-heading">
        <div className="eyebrow">ВАШИ ПЛАНЫ НА ЗИМУ</div>
        <h1>Мои брони</h1>
        <p>Все снаряжение и время - в одном месте.</p>
      </div>
      <form className="panel lookup-form" onSubmit={search}>
        <label>
          Телефон, указанный при бронировании
          <div className="input-with-icon">
            <Search size={19} />
            <input
              type="tel"
              autoComplete="tel"
              placeholder="+7 (999) 123-45-67"
              required
              maxLength={25}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>
        </label>
        <button className="button primary" disabled={bookings.isFetching}>
          Найти брони <ArrowRight size={18} />
        </button>
      </form>
      <ErrorNotice
        error={error || bookings.error}
        retry={
          bookings.error
            ? () => {
                void bookings.refetch()
              }
            : undefined
        }
      />
      {notice && <SuccessNotice>{notice}</SuccessNotice>}
      {!phone && (
        <Empty title="Найдем ваши зимние планы">
          Укажите номер телефона, который использовали при оформлении.
        </Empty>
      )}
      {phone && bookings.isPending && <Loading text="Ищем ваши брони…" />}
      {bookings.isSuccess && bookings.data.length === 0 && (
        <Empty title="Броней пока нет">
          Проверьте номер телефона или выберите снаряжение на главной странице.
        </Empty>
      )}
      <div className="booking-list">
        {bookings.data?.map((booking) => {
          const idx = activeBookings.findIndex((b) => b.id === booking.id)
          const extQuery = idx >= 0 ? extensionQueries[idx] : null
          const extOptions = extQuery?.data
          const canExtend =
            booking.status === 'active' &&
            !!extOptions &&
            extOptions.available_extension_hours.length > 0

          return (
            <article className="panel reservation-card" key={booking.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <div className="reservation-top">
                  <span className="eyebrow">БРОНЬ № {booking.id}</span>
                </div>
                <h2>{categoryName(booking.category)}</h2>
                <div className="reservation-meta" style={{ flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                  <span>
                    <CalendarDays size={17} />
                    {dateLabel(booking.booking_date)}
                  </span>
                  <span>
                    <Clock3 size={17} />
                    {hoursLabel(booking.hours)}
                  </span>
                </div>
                <div className="item-tags" style={{ marginTop: '16px' }}>
                  {booking.items.map((item, i) => (
                    <span key={i}>
                      {item.item_type}
                      {item.size ? ` · ${item.size}` : ''}
                    </span>
                  ))}
                </div>
              </div>
              <div 
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0 }}
                onClick={() => setZoomQr(booking.id)}
                title="Увеличить QR-код"
              >
                <QRCodeSVG 
                  value={String(booking.id)} 
                  size={80} 
                  bgColor={"#ffffff"}
                  fgColor={"#1e3a5f"}
                  level={"M"}
                />
                <span style={{ fontSize: '10px', color: '#8a9aaa' }}></span>
              </div>
            </div>
            <div className="reservation-bottom" style={{ justifyContent: 'flex-end', paddingTop: '16px', marginTop: '16px' }}>
              <div className="reservation-actions">
                {booking.status === 'active' && (
                  <>
                    <button
                      className="text-button"
                      disabled={!canExtend || extQuery?.isPending}
                      title={
                        !extOptions
                          ? 'Проверяем возможность продления…'
                          : extOptions.available_extension_hours.length === 0
                            ? 'Продление недоступно: следующие часы заняты'
                            : undefined
                      }
                      onClick={() => openExtend(booking)}
                    >
                      <Timer size={15} />
                      {extQuery?.isPending ? 'Проверяем…' : 'Продлить'}
                    </button>
                    <button
                      className="text-button danger-text"
                      onClick={() => {
                        cancel.reset()
                        setSelectedCancel(booking)
                      }}
                    >
                      Отменить бронь
                    </button>
                  </>
                )}
              </div>
            </div>
            </article>
          )
        })}
      </div>

      {selectedCancel && (
        <Modal
          title={`Отменить бронь № ${selectedCancel.id}?`}
          close={() => setSelectedCancel(null)}
          busy={cancel.isPending}
        >
          <p>
            {categoryName(selectedCancel.category)} · {dateLabel(selectedCancel.booking_date)} ·{' '}
            {hoursLabel(selectedCancel.hours)}
          </p>
          <p className="muted">Выбранное время освободится. Это действие нельзя отменить.</p>
          <ErrorNotice error={cancel.error} />
          <div className="button-row">
            <button
              className="button secondary"
              disabled={cancel.isPending}
              onClick={() => setSelectedCancel(null)}
            >
              Оставить бронь
            </button>
            <button
              className="button danger"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(selectedCancel.id)}
            >
              {cancel.isPending ? 'Отменяем…' : 'Да, отменить'}
            </button>
          </div>
        </Modal>
      )}

      {selectedExtend && (
        <Modal
          title={`Продлить бронь № ${selectedExtend.booking.id}?`}
          close={() => setSelectedExtend(null)}
          busy={extend.isPending}
        >
          {(() => {
            const idx = activeBookings.findIndex((b) => b.id === selectedExtend.booking.id)
            const opts = extensionQueries[idx]?.data
            if (!opts || opts.available_extension_hours.length === 0) return null

            const lastHour = Math.max(...selectedExtend.booking.hours)
            const newEnd = lastHour + 1 + extendSlider
            const totalNewHours = extendSlider

            return (
              <>
                <p>
                  {categoryName(selectedExtend.booking.category)} ·{' '}
                  {dateLabel(selectedExtend.booking.booking_date)}
                </p>
                <p className="muted">
                  Сейчас: {hoursLabel(selectedExtend.booking.hours)}
                </p>
                <label>
                  Продлить на:{' '}
                  <strong>
                    {totalNewHours}{' '}
                    {totalNewHours === 1 ? 'час' : totalNewHours < 5 ? 'часа' : 'часов'}
                  </strong>{' '}
                  (до {newEnd}:00)
                  <input
                    type="range"
                    min="1"
                    max={selectedExtend.maxHours}
                    value={extendSlider}
                    onChange={(e) => setExtendSlider(Number(e.target.value))}
                    style={{ width: '100%', marginTop: 12 }}
                  />
                  <div className="range-labels">
                    <span>
                      +1 час (до {lastHour + 2}:00)
                    </span>
                    {selectedExtend.maxHours > 1 && (
                      <span>
                        +{selectedExtend.maxHours}{' '}
                        {selectedExtend.maxHours === 1
                          ? 'час'
                          : selectedExtend.maxHours < 5
                            ? 'часа'
                            : 'часов'}{' '}
                        (до {lastHour + 1 + selectedExtend.maxHours}:00)
                      </span>
                    )}
                  </div>
                </label>
                <ErrorNotice error={extend.error} />
                <div className="button-row">
                  <button
                    className="button secondary"
                    disabled={extend.isPending}
                    onClick={() => setSelectedExtend(null)}
                  >
                    Отмена
                  </button>
                  <button
                    className="button primary"
                    disabled={extend.isPending}
                    onClick={confirmExtend}
                  >
                    {extend.isPending ? 'Продлеваем…' : 'Продлить'}
                  </button>
                </div>
              </>
            )
          })()}
        </Modal>
      )}
      {zoomQr !== null && (
        <Modal
          title=""
          close={() => setZoomQr(null)}
        >
          <div style={{ display: 'flex', justifyContent: 'center', padding: '10px' }}>
            <QRCodeSVG 
              value={String(zoomQr)} 
              size={260} 
              bgColor={"#ffffff"}
              fgColor={"#1e3a5f"}
              level={"H"}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
