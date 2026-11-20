'use client'
// Full-screen mode for a canvas (graph, concept map): the element covers the whole window and
// the page underneath stops scrolling, so dragging on the canvas never moves the site instead.
// It is a fixed overlay rather than the browser's element fullscreen on purpose: dialogs,
// bottom sheets and toasts live outside the canvas and would be hidden by element fullscreen
// (and iPhone Safari does not support it at all). F11 still makes the browser itself full screen.
import { useCallback, useEffect, useRef, useState } from 'react'

export function useFullscreen() {
  const ref = useRef(null),
    [full, setFull] = useState(false)
  const toggle = useCallback(() => setFull((v) => !v), [])
  const exit = useCallback(() => setFull(false), [])

  useEffect(() => {
    if (!full) return
    const root = document.documentElement,
      body = document.body
    const before = [root.style.overflow, body.style.overflow, body.style.overscrollBehavior]
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    body.style.overscrollBehavior = 'none'
    root.classList.add('canvas-fullscreen')
    const onKey = (e) => {
      // Escape leaves full screen unless a dialog or a text field is handling it
      if (e.key !== 'Escape' || document.querySelector('dialog[open], .sheet')) return
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      setFull(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      ;[root.style.overflow, body.style.overflow, body.style.overscrollBehavior] = before
      root.classList.remove('canvas-fullscreen')
      window.removeEventListener('keydown', onKey)
    }
  }, [full])

  return { ref, full, toggle, exit }
}
