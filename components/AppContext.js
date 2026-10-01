'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/client'
const AppContext = createContext(null)
const defaults = {
  theme: 'system',
  language: 'ru',
  timezone: 'UTC',
  animations: true,
  reduce_transparency: false,
}
export function AppProvider({ initialUser, initialProfile = null, children }) {
  const [profile, setProfileState] = useState(initialProfile),
    [profileError, setProfileError] = useState(null),
    [toast, setToast] = useState(null),
    timer = useRef(),
    request = useRef(0)
  const setProfile = useCallback((value) => {
    request.current++
    setProfileState(value)
    setProfileError(null)
  }, [])
  const refreshProfile = useCallback(async () => {
    const current = ++request.current
    try {
      const result = await api('/api/profile')
      if (current === request.current) {
        setProfileState(result)
        setProfileError(null)
      }
      return result
    } catch (error) {
      if (current === request.current) setProfileError(error)
      return null
    }
  }, [])
  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])
  const settings = useMemo(() => ({ ...defaults, ...profile?.settings }), [profile?.settings])
  useEffect(() => {
    const root = document.documentElement,
      media = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      root.dataset.theme =
        settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme
    }
    apply()
    media.addEventListener('change', apply)
    root.lang = settings.language
    root.dataset.motion = settings.animations ? 'on' : 'off'
    root.dataset.transparency = settings.reduce_transparency ? 'reduced' : 'full'
    return () => media.removeEventListener('change', apply)
  }, [settings])
  const notify = useCallback((message, type = 'success') => {
    clearTimeout(timer.current)
    setToast({ message, type })
    timer.current = setTimeout(() => setToast(null), 5000)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const language = settings.language,
    t = useCallback((ru, en) => (language === 'en' ? (en ?? ru) : ru), [language])
  const value = useMemo(
    () => ({
      user: profile?.user || initialUser,
      profile,
      settings,
      language,
      t,
      refreshProfile,
      setProfile,
      profileError,
      notify,
    }),
    [profile, initialUser, settings, language, t, refreshProfile, setProfile, profileError, notify],
  )
  return (
    <AppContext.Provider value={value}>
      {children}
      {toast && (
        <div className={`toast glass ${toast.type}`} role="status">
          {toast.message}
        </div>
      )}
    </AppContext.Provider>
  )
}
export const useApp = () => useContext(AppContext)
