import { describe, expect, test } from 'bun:test';
import { shouldShowFilesViewRetry } from './filesViewErrorState';

describe('shouldShowFilesViewRetry', () => {
  test('shows retry only when a selected file has a load error', () => {
    expect(shouldShowFilesViewRetry({ fileError: 'Failed', selectedPath: '/repo/a.ts', fileLoading: false })).toBe(true);
    expect(shouldShowFilesViewRetry({ fileError: null, selectedPath: '/repo/a.ts', fileLoading: false })).toBe(false);
    expect(shouldShowFilesViewRetry({ fileError: 'Failed', selectedPath: null, fileLoading: false })).toBe(false);
    expect(shouldShowFilesViewRetry({ fileError: 'Failed', selectedPath: '/repo/a.ts', fileLoading: true })).toBe(false);
  });
});
