export const resolveSubtaskPanelDirectory = (
  messageDirectory: string | null | undefined,
  activeDirectory: string | null | undefined,
): string => {
  const fromMessage = typeof messageDirectory === 'string' ? messageDirectory.trim() : '';
  if (fromMessage) {
    return fromMessage;
  }

  return typeof activeDirectory === 'string' ? activeDirectory.trim() : '';
};
