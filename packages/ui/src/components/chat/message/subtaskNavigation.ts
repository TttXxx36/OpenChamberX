import { resolveSubtaskPanelDirectory } from './subtaskPanel';

export type SetCurrentSession = (sessionId: string, directoryHint?: string | null) => void;

export const navigateToSubtaskSession = (params: {
  sessionId?: string | null;
  sessionDirectory?: string | null;
  currentDirectory?: string | null;
  setCurrentSession: SetCurrentSession;
}): boolean => {
  const sessionId = typeof params.sessionId === 'string' ? params.sessionId.trim() : '';
  if (!sessionId) return false;

  const directory = resolveSubtaskPanelDirectory(params.sessionDirectory, params.currentDirectory);
  if (!directory) return false;

  params.setCurrentSession(sessionId, directory);
  return true;
};
