import { afterAll, describe, expect, test } from 'bun:test'

import { subscribeDeviceInfo } from './device'

const originalWindow = globalThis.window
const originalDocument = globalThis.document
const originalNavigator = globalThis.navigator

const installBrowserStubs = () => {
  const windowListeners = new Map<string, Set<EventListener>>()
  const mediaListeners = new Map<string, Set<EventListener>>()
  const classList = {
    add: () => {},
    remove: () => {},
  }
  const root = {
    classList,
    style: {
      setProperty: () => {},
      getPropertyValue: () => '',
    },
  }

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { documentElement: root },
  })
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { maxTouchPoints: 0, platform: 'Win32', userAgent: 'Test' },
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      innerWidth: 1200,
      location: { origin: 'http://localhost:3000', hostname: 'localhost' },
      addEventListener: (type: string, listener: EventListener) => {
        const listeners = windowListeners.get(type) ?? new Set<EventListener>()
        listeners.add(listener)
        windowListeners.set(type, listeners)
      },
      removeEventListener: (type: string, listener: EventListener) => {
        windowListeners.get(type)?.delete(listener)
      },
      matchMedia: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: (type: string, listener: EventListener) => {
          const key = `${query}:${type}`
          const listeners = mediaListeners.get(key) ?? new Set<EventListener>()
          listeners.add(listener)
          mediaListeners.set(key, listeners)
        },
        removeEventListener: (type: string, listener: EventListener) => {
          mediaListeners.get(`${query}:${type}`)?.delete(listener)
        },
      }),
    },
  })

  return {
    windowListenerCount: (type: string) => windowListeners.get(type)?.size ?? 0,
    mediaListenerCount: (query: string, type: string) => mediaListeners.get(`${query}:${type}`)?.size ?? 0,
  }
}

afterAll(() => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
})

describe('device info subscription', () => {
  test('shares browser listeners across subscribers and removes them after the last unsubscribe', () => {
    const browser = installBrowserStubs()

    const unsubscribeFirst = subscribeDeviceInfo(() => {})
    const unsubscribeSecond = subscribeDeviceInfo(() => {})

    expect(browser.windowListenerCount('resize')).toBe(1)
    expect(browser.mediaListenerCount('(pointer: coarse)', 'change')).toBe(1)
    expect(browser.mediaListenerCount('(hover: none)', 'change')).toBe(1)

    unsubscribeFirst()

    expect(browser.windowListenerCount('resize')).toBe(1)
    expect(browser.mediaListenerCount('(pointer: coarse)', 'change')).toBe(1)
    expect(browser.mediaListenerCount('(hover: none)', 'change')).toBe(1)

    unsubscribeSecond()

    expect(browser.windowListenerCount('resize')).toBe(0)
    expect(browser.mediaListenerCount('(pointer: coarse)', 'change')).toBe(0)
    expect(browser.mediaListenerCount('(hover: none)', 'change')).toBe(0)
  })
})
