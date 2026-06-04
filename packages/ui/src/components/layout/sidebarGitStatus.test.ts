import { describe, expect, test } from 'bun:test';
import {
  buildSidebarFolderBadgeIndex,
  buildSidebarGitStatusIndex,
  getSidebarFileStatus,
} from './sidebarGitStatus';

describe('sidebarGitStatus', () => {
  test('builds a path-keyed status index for file rows', () => {
    const statusByPath = buildSidebarGitStatusIndex([
      { path: 'src/changed.ts', index: ' ', working_dir: 'M' },
      { path: 'src/new.ts', index: 'A', working_dir: ' ' },
      { path: 'src/removed.ts', index: 'D', working_dir: ' ' },
    ]);

    expect(statusByPath.get('src/changed.ts')).toBe('git-modified');
    expect(statusByPath.get('src/new.ts')).toBe('git-added');
    expect(statusByPath.get('src/removed.ts')).toBe('git-deleted');
  });

  test('prefers open file status over git status', () => {
    const statusByPath = buildSidebarGitStatusIndex([
      { path: 'src/changed.ts', index: ' ', working_dir: 'M' },
    ]);

    expect(getSidebarFileStatus('/repo/src/changed.ts', '/repo', new Set(['/repo/src/changed.ts']), statusByPath)).toBe('open');
  });

  test('builds folder badge counts for ancestor directories', () => {
    const badges = buildSidebarFolderBadgeIndex([
      { path: 'src/features/changed.ts', index: ' ', working_dir: 'M' },
      { path: 'src/features/new.ts', index: '?', working_dir: '?' },
      { path: 'docs/readme.md', index: 'A', working_dir: ' ' },
    ]);

    expect(badges.get('src')).toEqual({ modified: 1, added: 1 });
    expect(badges.get('src/features')).toEqual({ modified: 1, added: 1 });
    expect(badges.get('docs')).toEqual({ modified: 0, added: 1 });
  });

  test('does not create a badge entry for file paths', () => {
    const badges = buildSidebarFolderBadgeIndex([
      { path: 'src/features/changed.ts', index: ' ', working_dir: 'M' },
    ]);

    expect(badges.has('src/features/changed.ts')).toBe(false);
  });
});
