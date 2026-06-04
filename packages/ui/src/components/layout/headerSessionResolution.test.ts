import { describe, expect, test } from 'bun:test';
import type { Session } from '@opencode-ai/sdk/v2';
import { resolveHeaderCurrentSession } from './headerSessionResolution';

const session = (id: string, title: string): Session => ({
  id,
  title,
  time: { created: 1, updated: 1 },
  version: '1',
}) as Session;

describe('resolveHeaderCurrentSession', () => {
  test('prefers the synced current session over global fallback', () => {
    const synced = session('ses_a', 'live');
    const global = session('ses_a', 'stale');

    expect(resolveHeaderCurrentSession({
      currentSessionId: 'ses_a',
      syncedSession: synced,
      globalSession: global,
      fallbackSessions: [],
    })).toBe(synced);
  });

  test('uses the global current-session fallback when sync has not loaded it', () => {
    const global = session('ses_a', 'global');

    expect(resolveHeaderCurrentSession({
      currentSessionId: 'ses_a',
      syncedSession: undefined,
      globalSession: global,
      fallbackSessions: [],
    })).toBe(global);
  });

  test('falls back to sync snapshots without subscribing to all live sessions', () => {
    const fallback = session('ses_a', 'snapshot');

    expect(resolveHeaderCurrentSession({
      currentSessionId: 'ses_a',
      syncedSession: undefined,
      globalSession: null,
      fallbackSessions: [session('other', 'other'), fallback],
    })).toBe(fallback);
  });
});
