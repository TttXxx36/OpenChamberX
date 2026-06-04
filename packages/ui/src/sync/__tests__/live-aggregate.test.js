import { describe, expect, it } from 'bun:test'

import {
  aggregateLiveSessions,
  aggregateLiveSessionStatuses,
  areSessionListsEquivalent,
  areStatusMapsEquivalent,
  findLiveSession,
  findLiveSessionStatus,
} from '../live-aggregate.ts'
import { deriveLiveActiveNowSessions } from '../../components/session/sidebar/activitySections.ts'

const session = (id, directory, updated, extra = {}) => ({
  id,
  title: `${id}-title`,
  time: { created: updated - 1, updated, archived: undefined },
  directory,
  ...extra,
})

describe('live aggregate', () => {
  it('prefers the freshest live session snapshot across child stores', () => {
    const states = [
      {
        session: [session('ses-1', '/a', 10, { title: 'old' })],
        session_status: {},
      },
      {
        session: [session('ses-1', '/a', 25, { title: 'new' }), session('ses-2', '/b', 20)],
        session_status: {},
      },
    ]

    const sessions = aggregateLiveSessions(states)
    expect(sessions.map((item) => `${item.id}:${item.title}`)).toEqual(['ses-1:new', 'ses-2:ses-2-title'])
    expect(findLiveSession(states, 'ses-1')?.title).toBe('new')
  })

  it('prefers busy/retry statuses over stale idle snapshots', () => {
    const states = [
      {
        session: [],
        session_status: {
          'ses-1': { type: 'idle' },
          'ses-2': { type: 'idle' },
        },
      },
      {
        session: [],
        session_status: {
          'ses-1': { type: 'busy' },
          'ses-2': { type: 'retry', message: 'retrying' },
        },
      },
    ]

    const statuses = aggregateLiveSessionStatuses(states)
    expect(statuses['ses-1']?.type).toBe('busy')
    expect(statuses['ses-2']?.type).toBe('retry')
    expect(findLiveSessionStatus(states, 'ses-2')?.type).toBe('retry')
  })

  it('lets a fresher idle snapshot override a stale busy status', () => {
    const states = [
      {
        session: [session('ses-1', '/a', 10)],
        session_status: {
          'ses-1': { type: 'busy' },
        },
      },
      {
        session: [session('ses-1', '/a', 30)],
        session_status: {
          'ses-1': { type: 'idle' },
        },
      },
    ]

    const statuses = aggregateLiveSessionStatuses(states)
    expect(statuses['ses-1']?.type).toBe('idle')
    expect(findLiveSessionStatus(states, 'ses-1')?.type).toBe('idle')
  })

  it('indexes sessions once when aggregating statuses', () => {
    const sessions = Array.from({ length: 20 }, (_, index) => session(`ses-${index}`, '/a', index))
    let findCalls = 0
    Object.defineProperty(sessions, 'find', {
      configurable: true,
      value: (...args) => {
        findCalls += 1
        return Array.prototype.find.apply(sessions, args)
      },
    })

    const statuses = aggregateLiveSessionStatuses([
      {
        session: sessions,
        session_status: Object.fromEntries(sessions.map((item) => [item.id, { type: 'busy' }])),
      },
    ])

    expect(Object.keys(statuses)).toHaveLength(20)
    expect(findCalls).toBe(0)
  })

  it('does not index sessions for states without statuses', () => {
    const sessions = [session('ses-1', '/a', 10)]
    let iterations = 0
    Object.defineProperty(sessions, Symbol.iterator, {
      configurable: true,
      value: function* () {
        iterations += 1
        yield* Array.prototype[Symbol.iterator].call(this)
      },
    })

    const statuses = aggregateLiveSessionStatuses([
      {
        session: sessions,
        session_status: {},
      },
    ])

    expect(statuses).toEqual({})
    expect(iterations).toBe(0)
  })

  it('detects retry metadata changes in status maps', () => {
    const retryStatus = { type: 'retry', message: 'retrying|server|message', attempt: 1, next: 100 }

    expect(areStatusMapsEquivalent(
      { 'ses-1': retryStatus },
      { 'ses-1': { ...retryStatus } },
    )).toBe(true)

    expect(areStatusMapsEquivalent(
      { 'ses-1': retryStatus },
      { 'ses-1': { ...retryStatus, attempt: 2, next: 200 } },
    )).toBe(false)
  })

  it('detects worktree metadata changes in session lists', () => {
    const base = session('ses-1', '/a', 20, { project: { worktree: '/a/.worktrees/base' } })
    const changed = session('ses-1', '/a', 20, { project: { worktree: '/a/.worktrees/changed' } })

    expect(areSessionListsEquivalent([base], [changed])).toBe(false)
  })

  it('derives active-now sessions from live statuses instead of persisted history', () => {
    const sessions = [
      session('ses-1', '/a', 20),
      session('ses-2', '/b', 30),
      session('ses-3', '/c', 10, { time: { created: 9, updated: 10, archived: 50 } }),
      session('ses-4', '/d', 40, { parentID: 'ses-parent' }),
    ]

    const activeNow = deriveLiveActiveNowSessions(sessions, {
      'ses-1': { type: 'busy' },
      'ses-2': { type: 'retry', message: 'retrying' },
      'ses-3': { type: 'busy' },
      'ses-4': { type: 'busy' },
    })

    expect(activeNow.map((item) => item.id)).toEqual(['ses-2', 'ses-1'])
  })
})
