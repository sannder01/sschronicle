'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '@/lib/client'
import { Toaster, toast } from 'sonner'
import { ACCENT_KEYS } from './accents'
const AppContext = createContext(null)
const defaults = {
  theme: 'system',
  language: 'ru',
  timezone: 'UTC',
  animations: true,
  reduce_transparency: false,
  accent: 'blue',
}
export function AppProvider({ initialUser, initialProfile = null, children }) {
  const [profile, setProfileState] = useState(initialProfile),
    [profileError, setProfileError] = useState(null),
    [resolvedTheme, setResolvedTheme] = useState('light'),
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
      const next = settings.theme === 'system' ? (media.matches ? 'dark' : 'light') : settings.theme
      if (root.dataset.theme && root.dataset.theme !== next && settings.animations) {
        root.classList.add('accent-transition')
        setTimeout(() => root.classList.remove('accent-transition'), 450)
      }
      root.dataset.theme = next
      setResolvedTheme(next)
    }
    apply()
    media.addEventListener('change', apply)
    root.lang = settings.language
    root.dataset.motion = settings.animations ? 'on' : 'off'
    root.dataset.transparency = settings.reduce_transparency ? 'reduced' : 'full'
    return () => media.removeEventListener('change', apply)
  }, [settings])
  // Accent: cross-fade colours smoothly when the user picks a new one
  const accent = ACCENT_KEYS.includes(settings.accent) ? settings.accent : 'blue'
  useEffect(() => {
    const root = document.documentElement
    if (root.dataset.accent && root.dataset.accent !== accent && settings.animations) {
      root.classList.add('accent-transition')
      const id = setTimeout(() => root.classList.remove('accent-transition'), 450)
      root.dataset.accent = accent
      return () => {
        clearTimeout(id)
        root.classList.remove('accent-transition')
      }
    }
    root.dataset.accent = accent
  }, [accent, settings.animations])
  // Toasts by sonner: stacked, swipe to dismiss, spring physics
  const notify = useCallback((message, type = 'success') => {
    if (type === 'error') toast.error(message)
    else toast.success(message)
  }, [])
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
      <Toaster
        position="bottom-center"
        theme={resolvedTheme}
        offset={28}
        mobileOffset={{ bottom: 'calc(96px + env(safe-area-inset-bottom))' }}
        gap={8}
        visibleToasts={3}
        duration={4000}
        toastOptions={{ className: 'chronicle-toast' }}
      />
    </AppContext.Provider>
  )
}
export const useApp = () => useContext(AppContext)
