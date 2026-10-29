import { useEffect, useRef, type ReactNode } from 'react'
import { AlertCircle, ArrowRight, Check, LoaderCircle, MountainSnow, X } from 'lucide-react'
import { Link } from 'react-router'

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="Скользи! - главная">
      <span className="brand-icon">
        <MountainSnow size={25} strokeWidth={1.6} />
      </span>
      <span>
        скользи<span className="brand-dot">!</span>
      </span>
      <small>ПРОКАТ СНАРЯЖЕНИЯ</small>
    </Link>
  )
}
export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={20} />
      <div>
        {error instanceof Error ? error.message : String(error)}
        {retry && (
          <button className="text-button" onClick={retry}>
            Попробовать снова <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
export function Loading({ text = 'Загружаем…' }: { text?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      {text}
    </div>
  )
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <MountainSnow size={42} strokeWidth={1.2} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}
export function Status({ value }: { value: string }) {
  const labels: Record<string, string> = {
    active: 'Забронировано',
    issued: 'Выдано',
    completed: 'Завершено',
    cancelled: 'Отменено',
    available: 'Доступен',
    rented: 'Выдан',
    broken: 'Сломан',
  }
  return (
    <span className={`status status-${value}`}>
      <span />
      {labels[value] || value}
    </span>
  )
}
export function Modal({
  title,
  children,
  close,
  busy = false,
}: {
  title: string
  children: ReactNode
  close: () => void
  busy?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) close()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) close()
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Закрыть" onClick={close} disabled={busy}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <div className="notice success" role="status">
      <Check size={20} />
      <span>{children}</span>
    </div>
  )
}
