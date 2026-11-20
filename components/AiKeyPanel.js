'use client'
// Profile → AI assistant: connect your own Groq or Gemini key for the learning assistant.
// The key goes to the server once, is checked by listing the provider's models, and is stored
// encrypted. The browser only ever sees the last four characters.
import { useEffect, useState } from 'react'
import { Button, Input, Select } from './ui'
import { api } from '@/lib/client'

const FALLBACK_PROVIDERS = [
  { id: 'groq', label: 'Groq', keys_url: 'https://console.groq.com/keys' },
  { id: 'gemini', label: 'Google Gemini', keys_url: 'https://aistudio.google.com/apikey' },
]

function errorMessage(err, t) {
  switch (err?.code) {
    case 'AI_KEY_INVALID':
      return t(
        'Провайдер не принял ключ. Проверьте, что он скопирован целиком.',
        'The provider rejected the key. Check that you copied all of it.',
      )
    case 'AI_TIMEOUT':
      return t(
        'Провайдер не ответил вовремя. Попробуйте ещё раз.',
        'The provider did not answer in time. Try again.',
      )
    case 'AI_PROVIDER_ERROR':
      return t(
        'Провайдер сейчас недоступен. Попробуйте позже.',
        'The provider is unavailable right now. Try later.',
      )
    case 'AI_KEYS_UNAVAILABLE':
      return t(
        'На сервере не настроено шифрование ключей.',
        'Key encryption is not set up on the server.',
      )
    case 'AI_BUSY':
      return t(
        'Провайдер сейчас занят. Попробуйте через несколько секунд.',
        'The provider is busy. Try again in a few seconds.',
      )
    case 'RATE_LIMITED':
      return t('Слишком много проверок. Подождите немного.', 'Too many checks. Wait a bit.')
    default:
      return t('Не удалось сохранить ключ.', 'Could not save the key.')
  }
}

export default function AiKeyPanel({ t }) {
  const [state, setState] = useState(null),
    [provider, setProvider] = useState('groq'),
    [key, setKey] = useState(''),
    [models, setModels] = useState(null),
    [model, setModel] = useState(''),
    [editing, setEditing] = useState(false),
    [confirming, setConfirming] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')

  const load = () =>
    api('/api/profile/ai')
      .then((s) => {
        setState(s)
        if (s.configured) setProvider(s.provider)
      })
      .catch(() => setState({ configured: false, providers: FALLBACK_PROVIDERS }))
  useEffect(() => {
    load()
  }, [])

  const providers = state?.providers?.length ? state.providers : FALLBACK_PROVIDERS
  const current = providers.find((p) => p.id === provider) || providers[0]
  const reset = () => {
    setKey('')
    setModels(null)
    setModel('')
    setError('')
  }

  async function check(e) {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api('/api/profile/ai/models', {
        method: 'POST',
        body: { provider, api_key: key.trim() },
      })
      setModels(result.models)
      setModel(result.default_model || result.models[0] || '')
    } catch (err) {
      setModels(null)
      setError(errorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }
  async function save() {
    setBusy(true)
    setError('')
    try {
      const saved = await api('/api/profile/ai', {
        method: 'PUT',
        body: { provider, model, api_key: key.trim() },
      })
      setState(saved)
      setEditing(false)
      reset()
    } catch (err) {
      setError(errorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    setBusy(true)
    setError('')
    try {
      await api('/api/profile/ai', { method: 'DELETE' })
      setConfirming(false)
      reset()
      await load()
    } catch {
      setError(t('Не удалось удалить ключ.', 'Could not remove the key.'))
    } finally {
      setBusy(false)
    }
  }
  async function changeModel(next) {
    setBusy(true)
    setError('')
    try {
      setState(
        await api('/api/profile/ai', {
          method: 'PUT',
          body: { provider: state.provider, model: next },
        }),
      )
    } catch (err) {
      setError(errorMessage(err, t))
    } finally {
      setBusy(false)
    }
  }
  // the saved key's model list, for switching models without re-entering the key
  const [savedModels, setSavedModels] = useState(null)

  const showForm = !state?.configured || editing
  const label = (id) => providers.find((p) => p.id === id)?.label || id

  return (
    <section className="panel glass settings-panel" id="ai" aria-labelledby="ai-panel-title">
      <h2 id="ai-panel-title">{t('AI-помощник', 'AI assistant')}</h2>
      <span className={`status-badge ${state?.configured ? 'connected' : ''}`}>
        {state?.configured
          ? t('Ваш ключ подключён', 'Your key is connected')
          : state?.server_available
            ? t('Работает через общий ключ', 'Uses the shared key')
            : t('Не подключён', 'Not connected')}
      </span>
      <p>
        {t(
          'Помощник в картах обучения может работать через ваш собственный ключ Groq или Google Gemini — тогда лимиты общего ключа вас не касаются. Ключ хранится на сервере в зашифрованном виде и никогда не показывается целиком.',
          'The learning-map assistant can use your own Groq or Google Gemini key, so the shared key limits do not apply to you. The key is stored encrypted on the server and is never shown in full.',
        )}
      </p>
      {state?.broken && (
        <p className="form-error">
          {t(
            'Сохранённый ключ больше не читается (сменился секрет сервера). Подключите ключ заново.',
            'The saved key can no longer be read (the server secret changed). Connect the key again.',
          )}
        </p>
      )}

      {state?.configured && !editing && (
        <>
          <div className="setting-row">
            <span>
              {label(state.provider)}
              <small>
                {t('Ключ', 'Key')} ••••{state.last4}
              </small>
            </span>
          </div>
          <label className="field">
            {t('Модель', 'Model')}
            {savedModels ? (
              <Select
                value={state.model}
                disabled={busy}
                onChange={(next) => next !== state.model && changeModel(next)}
                options={savedModels.map((m) => ({ value: m, label: m }))}
              />
            ) : (
              <span className="ai-model-row">
                <code>{state.model}</code>
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true)
                    setError('')
                    try {
                      // the server lists models with the stored key; the key never comes back
                      const list = await api('/api/profile/ai/models')
                      setSavedModels(
                        list.models.includes(state.model)
                          ? list.models
                          : [state.model, ...list.models],
                      )
                    } catch (err) {
                      setError(errorMessage(err, t))
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  {t('Сменить', 'Change')}
                </Button>
              </span>
            )}
          </label>
          <div className="settings-actions">
            <Button
              disabled={busy}
              onClick={() => {
                reset()
                setEditing(true)
              }}
            >
              {t('Заменить ключ', 'Replace key')}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
              {t('Удалить ключ', 'Remove key')}
            </Button>
          </div>
          {confirming && (
            <div className="delete-confirm" role="alertdialog">
              <p>
                {t(
                  'Ключ удалится с сервера. Помощник будет работать через общий ключ, если он есть.',
                  'The key is removed from the server. The assistant falls back to the shared key, if there is one.',
                )}
              </p>
              <div className="settings-actions">
                <Button onClick={() => setConfirming(false)}>{t('Отмена', 'Cancel')}</Button>
                <Button variant="danger" disabled={busy} onClick={remove}>
                  {t('Удалить', 'Remove')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {state && showForm && (
        <form className="stack" onSubmit={check}>
          <div className="segmented" role="radiogroup" aria-label={t('Провайдер', 'Provider')}>
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={provider === p.id}
                className={provider === p.id ? 'selected' : ''}
                onClick={() => {
                  setProvider(p.id)
                  reset()
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <label className="field">
            {t('API-ключ', 'API key')} {current.label}
            <Input
              type="password"
              autoComplete="off"
              spellCheck={false}
              required
              minLength={10}
              maxLength={300}
              placeholder={provider === 'groq' ? 'gsk_…' : 'AIza…'}
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                setModels(null)
              }}
            />
            <small>
              {t('Бесплатный ключ можно получить тут: ', 'Get a free key here: ')}
              <a href={current.keys_url} target="_blank" rel="noopener noreferrer">
                {current.keys_url.replace('https://', '')}
              </a>
            </small>
          </label>
          {models && (
            <label className="field">
              {t('Модель', 'Model')}
              <Select
                value={model}
                onChange={setModel}
                options={models.map((m) => ({ value: m, label: m }))}
              />
            </label>
          )}
          <div className="settings-actions">
            {editing && (
              <Button
                onClick={() => {
                  setEditing(false)
                  reset()
                }}
              >
                {t('Отмена', 'Cancel')}
              </Button>
            )}
            {models ? (
              <Button variant="primary" disabled={busy || !model} onClick={save}>
                {t('Сохранить ключ', 'Save key')}
              </Button>
            ) : (
              <Button type="submit" variant="primary" disabled={busy || key.trim().length < 10}>
                {busy ? t('Проверяю…', 'Checking…') : t('Проверить ключ', 'Check key')}
              </Button>
            )}
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </section>
  )
}
