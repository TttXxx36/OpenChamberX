import { describe, expect, test } from 'bun:test';
import { canApplySessionFoldersDiskHydration } from './useSessionFoldersStore';

describe('canApplySessionFoldersDiskHydration', () => {
  test('skips stale disk hydration after local folder changes', () => {
    expect(canApplySessionFoldersDiskHydration({
      hydrationStartRevision: 1,
      currentRevision: 2,
      hasDiskData: true,
    })).toBe(false);
  });

  test('applies disk hydration when no local changes occurred', () => {
    expect(canApplySessionFoldersDiskHydration({
      hydrationStartRevision: 1,
      currentRevision: 1,
      hasDiskData: true,
    })).toBe(true);
  });

  test('skips disk hydration when disk has no data', () => {
    expect(canApplySessionFoldersDiskHydration({
      hydrationStartRevision: 1,
      currentRevision: 1,
      hasDiskData: false,
    })).toBe(false);
  });
});
