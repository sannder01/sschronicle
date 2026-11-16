'use client'
// Fluid-motion helpers, after Apple's "Designing Fluid Interfaces" (WWDC 2018).
import { useEffect, useLayoutEffect } from 'react'

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/** True when the user (device or Chronicle setting) asked for less motion. */
export function motionReduced() {
  if (typeof window === 'undefined') return true
  return (
    document.documentElement.dataset.motion === 'off' ||
    matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * Interruptible spring. Damping ratio + response (seconds), like UIKit.
 * Starts from `from` with `velocity` (units/s) so a gesture hands off without a seam.
 * Returns a handle; call stop() to interrupt — read .value for the live position.
 */
export function spring({
  from,
  to,
  velocity = 0,
  damping = 1,
  response = 0.4,
  onUpdate,
  onComplete,
}) {
  let x = from,
    v = velocity,
    raf = 0,
    last = 0,
    stopped = false
  const handle = {
    get value() {
      return x
    },
    get velocity() {
      return v
    },
    stop() {
      stopped = true
      cancelAnimationFrame(raf)
    },
  }
  if (motionReduced() || from === to) {
    x = to
    onUpdate?.(to)
    onComplete?.()
    return handle
  }
  const k = ((2 * Math.PI) / response) ** 2,
    c = (4 * Math.PI * damping) / response
  const step = (now) => {
    if (stopped) return
    const dt = last ? Math.min(0.064, (now - last) / 1000) : 1 / 60
    last = now
    const n = Math.ceil(dt / 0.004),
      h = dt / n
    for (let i = 0; i < n; i++) {
      v += (-k * (x - to) - c * v) * h
      x += v * h
    }
    if (Math.abs(v) < 2 && Math.abs(x - to) < 0.3) {
      x = to
      onUpdate?.(x)
      onComplete?.()
      return
    }
    onUpdate?.(x)
    raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
  return handle
}

/** Where a flick would come to rest (UIScrollView deceleration). velocity in px/s. */
export function project(velocity, decelerationRate = 0.99) {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/** Soft boundary: the further past the edge, the less it follows. */
export function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/** Tracks the last ~100ms of pointer samples to read release velocity. */
export function velocityTracker() {
  let samples = []
  return {
    add(value, time = performance.now()) {
      samples.push([value, time])
      samples = samples.filter(([, t]) => time - t < 100)
    },
    velocity(now = performance.now()) {
      // finger held still before lifting = a placed drop, not a flick
      samples = samples.filter(([, t]) => now - t < 100)
      if (samples.length < 2) return 0
      const [v0, t0] = samples[0],
        [v1, t1] = samples[samples.length - 1]
      return t1 > t0 ? ((v1 - v0) / (t1 - t0)) * 1000 : 0
    },
    reset() {
      samples = []
    },
  }
}

/**
 * Sliding selection indicator (iOS segmented control / sidebar pill).
 * Writes --ix --iy --iw --ih on the container; CSS draws ::before from them.
 */
export function useIndicator(ref, selector, deps = []) {
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const target = el.querySelector(selector)
      if (!target) {
        el.style.setProperty('--io', '0')
        return
      }
      el.style.setProperty('--ix', target.offsetLeft + 'px')
      el.style.setProperty('--iy', target.offsetTop + 'px')
      el.style.setProperty('--iw', target.offsetWidth + 'px')
      el.style.setProperty('--ih', target.offsetHeight + 'px')
      el.style.setProperty('--io', '1')
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    // enable the transition only after the first measured paint (no slide-in on load)
    const id = requestAnimationFrame(() => el.classList.add('indicator-ready'))
    return () => {
      cancelAnimationFrame(id)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
