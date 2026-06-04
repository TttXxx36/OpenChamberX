export type EmbeddedSessionChatConfig = {
  sessionId: string;
  directory: string | null;
  readOnly: boolean;
};

export type EmbeddedChatViewOptions = {
  readOnly: boolean;
  autoOpenDraft: false;
};

export const normalizeEmbeddedDirectory = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.replace(/\\/g, '/').replace(/\/+$/g, '');
};

export const readEmbeddedSessionChatConfigFromSearch = (search: string): EmbeddedSessionChatConfig | null => {
  const params = new URLSearchParams(search);
  if (params.get('ocPanel') !== 'session-chat') {
    return null;
  }

  const sessionIdRaw = params.get('sessionId');
  const sessionId = typeof sessionIdRaw === 'string' ? sessionIdRaw.trim() : '';
  if (!sessionId) {
    return null;
  }

  const directoryRaw = params.get('directory');
  const directory = typeof directoryRaw === 'string' && directoryRaw.trim().length > 0
    ? directoryRaw.trim()
    : null;

  return {
    sessionId,
    directory,
    readOnly: params.get('readOnly') === '1' || params.get('readOnly') === 'true',
  };
};

export const readEmbeddedSessionChatConfig = (): EmbeddedSessionChatConfig | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return readEmbeddedSessionChatConfigFromSearch(window.location.search);
};

export const resolveEmbeddedSyncDirectory = (
  embeddedSessionChat: EmbeddedSessionChatConfig | null,
  currentDirectory: string | null | undefined,
): string => {
  return embeddedSessionChat?.directory?.trim() || currentDirectory || '';
};

export const getEmbeddedChatViewOptions = (embeddedSessionChat: EmbeddedSessionChatConfig): EmbeddedChatViewOptions => ({
  readOnly: embeddedSessionChat.readOnly,
  autoOpenDraft: false,
});
