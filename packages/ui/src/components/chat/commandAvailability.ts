import { fuzzyMatch } from '@/lib/utils'
import type { I18nKey } from '@/lib/i18n'

export type CommandSource = 'openchamber' | 'opencode' | 'skill'

export interface CommandInfo {
  id: string
  name: string
  source: CommandSource
  description?: string
  agent?: string
  model?: string
  isBuiltIn?: boolean
  isOpenChamber?: boolean
  isSkill?: boolean
  scope?: string
}

type CommandMetadata = {
  name: string
  description?: string
  agent?: string | null
  model?: string | null
  source?: string
  scope?: string
}

type SkillMetadata = {
  name: string
  description?: string
  scope?: string
  source?: string
}

type BuildCommandAutocompleteCommandsInput = {
  searchQuery: string
  hasSession: boolean
  hasMessagesInCurrentSession: boolean
  canStartSessionCommand: boolean
  commandsWithMetadata: CommandMetadata[]
  skills: SkillMetadata[]
  t: (key: I18nKey) => string
}

export const hasMessagesForCommandAutocomplete = (messageCount: number): boolean => messageCount > 0

const buildOpenChamberCommands = ({
  hasSession,
  hasMessagesInCurrentSession,
  canStartSessionCommand,
  t,
}: Pick<BuildCommandAutocompleteCommandsInput, 'hasSession' | 'hasMessagesInCurrentSession' | 'canStartSessionCommand' | 't'>): CommandInfo[] => [
  ...(hasSession && !hasMessagesInCurrentSession
    ? [{ id: 'openchamber:init', name: 'init', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.initDescription'), isBuiltIn: true }]
    : []
  ),
  ...(hasSession
    ? [
        { id: 'openchamber:undo', name: 'undo', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.undoDescription'), isBuiltIn: true },
        { id: 'openchamber:redo', name: 'redo', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.redoDescription'), isBuiltIn: true },
        { id: 'openchamber:timeline', name: 'timeline', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.timelineDescription'), isBuiltIn: true },
      ]
    : []
  ),
  { id: 'openchamber:compact', name: 'compact', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.compactDescription'), isBuiltIn: true },
  ...(hasSession
    ? [{ id: 'openchamber:summary', name: 'summary', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.summaryDescription'), isOpenChamber: true }]
    : []
  ),
  ...(canStartSessionCommand
    ? [
        { id: 'openchamber:workspace-review', name: 'workspace-review', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.workspaceReviewDescription'), isOpenChamber: true },
        { id: 'openchamber:plan-feature', name: 'plan-feature', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.featurePlanDescription'), isOpenChamber: true },
        { id: 'openchamber:catch-up', name: 'catch-up', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.catchUpDescription'), isOpenChamber: true },
        { id: 'openchamber:debug', name: 'debug', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.debugDescription'), isOpenChamber: true },
        { id: 'openchamber:weigh', name: 'weigh', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.weighDescription'), isOpenChamber: true },
        { id: 'openchamber:explore', name: 'explore', source: 'openchamber' as const, description: t('chat.commandAutocomplete.command.exploreDescription'), isOpenChamber: true },
      ]
    : []
  ),
]

export const buildCommandAutocompleteCommands = ({
  searchQuery,
  hasSession,
  hasMessagesInCurrentSession,
  canStartSessionCommand,
  commandsWithMetadata,
  skills,
  t,
}: BuildCommandAutocompleteCommandsInput): CommandInfo[] => {
  const skillNames = new Set(skills.map((skill) => skill.name))
  const customCommands: CommandInfo[] = commandsWithMetadata.map((cmd, index) => ({
    id: `opencode:${cmd.scope ?? 'global'}:${cmd.name}:${cmd.agent ?? ''}:${cmd.model ?? ''}:${index}`,
    name: cmd.name,
    source: 'opencode',
    description: cmd.description,
    agent: cmd.agent ?? undefined,
    model: cmd.model ?? undefined,
    isBuiltIn: cmd.name === 'init' || cmd.name === 'review',
    isSkill: cmd.source === 'skill' || skillNames.has(cmd.name),
    scope: cmd.scope,
  }))
  const skillCommands: CommandInfo[] = skills.map((skill, index) => ({
    id: `skill:${skill.scope}:${skill.source ?? 'opencode'}:${skill.name}:${index}`,
    name: skill.name,
    source: 'skill',
    description: skill.description,
    isSkill: true,
    scope: skill.scope,
  }))
  const builtInCommands = buildOpenChamberCommands({ hasSession, hasMessagesInCurrentSession, canStartSessionCommand, t })
  const allCommands = [...builtInCommands, ...customCommands, ...skillCommands]
  const allowInitCommand = !hasMessagesInCurrentSession
  const filtered = (searchQuery
    ? allCommands.filter((cmd) => fuzzyMatch(cmd.name, searchQuery) || (cmd.description && fuzzyMatch(cmd.description, searchQuery)))
    : allCommands).filter((cmd) => allowInitCommand || cmd.name !== 'init')

  return filtered.sort((a, b) => {
    const aStartsWith = a.name.toLowerCase().startsWith(searchQuery.toLowerCase())
    const bStartsWith = b.name.toLowerCase().startsWith(searchQuery.toLowerCase())
    if (aStartsWith && !bStartsWith) return -1
    if (!aStartsWith && bStartsWith) return 1
    return a.name.localeCompare(b.name)
  })
}
