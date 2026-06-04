import { describe, expect, test } from 'bun:test'

import { getRightSidebarToggleLabel } from './rightSidebarToggleLabels'

describe('right sidebar toggle labels', () => {
  test('uses the generic right sidebar label instead of git-specific copy', () => {
    const t = (key: string) => ({
      'layout.rightSidebar.actions.open': 'Open right sidebar',
      'layout.rightSidebar.actions.close': 'Close right sidebar',
    })[key] ?? key

    expect(getRightSidebarToggleLabel(false, t)).toBe('Open right sidebar')
    expect(getRightSidebarToggleLabel(true, t)).toBe('Close right sidebar')
    expect(getRightSidebarToggleLabel(undefined, t)).toBe('Open right sidebar')
  })
})
