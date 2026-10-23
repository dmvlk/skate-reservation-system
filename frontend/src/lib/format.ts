import type { CategoryCode } from '../types'
export const categories: Record<
  CategoryCode,
  { name: string; subtitle: string; description: string; label: string }
> = {
  skates: {
    name: 'Коньки',
    subtitle: 'Лёд, музыка и хорошая компания',
    description: 'Для первых шагов и уверенных виражей.',
    label: 'НА ЛЁД',
  },
  skis: {
    name: 'Горные лыжи',
    subtitle: 'Своя траектория на склоне',
    description: 'Лыжи и ботинки для вашего спуска.',
    label: 'НА СКЛОН',
  },
  snowboard: {
    name: 'Сноуборд',
    subtitle: 'Поймай свой зимний ритм',
    description: 'Доска и ботинки. Осталось выбрать склон.',
    label: 'ЗА СВОБОДОЙ',
  },
}
export function isCategory(value: string): value is CategoryCode {
  return Object.hasOwn(categories, value)
}
export const categoryName = (code: string) =>
  isCategory(code) ? categories[code].name : 'Снаряжение'
export const timeZone = import.meta.env.VITE_RENTAL_TIMEZONE || 'Europe/Moscow'
export function rentalNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)?.value || ''
  return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')) }
}
export function addDays(date: string, amount: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + amount)
  return d.toISOString().slice(0, 10)
}
export function dateLabel(date: string | null, short = false) {
  return date
    ? new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: short ? 'short' : 'long',
        timeZone: 'UTC',
      }).format(new Date(`${date}T12:00:00Z`))
    : 'Дата не указана'
}
export function hoursLabel(hours: number[]) {
  const sorted = [...new Set(hours)].sort((a, b) => a - b)
  const ranges: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i]
    let end = start
    while (sorted[i + 1] === end + 1) end = sorted[++i]
    ranges.push(`${start}:00–${end + 1}:00`)
  }
  return ranges.join(', ') || 'Время не указано'
}
export function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  return digits.length === 11 && digits.startsWith('8') ? `7${digits.slice(1)}` : digits
}
export const validPhone = (phone: string) => /^\d{10,15}$/.test(normalizePhone(phone))
export const numberSized = (code: string) => ['skate', 'ski_boot', 'snowboard_boot'].includes(code)
