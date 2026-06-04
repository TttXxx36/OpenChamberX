import { describe, expect, test } from 'bun:test';

import {
  getFileReferenceBaseDirectory,
  getFileReferenceContextDirectory,
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

  test('uses file parent as context when an absolute path is outside the base directory', () => {
    expect(getFileReferenceContextDirectory('/repo/OpenChamberX', '/repo/OtherProject/src/index.ts'))
      .toBe('/repo/OtherProject/src');
  });
});
