import { describe, expect, test } from 'bun:test';

import { navigateToSubtaskSession } from './subtaskNavigation';

describe('navigateToSubtaskSession', () => {
  test('switches the main chat to the child session in the parent directory', () => {
    const calls: Array<[string, string | null | undefined]> = [];
    const setCurrentSession = (sessionId: string, directoryHint?: string | null) => {
      calls.push([sessionId, directoryHint]);
    };

    const opened = navigateToSubtaskSession({
      sessionId: ' ses_child ',
      sessionDirectory: '/repo/parent',
      currentDirectory: '/repo/current',
      setCurrentSession,
    });

    expect(opened).toBe(true);
    expect(calls).toEqual([['ses_child', '/repo/parent']]);
  });

  test('falls back to current directory when parent directory is missing', () => {
    const calls: Array<[string, string | null | undefined]> = [];
    const setCurrentSession = (sessionId: string, directoryHint?: string | null) => {
      calls.push([sessionId, directoryHint]);
    };

    const opened = navigateToSubtaskSession({
      sessionId: 'ses_child',
      sessionDirectory: null,
      currentDirectory: '/repo/current',
      setCurrentSession,
    });

    expect(opened).toBe(true);
    expect(calls).toEqual([['ses_child', '/repo/current']]);
  });

  test('does not navigate without a session id or directory', () => {
    const calls: Array<[string, string | null | undefined]> = [];
    const setCurrentSession = (sessionId: string, directoryHint?: string | null) => {
      calls.push([sessionId, directoryHint]);
    };

    expect(navigateToSubtaskSession({ sessionId: '', sessionDirectory: '/repo', currentDirectory: '/repo', setCurrentSession })).toBe(false);
    expect(navigateToSubtaskSession({ sessionId: 'ses_child', sessionDirectory: null, currentDirectory: null, setCurrentSession })).toBe(false);
    expect(calls).toEqual([]);
  });
});
