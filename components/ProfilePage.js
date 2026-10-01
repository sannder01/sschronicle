'use client'
import { useEffect, useState } from 'react'
import { signIn, signOut } from 'next-auth/react'
import { useApp } from './AppContext'
import { Avatar } from './AppShell'
import { Button, Input, Dialog, LoadingState, ErrorState } from './ui'
import Icon from './Icon'
import { api, clearPrivateCache } from '@/lib/client'

export default function ProfilePage() {
  const { user, profile, settings, t, language, refreshProfile, setProfile, profileError, notify } =
    useApp()
  const [name, setName] = useState(user.name || ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [confirm, setConfirm] = useState(null),
    [confirmation, setConfirmation] = useState(''),
    [reauth, setReauth] = useState(false),
    [telegramLink, setTelegramLink] = useState(null)
  useEffect(() => {
    setName(user.name || '')
  }, [user.name])
  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])
  const zones = Array.from(
    new Set([
      settings.timezone,
      'UTC',
      ...(Intl.supportedValuesOf
        ? Intl.supportedValuesOf('timeZone')
        : ['Europe/Moscow', 'Asia/Almaty', 'Asia/Qyzylorda', 'Europe/London', 'America/New_York']),
    ]),
  )
  async function update(body) {
    setBusy(true)
    setError('')
    try {
      setProfile(await api('/api/profile', { method: 'PATCH', body }))
      notify(t('Изменения сохранены', 'Changes saved'))
    } catch {
      setError(t('Не удалось сохранить. Попробуйте ещё раз.', 'Could not save. Please try again.'))
    } finally {
      setBusy(false)
    }
  }
  async function logout() {
    clearPrivateCache(user.id)
    await signOut({ callbackUrl: '/auth' })
  }
  async function securityAction() {
    setBusy(true)
    setError('')
    try {
      if (confirm === 'sessions') {
        await api('/api/profile/sessions', { method: 'DELETE' })
        notify(t('Другие сеансы завершены', 'Other sessions signed out'))
        setConfirm(null)
      } else if (confirm === 'account') {
        await api('/api/profile/account', { method: 'DELETE', body: { confirmation } })
        await logout()
      } else if (confirm === 'logout') {
        await logout()
      }
    } catch (err) {
      if (err.code === 'REAUTHENTICATION_REQUIRED') {
        setReauth(true)
        setError(
          t(
            'Сначала подтвердите личность через Google, затем повторите удаление.',
            'Verify your identity with Google, then repeat deletion.',
          ),
        )
      } else
        setError(
          t(
            'Не удалось выполнить действие. Попробуйте ещё раз.',
            'Could not complete the action. Please try again.',
          ),
        )
    } finally {
      setBusy(false)
    }
  }
  async function exportData() {
    setBusy(true)
    setError('')
    try {
      const data = await api('/api/profile/export')
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = 'chronicle-export.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch {
      setError(t('Не удалось экспортировать данные', 'Could not export data'))
    } finally {
      setBusy(false)
    }
  }
  async function telegram(method, body) {
    setBusy(true)
    setError('')
    try {
      const result = await api('/api/profile/telegram', { method, body })
      if (method === 'POST') setTelegramLink(result)
      else setTelegramLink(null)
      await refreshProfile()
    } catch {
      setError(
        t(
          'Не удалось обновить подключение Telegram. Попробуйте ещё раз.',
          'Could not update Telegram connection. Please try again.',
        ),
      )
    } finally {
      setBusy(false)
    }
  }
  function openConfirm(value) {
    setConfirm(value)
    setConfirmation('')
    setError('')
    setReauth(false)
  }
  if (!profile)
    return profileError ? (
      <ErrorState error={profileError} onRetry={refreshProfile} t={t} />
    ) : (
      <LoadingState />
    )
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{t('Ваше пространство', 'Your space')}</p>
          <h1>{t('Личный кабинет', 'Make it yours.')}</h1>
          <p className="page-subtitle">
            {t('Настройки, которые следуют за вами.', 'Your preferences, wherever you go.')}
          </p>
        </div>
        <Button onClick={() => openConfirm('logout')}>
          <Icon name="logout" />
          {t('Выйти', 'Sign out')}
        </Button>
      </header>
      {error && !confirm && (
        <div className="error-panel form-error" role="alert">
          {error}
        </div>
      )}
      <div className="settings-grid">
        <div className="settings-column">
          <section className="panel settings-panel">
            <div className="profile-identity">
              <Avatar user={user} size="large" />
              <div>
                <h2>{user.name || t('Ваш профиль', 'Your profile')}</h2>
                <p>{user.email}</p>
                <p>
                  {t('С нами с ', 'Joined ')}
                  {new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
                    month: 'long',
                    year: 'numeric',
                    timeZone: settings.timezone,
                  }).format(new Date(user.created_at))}
                </p>
              </div>
            </div>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault()
                update({ name })
              }}
            >
              <label className="field">
                {t('Имя', 'Name')}
                <Input
                  value={name}
                  required
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <div className="row">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={busy || !name.trim() || name === user.name}
                >
                  {t('Сохранить имя', 'Save name')}
                </Button>
              </div>
            </form>
            <div className="setting-row">
              <span>
                {t('Аватар', 'Avatar')}
                <small>
                  {t('Выберите цвет или фото Google', 'Choose a color or your Google photo')}
                </small>
              </span>
            </div>
            <div className="avatar-choices">
              {['blue', 'green', 'purple', 'orange'].map((color, i) => (
                <button
                  key={color}
                  className={`avatar-choice ${user.avatar_id === color ? 'selected' : ''}`}
                  aria-label={t(
                    ['Синий аватар', 'Зелёный аватар', 'Фиолетовый аватар', 'Оранжевый аватар'][i],
                    `${color} avatar`,
                  )}
                  aria-pressed={user.avatar_id === color}
                  disabled={busy}
                  onClick={() => update({ avatar_id: color })}
                >
                  <Avatar user={{ ...user, avatar_id: color }} />
                </button>
              ))}
              <Button
                variant="ghost"
                disabled={busy || !user.avatar_id}
                onClick={() => update({ avatar_id: null })}
              >
                {t('Фото Google', 'Google photo')}
              </Button>
            </div>
            <div className="profile-stats">
              <div>
                <strong>{profile.stats.completedTasks}</strong>
                <small>{t('задач завершено', 'tasks completed')}</small>
              </div>
              <div>
                <strong>{profile.stats.habitLogs}</strong>
                <small>{t('отметок привычек', 'habit check-ins')}</small>
              </div>
              <div>
                <strong>{profile.stats.successfulDays}</strong>
                <small>{t('дней челленджей', 'challenge days')}</small>
              </div>
            </div>
          </section>
          <section className="panel glass settings-panel">
            <h2>{t('Внешний вид и язык', 'Appearance & language')}</h2>
            <label className="setting-row">
              <span>
                {t('Тема', 'Theme')}
                <small>
                  {t('Светло, темно или как на устройстве', 'Light, dark, or your device setting')}
                </small>
              </span>
              <select
                className="input"
                disabled={busy}
                value={settings.theme}
                onChange={(e) => update({ settings: { theme: e.target.value } })}
              >
                <option value="light">{t('Светлая', 'Light')}</option>
                <option value="dark">{t('Тёмная', 'Dark')}</option>
                <option value="system">{t('Системная', 'System')}</option>
              </select>
            </label>
            <label className="setting-row">
              <span>{t('Язык', 'Language')}</span>
              <select
                className="input"
                value={settings.language}
                disabled={busy}
                onChange={(e) => update({ settings: { language: e.target.value } })}
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </label>
            <label className="setting-row">
              <span>
                {t('Часовой пояс', 'Time zone')}
                <small>{t('Для дат и напоминаний', 'Used for dates and reminders')}</small>
              </span>
              <select
                className="input"
                disabled={busy}
                value={settings.timezone}
                onChange={(e) => update({ settings: { timezone: e.target.value } })}
              >
                {zones.map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </label>
            <label className="setting-row">
              <span>
                {t('Анимации', 'Animations')}
                <small>
                  {t('Учитываются настройки устройства', 'Respects reduced motion on your device')}
                </small>
              </span>
              <input
                type="checkbox"
                checked={settings.animations}
                disabled={busy}
                onChange={(e) => update({ settings: { animations: e.target.checked } })}
              />
            </label>
            <label className="setting-row">
              <span>
                {t('Уменьшить прозрачность', 'Reduce transparency')}
                <small>{t('Непрозрачные панели и меню', 'Solid panels and menus')}</small>
              </span>
              <input
                type="checkbox"
                checked={settings.reduce_transparency}
                disabled={busy}
                onChange={(e) => update({ settings: { reduce_transparency: e.target.checked } })}
              />
            </label>
          </section>
        </div>
        <div className="settings-column">
          <section className="panel glass settings-panel">
            <h2>Telegram</h2>
            <span className={`status-badge ${profile.telegram.connected ? 'connected' : ''}`}>
              {profile.telegram.connected
                ? t('Подключён', 'Connected')
                : t('Не подключён', 'Not connected')}
            </span>
            <p>
              {t(
                'Напоминания о задачах там, где вам удобно. Подключение подтверждается после перехода к боту.',
                'Task reminders where they work for you. The connection is confirmed after linking through the bot.',
              )}
            </p>
            {profile.telegram.connected ? (
              <>
                <label className="setting-row">
                  <span>{t('За час до срока', 'One hour before')}</span>
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={profile.telegram.reminders_1h}
                    onChange={(e) => telegram('PATCH', { reminders_1h: e.target.checked })}
                  />
                </label>
                <label className="setting-row">
                  <span>{t('За день до срока', 'One day before')}</span>
                  <input
                    type="checkbox"
                    disabled={busy}
                    checked={profile.telegram.reminders_1d}
                    onChange={(e) => telegram('PATCH', { reminders_1d: e.target.checked })}
                  />
                </label>
                <div className="settings-actions">
                  <Button disabled={busy} onClick={() => telegram('DELETE')}>
                    {t('Отключить Telegram', 'Disconnect Telegram')}
                  </Button>
                </div>
              </>
            ) : profile.telegram.configured ? (
              <div className="stack">
                <Button disabled={busy} onClick={() => telegram('POST')}>
                  {t('Создать ссылку подключения', 'Create connection link')}
                </Button>
                {telegramLink && (
                  <>
                    <a
                      href={telegramLink.url}
                      target="_blank"
                      rel="noreferrer"
                      className="button button-primary"
                    >
                      {t('Подключить в Telegram', 'Connect in Telegram')}
                      <Icon name="arrow" size={16} />
                    </a>
                    <small className="muted">
                      {t(
                        'Ссылка одноразовая и действует 10 минут. После привязки проверьте состояние.',
                        'The link is single-use and expires in 10 minutes. Check status after linking.',
                      )}
                    </small>
                    <Button onClick={refreshProfile}>
                      {t('Проверить подключение', 'Check connection')}
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <p>
                {t(
                  'Подключение станет доступно, когда владелец сервиса настроит Telegram-бота.',
                  'Connecting will be available once the service owner configures the Telegram bot.',
                )}
              </p>
            )}
          </section>
          <section className="panel settings-panel">
            <h2>{t('Вход и безопасность', 'Sign-in & security')}</h2>
            <div className="setting-row">
              <span>
                Google<small>{user.email}</small>
              </span>
              <Icon name="shield" />
            </div>
            <p>
              {t(
                'Вы входите через Google. Адрес электронной почты управляется вашим Google-аккаунтом.',
                'You sign in with Google. Your email address is managed by your Google account.',
              )}
            </p>
            <Button disabled={busy} onClick={() => openConfirm('sessions')}>
              {t('Завершить другие сеансы', 'Sign out other sessions')}
            </Button>
          </section>
          <section className="panel settings-panel">
            <h2>{t('Ваши данные', 'Your data')}</h2>
            <p>
              {t(
                'Экспортируйте задачи, заметки, привычки, челленджи и настройки в JSON.',
                'Export your tasks, notes, habits, challenges, and settings as JSON.',
              )}
            </p>
            <Button disabled={busy} onClick={exportData}>
              <Icon name="download" />
              {t('Скачать данные', 'Download data')}
            </Button>
            <div className="setting-row" />
            <p>
              {t(
                'Удаление аккаунта необратимо. Все ваши данные будут удалены.',
                'Account deletion is permanent. All your data will be deleted.',
              )}
            </p>
            <Button variant="danger" disabled={busy} onClick={() => openConfirm('account')}>
              {t('Удалить аккаунт', 'Delete account')}
            </Button>
          </section>
        </div>
      </div>
      <Dialog
        open={!!confirm}
        title={
          confirm === 'account'
            ? t('Удаление аккаунта', 'Delete account')
            : confirm === 'sessions'
              ? t('Завершить другие сеансы?', 'Sign out other sessions?')
              : t('Выйти из Chronicle?', 'Sign out of Chronicle?')
        }
        onClose={() => !busy && setConfirm(null)}
      >
        <div className="stack">
          <p>
            {confirm === 'account'
              ? t(
                  'Введите DELETE. Перед удалением может потребоваться повторный вход через Google.',
                  'Type DELETE. You may need to sign in with Google again before deleting.',
                )
              : confirm === 'sessions'
                ? t(
                    'Этот сеанс останется активным. Остальные устройства потребуют повторного входа.',
                    'This session will stay active. Your other devices will require sign-in again.',
                  )
                : t(
                    'Приватные кэши и несинхронизированные черновики на этом устройстве будут очищены. Убедитесь, что заметки сохранены.',
                    'Private caches and unsynced drafts on this device will be cleared. Make sure your notes have been saved.',
                  )}
          </p>
          {confirm === 'account' && (
            <label className="field">
              {t('Подтверждение', 'Confirmation')}
              <Input
                value={confirmation}
                autoComplete="off"
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="DELETE"
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {reauth && (
            <Button
              onClick={() =>
                signIn(
                  'google',
                  { callbackUrl: '/app/profile' },
                  { prompt: 'select_account consent' },
                )
              }
            >
              {t('Подтвердить через Google', 'Verify with Google')}
            </Button>
          )}
          <div className="dialog-actions">
            <Button disabled={busy} onClick={() => setConfirm(null)}>
              {t('Отмена', 'Cancel')}
            </Button>
            <Button
              variant={confirm === 'account' ? 'danger' : 'primary'}
              disabled={busy || (confirm === 'account' && confirmation !== 'DELETE')}
              onClick={securityAction}
            >
              {busy
                ? t('Подождите…', 'Please wait…')
                : confirm === 'account'
                  ? t('Удалить навсегда', 'Delete permanently')
                  : t('Подтвердить', 'Confirm')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
