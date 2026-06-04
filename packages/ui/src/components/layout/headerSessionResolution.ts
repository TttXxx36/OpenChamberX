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
  fallbackSessions: Session[];
}): Session | null => {
  if (!currentSessionId) return null;
  return syncedSession
    ?? globalSession
    ?? fallbackSessions.find((session) => session.id === currentSessionId)
    ?? null;
};
