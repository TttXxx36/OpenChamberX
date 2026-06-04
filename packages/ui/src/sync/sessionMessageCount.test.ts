import { describe, expect, test } from 'bun:test'

import { shouldSubscribeToSessionMessageCount } from './sync-context'

describe('session message count subscription', () => {
  test('does not subscribe for an empty session id', () => {
    expect(shouldSubscribeToSessionMessageCount('')).toBe(false)
    expect(shouldSubscribeToSessionMessageCount(null)).toBe(false)
    expect(shouldSubscribeToSessionMessageCount(undefined)).toBe(false)
  })

  test('subscribes for a real session id', () => {
    expect(shouldSubscribeToSessionMessageCount('ses_123')).toBe(true)
  })
})
