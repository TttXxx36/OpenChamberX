import { describe, expect, test } from 'bun:test';

import { normalizeFilesViewTargetPath, resolveFilesViewEffectiveSelectedPath } from './filesViewSelection';

describe('files view selection', () => {
  test('normalizes editor-only target paths', () => {
    expect(normalizeFilesViewTargetPath('C:\\Repo\\src\\file.ts')).toBe('C:/Repo/src/file.ts');
    expect(normalizeFilesViewTargetPath('/repo/src/file.ts///')).toBe('/repo/src/file.ts');
  });

  test('uses context target before persisted selected path', () => {
    expect(resolveFilesViewEffectiveSelectedPath({
      targetPath: '/outside/file.ts',
      selectedPath: '/repo/old.ts',
      openPaths: ['/repo/open.ts'],
    })).toBe('/outside/file.ts');
  });

  test('falls back to selected path then first open path', () => {
    expect(resolveFilesViewEffectiveSelectedPath({ targetPath: null, selectedPath: '/repo/selected.ts', openPaths: ['/repo/open.ts'] })).toBe('/repo/selected.ts');
    expect(resolveFilesViewEffectiveSelectedPath({ targetPath: null, selectedPath: null, openPaths: ['/repo/open.ts'] })).toBe('/repo/open.ts');
  });
});
