'use client'
import { Suspense, useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, LoadingState } from '@/components/ui'
import Icon from '@/components/Icon'
import Link from 'next/link'
function AuthContent() {
  const { status } = useSession(),
    router = useRouter(),
    params = useSearchParams(),
    [language, setLanguage] = useState('ru'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const t = (ru, en) => (language === 'ru' ? ru : en)
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => {
      document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    if (status === 'authenticated') router.replace('/app/tasks')
  }, [status, router])
  async function login() {
    setBusy(true)
    setError('')
    try {
      await signIn('google', { callbackUrl: '/app/tasks' })
    } catch {
      setError(
        t(
          'Не удалось открыть вход через Google. Попробуйте ещё раз.',
          'Could not open Google sign-in. Please try again.',
        ),
      )
      setBusy(false)
    }
  }
  const authError = params.get('error')
  return (
    <div className="auth-page">
      <header className="public-header">
        <Link className="brand" href="/">
          <span className="brand-mark">
            C<span />
          </span>
          Chronicle.
        </Link>
        <nav>
          <span>{t('Ваш личный ритм', 'At your own pace')}</span>
          <Button
            variant="ghost"
            onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
            aria-label={t('Switch to English', 'Переключить на русский')}
          >
            {language === 'ru' ? 'EN' : 'RU'}
          </Button>
        </nav>
      </header>
      <main className="auth-content">
        <div className="auth-copy">
          <p className="eyebrow">
            {t('ПРОСТРАНСТВО ДЛЯ ВАЖНОГО', 'A LITTLE SPACE FOR WHAT MATTERS')}
          </p>
          <h1>
            {t('Больше ясности.', 'A clearer mind.')}
            <br />
            <span>{t('Больше жизни.', 'A fuller life.')}</span>
          </h1>
          <p>
            {t(
              'Планы, мысли и маленькие шаги к большим переменам. Всё, что важно вам, — в одном спокойном месте.',
              'Your plans, your thoughts, and small steps toward meaningful change. Everything that matters, in one calm place.',
            )}
          </p>
          <div className="auth-features">
            <span>
              <Icon name="tasks" size={16} />
              {t('Задачи', 'Tasks')}
            </span>
            <span>
              <Icon name="habits" size={16} />
              {t('Привычки', 'Habits')}
            </span>
            <span>
              <Icon name="notes" size={16} />
              {t('Заметки', 'Notes')}
            </span>
            <span>
              <Icon name="challenges" size={16} />
              {t('Челленджи', 'Challenges')}
            </span>
          </div>
        </div>
        <section className="auth-card glass">
          <span className="brand-mark">
            C<span />
          </span>
          <h2>
            {t('Добро пожаловать', 'Welcome to')}
            <br />
            {t('в ваш Chronicle.', 'your Chronicle.')}
          </h2>
          <p>
            {t(
              'Войдите, чтобы продолжить с того места, где остановились.',
              'Sign in to pick up right where you left off.',
            )}
          </p>
          {(authError || error) && (
            <div className="auth-error" role="alert">
              {error ||
                (authError === 'OAuthAccountNotLinked'
                  ? t(
                      'Этот адрес уже связан с другим способом входа. Используйте исходный Google-аккаунт.',
                      'This email is linked to another sign-in method. Use your original Google account.',
                    )
                  : t(
                      'Вход не завершён. Проверьте Google-аккаунт и попробуйте снова.',
                      'Sign-in was not completed. Check your Google account and try again.',
                    ))}
            </div>
          )}
          <Button className="google-button" disabled={busy || status === 'loading'} onClick={login}>
            <span className="google-symbol">G</span>
            {busy
              ? t('Переходим к Google…', 'Opening Google…')
              : t('Продолжить с Google', 'Continue with Google')}
            <Icon name="arrow" size={17} />
          </Button>
          <div className="auth-trust">
            <Icon name="shield" size={14} />
            {t('Ваши записи доступны только вам', 'Your records belong to you')}
          </div>
          <div className="auth-card-footer">
            {t(
              'Один аккаунт для всех устройств. Настройки, задачи и заметки сохраняются в вашем личном пространстве.',
              'One account across your devices. Your preferences, tasks, and notes stay together in your personal space.',
            )}
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <span>Chronicle © {new Date().getFullYear()}</span>
        <span>{t('Меньше шума. Больше ясности.', 'Less noise. More clarity.')}</span>
      </footer>
    </div>
  )
}
export default function AuthPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <AuthContent />
    </Suspense>
  )
}
