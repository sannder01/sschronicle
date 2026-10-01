'use client'
import { forwardRef, useEffect, useId, useRef } from 'react'
import Icon from './Icon'
export const Button = forwardRef(function Button(
  { variant = 'secondary', className = '', children, ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  )
})
export const Input = forwardRef(function Input({ className = '', ...props }, ref) {
  return <input ref={ref} className={`input ${className}`} {...props} />
})
export function Dialog({ open, title, onClose, children, className = '' }) {
  const ref = useRef(null),
    titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      className={`dialog glass ${className}`}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onClose?.()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose?.()
      }}
    >
      <div className="dialog-body">
        <header className="dialog-header">
          <h2 id={titleId}>{title}</h2>
          <Button
            variant="ghost"
            aria-label="Закрыть / Close"
            onClick={onClose}
            disabled={!onClose}
          >
            <Icon name="close" />
          </Button>
        </header>
        {open && children}
      </div>
    </dialog>
  )
}
export function EmptyState({ icon = 'tasks', title, description, children }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        {typeof icon === 'string' ? <Icon name={icon} size={30} /> : icon}
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  )
}
export function LoadingState({ label = 'Загрузка / Loading' }) {
  return (
    <div className="loading-state" role="status">
      <span className="spinner" />
      {label}
    </div>
  )
}
export function ErrorState({ error, onRetry, t = (ru) => ru }) {
  return (
    <div className="error-panel" role="alert">
      <strong>{t('Не удалось загрузить данные', 'Could not load data')}</strong>
      <p>
        {error?.status === 401
          ? t('Сессия истекла. Войдите снова.', 'Your session expired. Sign in again.')
          : t(
              'Проверьте подключение и попробуйте ещё раз.',
              'Check your connection and try again.',
            )}
      </p>
      {onRetry && <Button onClick={onRetry}>{t('Повторить', 'Retry')}</Button>}
    </div>
  )
}
