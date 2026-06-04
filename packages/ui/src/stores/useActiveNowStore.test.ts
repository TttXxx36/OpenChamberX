import { describe, expect, test } from 'bun:test';
import { selectActiveNowEntries } from './useActiveNowStore';

describe('selectActiveNowEntries', () => {
  test('returns a stable empty list when recent sessions are hidden', () => {
    const entries = [{ sessionId: 'ses_a' }];

    const hidden = selectActiveNowEntries(entries, false);
    const hiddenAfterUpdate = selectActiveNowEntries([{ sessionId: 'ses_b' }], false);

    expect(hidden).toEqual([]);
    expect(hiddenAfterUpdate).toBe(hidden);
  });

  test('returns entries when recent sessions are visible', () => {
    const entries = [{ sessionId: 'ses_a' }];

    expect(selectActiveNowEntries(entries, true)).toBe(entries);
  });
});
