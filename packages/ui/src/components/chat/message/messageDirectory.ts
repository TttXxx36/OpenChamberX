export const resolveMessageReferenceDirectory = (
  messageDirectory: string | null | undefined,
  fallbackDirectory: string | null | undefined,
): string => {
  const fromMessage = typeof messageDirectory === 'string' ? messageDirectory.trim() : '';
  if (fromMessage) {
    return fromMessage;
  }

  return typeof fallbackDirectory === 'string' ? fallbackDirectory.trim() : '';
};
