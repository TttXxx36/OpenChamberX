import { describe, expect, test } from 'bun:test';

import { resolveMessageReferenceDirectory } from './messageDirectory';

describe('message directory resolution', () => {
  test('uses the message session directory before the active fallback directory', () => {
    expect(resolveMessageReferenceDirectory('/repo/message', '/repo/active')).toBe('/repo/message');
  });

  test('falls back to the active directory when the message directory is missing', () => {
    expect(resolveMessageReferenceDirectory('', '/repo/active')).toBe('/repo/active');
    expect(resolveMessageReferenceDirectory(null, '/repo/active')).toBe('/repo/active');
  });

  test('trims both message and fallback directories', () => {
    expect(resolveMessageReferenceDirectory('  /repo/message  ', '/repo/active')).toBe('/repo/message');
    expect(resolveMessageReferenceDirectory('   ', '  /repo/active  ')).toBe('/repo/active');
  });
});
