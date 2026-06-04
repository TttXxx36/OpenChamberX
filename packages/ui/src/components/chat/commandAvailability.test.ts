import { describe, expect, test } from 'bun:test'

import { hasMessagesForCommandAutocomplete } from './commandAvailability'

describe('command autocomplete availability', () => {
  test('derives message presence from message count', () => {
    expect(hasMessagesForCommandAutocomplete(0)).toBe(false)
    expect(hasMessagesForCommandAutocomplete(1)).toBe(true)
    expect(hasMessagesForCommandAutocomplete(12)).toBe(true)
  })
})
