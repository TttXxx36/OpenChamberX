import { describe, expect, test } from 'bun:test';

import {
  getFileReferenceCandidateFromAnchor,
  getFileReferenceBaseDirectory,
  getFileReferenceContextDirectory,
  resolveFileReferencePathCandidates,
  resolveFileReferencePath,
} from './MarkdownRenderer.fileRefs';

describe('markdown file reference path resolution', () => {
  test('uses the message reference directory instead of the active effective directory', () => {
    const baseDirectory = getFileReferenceBaseDirectory({
      referenceDirectory: '/repo/OpenChamberX',
      effectiveDirectory: '/repo/OtherProject',
    });

    expect(baseDirectory).toBe('/repo/OpenChamberX');
    expect(resolveFileReferencePath(baseDirectory, 'packages/ui/src/components/chat/MarkdownRendererImpl.tsx'))
      .toBe('/repo/OpenChamberX/packages/ui/src/components/chat/MarkdownRendererImpl.tsx');
  });

  test('falls back to the active effective directory when no reference directory is available', () => {
    const baseDirectory = getFileReferenceBaseDirectory({
      referenceDirectory: '',
      effectiveDirectory: '/repo/ActiveProject',
    });

    expect(baseDirectory).toBe('/repo/ActiveProject');
    expect(resolveFileReferencePath(baseDirectory, 'src/index.ts'))
      .toBe('/repo/ActiveProject/src/index.ts');
  });

  test('normalizes dot segments in relative references', () => {
    expect(resolveFileReferencePath('/repo/OpenChamberX/packages/ui', '../web/src/main.tsx'))
      .toBe('/repo/OpenChamberX/packages/web/src/main.tsx');
  });

  test('offers a repo-basename fallback without changing primary relative resolution', () => {
    expect(resolveFileReferencePath('D:/Documents/Opencode/OpenChamberX', 'OpenChamberX/packages/ui/src/components/chat/ChatMessage.tsx'))
      .toBe('D:/Documents/Opencode/OpenChamberX/OpenChamberX/packages/ui/src/components/chat/ChatMessage.tsx');

    expect(resolveFileReferencePathCandidates('D:/Documents/Opencode/OpenChamberX', 'OpenChamberX/packages/ui/src/components/chat/ChatMessage.tsx'))
      .toEqual([
        'D:/Documents/Opencode/OpenChamberX/OpenChamberX/packages/ui/src/components/chat/ChatMessage.tsx',
        'D:/Documents/Opencode/OpenChamberX/packages/ui/src/components/chat/ChatMessage.tsx',
      ]);
  });

  test('does not offer case-insensitive repo-basename fallbacks for Unix paths', () => {
    expect(resolveFileReferencePathCandidates('/repo/OpenChamberX', 'openchamberx/src/index.ts'))
      .toEqual(['/repo/OpenChamberX/openchamberx/src/index.ts']);
  });

  test('keeps legitimate nested same-name folders as the primary candidate', () => {
    expect(resolveFileReferencePathCandidates('/repo/OpenChamberX', 'OpenChamberX/src/index.ts')[0])
      .toBe('/repo/OpenChamberX/OpenChamberX/src/index.ts');
  });

  test('uses file parent as context when an absolute path is outside the base directory', () => {
    expect(getFileReferenceContextDirectory('/repo/OpenChamberX', '/repo/OtherProject/src/index.ts'))
      .toBe('/repo/OtherProject/src');
  });

  test('uses relative anchor hrefs as local file candidates before async annotation completes', () => {
    expect(getFileReferenceCandidateFromAnchor('install.md', 'Install guide'))
      .toBe('install.md');
  });

  test('falls back to anchor text for OpenChamber UI relative link navigations', () => {
    expect(getFileReferenceCandidateFromAnchor('openchamber-ui://app/install.md', 'install.md'))
      .toBe('install.md');
  });
});
