'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useApp } from './AppContext'
import { Button, Dialog } from './ui'
import Icon from './Icon'
const navigation = [
  ['tasks', 'Задачи', 'Tasks'],
  ['habits', 'Привычки', 'Habits'],
  ['challenges', 'Челленджи', 'Challenges'],
  ['calendar', 'Календарь', 'Calendar'],
  ['notes', 'Заметки', 'Notes'],
  ['progress', 'Мой прогресс', 'My progress'],
  ['profile', 'Личный кабинет', 'Profile'],
]
export function Avatar({ user, size = '' }) {
  return (
    <span className={`avatar avatar-${user?.avatar_id || 'blue'} ${size}`}>
      {!user?.avatar_id && user?.image ? (
        <Image
          src={user.image}
          alt=""
          width={86}
          height={86}
          unoptimized
          referrerPolicy="no-referrer"
        />
      ) : (
        (user?.name || user?.email || 'C').slice(0, 1).toUpperCase()
      )}
    </span>
  )
}
export default function AppShell({ children }) {
  const pathname = usePathname(),
    { user, t, profileError, refreshProfile } = useApp(),
    [more, setMore] = useState(false)
  useEffect(() => {
    setMore(false)
  }, [pathname])
  const active = (key) => pathname.startsWith(`/app/${key}`)
  const navLink = ([key, ru, en], mobile = false) => (
    <Link
      key={key}
      href={`/app/${key}`}
      className={`nav-link ${active(key) ? 'active' : ''}`}
      aria-current={active(key) ? 'page' : undefined}
    >
      <Icon name={key} />
      <span>{t(ru, en)}</span>
      {!mobile && active(key) && <span className="nav-dot" />}
    </Link>
  )
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        {t('К содержимому', 'Skip to content')}
      </a>
      <aside className="sidebar glass">
        <Link className="brand" href="/app/tasks">
          <span className="brand-mark">
            C<span />
          </span>
          Chronicle<span className="brand-period">.</span>
        </Link>
        <div className="sidebar-caption">{t('ВАШЕ ПРОСТРАНСТВО', 'YOUR SPACE')}</div>
        <nav aria-label={t('Основная навигация', 'Main navigation')}>
          {navigation.slice(0, 5).map((item) => navLink(item))}
          <div className="nav-divider" />
          {navigation.slice(5).map((item) => navLink(item))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Icon name="leaf" size={22} />
            <p>
              {t('Маленькие шаги.', 'Small steps.')}
              <br />
              <strong>{t('Большие перемены.', 'Meaningful change.')}</strong>
            </p>
          </div>
          <Link className="account-link" href="/app/profile">
            <Avatar user={user} />
            <span>
              <strong>{user?.name || 'Chronicle'}</strong>
              <small>{t('Ваш личный ритм', 'At your own pace')}</small>
            </span>
            <Icon name="chevron" size={16} />
          </Link>
        </div>
      </aside>
      <div className="app-body">
        <header className="mobile-top glass">
          <Link className="brand" href="/app/tasks">
            <span className="brand-mark">
              C<span />
            </span>
            Chronicle.
          </Link>
          <Link href="/app/profile" aria-label={t('Личный кабинет', 'Profile')}>
            <Avatar user={user} />
          </Link>
        </header>
        {profileError && (
          <div className="connection-warning" role="alert">
            {t('Настройки аккаунта недоступны.', 'Account settings are unavailable.')}{' '}
            <Button variant="ghost" onClick={refreshProfile}>
              {t('Повторить', 'Retry')}
            </Button>
            {profileError.status === 401 && <Link href="/auth">{t('Войти', 'Sign in')}</Link>}
          </div>
        )}
        <main id="main" className={active('notes') ? 'main-content notes-main' : 'main-content'}>
          {children}
        </main>
      </div>
      <nav className="mobile-nav glass" aria-label={t('Нижняя навигация', 'Bottom navigation')}>
        {[navigation[0], navigation[1], navigation[4]].map((item) => navLink(item, true))}
        <Button
          variant="ghost"
          className={`nav-link ${['challenges', 'calendar', 'progress', 'profile'].some(active) ? 'active' : ''}`}
          onClick={() => setMore(true)}
          aria-expanded={more}
        >
          <Icon name="more" />
          <span>{t('Ещё', 'More')}</span>
        </Button>
      </nav>
      <Dialog
        open={more}
        title={t('Ваше пространство', 'Your space')}
        onClose={() => setMore(false)}
      >
        <nav className="more-menu">
          {navigation
            .filter(([key]) => !['tasks', 'habits', 'notes'].includes(key))
            .map((item) => navLink(item))}
        </nav>
      </Dialog>
    </div>
  )
}
