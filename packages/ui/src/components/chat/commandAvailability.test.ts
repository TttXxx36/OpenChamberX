import { describe, expect, test } from 'bun:test'

import {
  buildCommandAutocompleteCommands,
  hasMessagesForCommandAutocomplete,
} from './commandAvailability'

const t = (key: string) => key

const commandNames = (input: Parameters<typeof buildCommandAutocompleteCommands>[0]) => {
  return buildCommandAutocompleteCommands(input).map((command) => command.name)
}

describe('command autocomplete availability', () => {
  test('derives message presence from message count', () => {
    expect(hasMessagesForCommandAutocomplete(0)).toBe(false)
    expect(hasMessagesForCommandAutocomplete(1)).toBe(true)
    expect(hasMessagesForCommandAutocomplete(12)).toBe(true)
  })

  test('returns only session-independent built-ins without a session or draft', () => {
    expect(commandNames({
      searchQuery: '',
      hasSession: false,
      hasMessagesInCurrentSession: false,
      canStartSessionCommand: false,
      commandsWithMetadata: [],
      skills: [],
      t,
    })).toEqual(['compact'])
  })

  test('adds start-session commands for an open draft without adding session commands', () => {
    expect(commandNames({
      searchQuery: '',
      hasSession: false,
      hasMessagesInCurrentSession: false,
      canStartSessionCommand: true,
      commandsWithMetadata: [],
      skills: [],
      t,
    })).toEqual(['catch-up', 'compact', 'debug', 'explore', 'plan-feature', 'weigh', 'workspace-review'])
  })

  test('shows init only for empty existing sessions', () => {
    expect(commandNames({
      searchQuery: '',
      hasSession: true,
      hasMessagesInCurrentSession: false,
      canStartSessionCommand: true,
      commandsWithMetadata: [],
      skills: [],
      t,
    })).toContain('init')

    expect(commandNames({
      searchQuery: '',
      hasSession: true,
      hasMessagesInCurrentSession: true,
      canStartSessionCommand: true,
      commandsWithMetadata: [],
      skills: [],
      t,
    })).not.toContain('init')
  })

  test('adds command and skill metadata and filters by query', () => {
    const commands = buildCommandAutocompleteCommands({
      searchQuery: 'rev',
      hasSession: false,
      hasMessagesInCurrentSession: false,
      canStartSessionCommand: false,
      commandsWithMetadata: [
        { name: 'review', description: 'Review changes', scope: 'project', source: 'skill' },
        { name: 'deploy', description: 'Ship app', scope: 'global' },
      ],
      skills: [{ name: 'review', description: 'Review skill', scope: 'project', source: 'opencode' }],
      t,
    })

    expect(commands.map((command) => command.name)).toEqual(['review', 'review'])
    expect(commands.every((command) => command.isSkill)).toBe(true)
  })
})
