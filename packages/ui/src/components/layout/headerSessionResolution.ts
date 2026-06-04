import type { Session } from '@opencode-ai/sdk/v2';

export const resolveHeaderCurrentSession = ({
  currentSessionId,
  syncedSession,
  globalSession,
  fallbackSessions,
}: {
  currentSessionId: string | null | undefined;
  syncedSession: Session | null | undefined;
  globalSession: Session | null | undefined;
  fallbackSessions: Session[] | (() => Session[]);
}): Session | null => {
  if (!currentSessionId) return null;
  if (syncedSession) return syncedSession;
  if (globalSession) return globalSession;
  const sessions = typeof fallbackSessions === 'function' ? fallbackSessions() : fallbackSessions;
  return sessions.find((session) => session.id === currentSessionId) ?? null;
};
