import { describe, expect, test } from 'bun:test';

import { resolveSubtaskPanelDirectory } from './subtaskPanel';

describe('subtask side panel routing', () => {
  test('uses the parent message directory instead of the active global directory', () => {
    expect(resolveSubtaskPanelDirectory('/repo/parent', '/repo/active'))
      .toBe('/repo/parent');
  });

  test('falls back to the active directory when the message directory is unavailable', () => {
    expect(resolveSubtaskPanelDirectory('', '/repo/active'))
      .toBe('/repo/active');
  });
});
