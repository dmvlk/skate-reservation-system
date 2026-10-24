import { useState } from 'react'
import { useLocation } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CalendarDays, Clock3, Search } from 'lucide-react'
import { api } from '../lib/api'
import { categoryName, dateLabel, hoursLabel, normalizePhone, validPhone } from '../lib/format'
import { Empty, ErrorNotice, Loading, Modal, Status, SuccessNotice } from '../components/ui'
import type { MyBooking } from '../types'

export function MyBookings() {
  const location = useLocation()
  const initial = typeof location.state?.phone === 'string' ? (location.state.phone as string) : ''
  const [input, setInput] = useState(initial)
  const [phone, setPhone] = useState(initial)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<MyBooking | null>(null)
  const [notice, setNotice] = useState('')
  const cache = useQueryClient()
  const bookings = useQuery({
    queryKey: ['my-bookings', phone],
    queryFn: ({ signal }) => api.myBookings(phone, signal),
    enabled: !!phone,
    gcTime: 0,
  })
  const cancel = useMutation({
    mutationFn: (id: number) => api.cancel(id, phone),
    onSuccess: () => {
      setSelected(null)
      setNotice('Бронь отменена. Вы можете выбрать другое время.')
      void cache.invalidateQueries({ queryKey: ['my-bookings', phone] })
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
  return (
    <div className="container page my-bookings-page">
      <div className="page-heading">
        <div className="eyebrow">ВАШИ ПЛАНЫ НА ЗИМУ</div>
        <h1>Мои брони</h1>
        <p>Всё снаряжение и время — в одном месте.</p>
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
        <Empty title="Найдём ваши зимние планы">
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
        {bookings.data?.map((booking) => (
          <article className="panel reservation-card" key={booking.id}>
            <div className="reservation-top">
              <span className="eyebrow">БРОНЬ № {booking.id}</span>
              <Status value={booking.status} />
            </div>
            <h2>{categoryName(booking.category)}</h2>
            <div className="reservation-meta">
              <span>
                <CalendarDays size={17} />
                {dateLabel(booking.booking_date)}
              </span>
              <span>
                <Clock3 size={17} />
                {hoursLabel(booking.hours)}
              </span>
            </div>
            <div className="item-tags">
              {booking.items.map((item, i) => (
                <span key={i}>
                  {item.item_type}
                  {item.size ? ` · ${item.size}` : ''}
                </span>
              ))}
            </div>
            <div className="reservation-bottom">
              <small>Назовите номер брони сотруднику при получении.</small>
              {booking.status === 'active' && (
                <button
                  className="text-button danger-text"
                  onClick={() => {
                    cancel.reset()
                    setSelected(booking)
                  }}
                >
                  Отменить бронь
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {selected && (
        <Modal
          title={`Отменить бронь № ${selected.id}?`}
          close={() => setSelected(null)}
          busy={cancel.isPending}
        >
          <p>
            {categoryName(selected.category)} · {dateLabel(selected.booking_date)} ·{' '}
            {hoursLabel(selected.hours)}
          </p>
          <p className="muted">Выбранное время освободится. Это действие нельзя отменить.</p>
          <ErrorNotice error={cancel.error} />
          <div className="button-row">
            <button
              className="button secondary"
              disabled={cancel.isPending}
              onClick={() => setSelected(null)}
            >
              Оставить бронь
            </button>
            <button
              className="button danger"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(selected.id)}
            >
              {cancel.isPending ? 'Отменяем…' : 'Да, отменить'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
