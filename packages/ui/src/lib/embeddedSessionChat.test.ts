import { describe, expect, test } from 'bun:test';

import {
  getEmbeddedChatViewOptions,
  readEmbeddedSessionChatConfigFromSearch,
  resolveEmbeddedSyncDirectory,
} from './embeddedSessionChat';

describe('embedded session chat', () => {
  test('reads session-chat query parameters', () => {
    expect(readEmbeddedSessionChatConfigFromSearch('?ocPanel=session-chat&sessionId=ses_child&directory=C%3A%2FRepo&readOnly=1')).toEqual({
      sessionId: 'ses_child',
      directory: 'C:/Repo',
      readOnly: true,
    });
  });

  test('does not open a new-session draft for embedded session chats', () => {
    expect(getEmbeddedChatViewOptions({ sessionId: 'ses_child', directory: '/repo', readOnly: true })).toEqual({
      readOnly: true,
      autoOpenDraft: false,
    });
  });

  test('uses embedded directory before current directory for sync bootstrap', () => {
    expect(resolveEmbeddedSyncDirectory({ sessionId: 'ses_child', directory: '/repo/child', readOnly: true }, '/repo/current')).toBe('/repo/child');
    expect(resolveEmbeddedSyncDirectory({ sessionId: 'ses_child', directory: null, readOnly: true }, '/repo/current')).toBe('/repo/current');
  });
});
