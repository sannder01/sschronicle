'use client'
import { forwardRef, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { motionReduced } from './motion'
import { Drawer } from 'vaul'

/** Phones get a bottom sheet (vaul): drag it down to close, with rubber-band physics. */
function useIsPhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const media = matchMedia('(max-width: 640px)'),
      update = () => setPhone(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  return phone
}
export function Dialog(props) {
  return useIsPhone() ? <SheetDialog {...props} /> : <ModalDialog {...props} />
}
function SheetDialog({ open, title, onClose, children, className = '' }) {
  return (
    <Drawer.Root
      open={open}
      dismissible={Boolean(onClose)}
      onOpenChange={(next) => {
        if (!next) onClose?.()
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="sheet-overlay" />
        <Drawer.Content className={`sheet ${className}`} aria-describedby={undefined}>
          <div className="sheet-handle" aria-hidden="true" />
          <div className="dialog-body">
            <header className="dialog-header">
              <Drawer.Title asChild>
                <h2>{title}</h2>
              </Drawer.Title>
              <Button
                variant="ghost"
                aria-label="Закрыть / Close"
                onClick={onClose}
                disabled={!onClose}
              >
                <Icon name="close" />
              </Button>
            </header>
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
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
function ModalDialog({ open, title, onClose, children, className = '' }) {
  const ref = useRef(null),
    titleId = useId(),
    [rendered, setRendered] = useState(open)
  useEffect(() => {
    const dialog = ref.current
    if (open) {
      setRendered(true)
      dialog.classList.remove('closing')
      if (!dialog.open) dialog.showModal()
      return
    }
    if (!dialog.open) return
    // Exit along the same path it entered, then really close.
    if (motionReduced()) {
      dialog.close()
      setRendered(false)
      return
    }
    dialog.classList.add('closing')
    const id = setTimeout(() => {
      dialog.classList.remove('closing')
      dialog.close()
      setRendered(false)
    }, 200)
    return () => clearTimeout(id)
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
        {(open || rendered) && children}
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
      <span className="text-shimmer">{label}</span>
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

/**
 * Site-styled replacement for <select>. The native list is drawn by the OS
 * (unreadable in dark mode on Windows), so this renders our own listbox.
 * It opens in the browser top layer (Popover API), so it also shows above modal dialogs.
 * onChange receives the option's value, not an event.
 */
export function Select({
  value,
  onChange,
  options,
  className = '',
  disabled = false,
  id,
  ...aria
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(-1),
    [placement, setPlacement] = useState('below'),
    triggerRef = useRef(null),
    listRef = useRef(null),
    typed = useRef({ text: '', at: 0 }),
    listId = useId()
  const selectedIndex = options.findIndex((option) => String(option.value) === String(value))
  const selected = options[selectedIndex]

  const place = useCallback(() => {
    const trigger = triggerRef.current,
      list = listRef.current
    if (!trigger || !list) return
    const rect = trigger.getBoundingClientRect(),
      margin = 8,
      below = innerHeight - rect.bottom - margin,
      above = rect.top - margin,
      up = below < 220 && above > below
    list.style.minWidth = rect.width + 'px'
    list.style.maxHeight = Math.max(140, Math.min(320, (up ? above : below) - 6)) + 'px'
    const width = list.offsetWidth
    list.style.left = Math.max(margin, Math.min(rect.left, innerWidth - width - margin)) + 'px'
    if (up) {
      list.style.top = 'auto'
      list.style.bottom = innerHeight - rect.top + 6 + 'px'
    } else {
      list.style.bottom = 'auto'
      list.style.top = rect.bottom + 6 + 'px'
    }
    setPlacement(up ? 'above' : 'below')
  }, [])

  useLayoutEffect(() => {
    const list = listRef.current
    if (!open || !list) return
    try {
      list.showPopover?.()
    } catch {}
    place()
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
    const outside = (event) => {
      if (!list.contains(event.target) && !triggerRef.current?.contains(event.target))
        setOpen(false)
    }
    const reposition = (event) => {
      if (event.type === 'scroll' && list.contains(event.target)) return
      place()
    }
    document.addEventListener('pointerdown', outside, true)
    addEventListener('resize', reposition)
    addEventListener('scroll', reposition, true)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      removeEventListener('resize', reposition)
      removeEventListener('scroll', reposition, true)
      try {
        list.hidePopover?.()
      } catch {}
    }
  }, [open, place])

  useEffect(() => {
    if (!open || active < 0) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function show() {
    if (disabled) return
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }
  function choose(index) {
    const option = options[index]
    setOpen(false)
    triggerRef.current?.focus()
    if (option && !option.disabled && String(option.value) !== String(value)) onChange(option.value)
  }
  function step(from, direction) {
    for (let i = from + direction; i >= 0 && i < options.length; i += direction)
      if (!options[i].disabled) return i
    return from
  }
  function onKeyDown(event) {
    const key = event.key
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        event.preventDefault()
        show()
      }
      return
    }
    if (key === 'Escape') {
      // Close only the list, not a surrounding dialog.
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    } else if (key === 'Tab') setOpen(false)
    else if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => step(index, key === 'ArrowDown' ? 1 : -1))
    } else if (key === 'Home' || key === 'End') {
      event.preventDefault()
      setActive(key === 'Home' ? step(-1, 1) : step(options.length, -1))
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      choose(active)
    } else if (key.length === 1) {
      // Type-ahead: jump to the first option starting with the typed letters.
      const now = Date.now(),
        memory = typed.current
      memory.text = (now - memory.at < 700 ? memory.text : '') + key.toLowerCase()
      memory.at = now
      const match = options.findIndex(
        (option) => !option.disabled && String(option.label).toLowerCase().startsWith(memory.text),
      )
      if (match >= 0) setActive(match)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        className={`input select-trigger ${open ? 'open' : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        {...aria}
      >
        <span className="select-value">{selected?.label ?? ''}</span>
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          popover="manual"
          className={`select-list ${placement}`}
          aria-label={aria['aria-label']}
          // The list sits inside the trigger's <label>; stop the label re-clicking the trigger.
          onClick={(event) => event.preventDefault()}
        >
          {options.map((option, index) => (
            <li
              key={String(option.value)}
              id={`${listId}-${index}`}
              data-index={index}
              role="option"
              aria-selected={index === selectedIndex}
              aria-disabled={option.disabled || undefined}
              className={`select-option ${index === active ? 'active' : ''}`}
              onPointerMove={() => !option.disabled && setActive(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {index === selectedIndex && <Icon name="check" size={15} />}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
