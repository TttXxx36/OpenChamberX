const normalizeSessionIdCandidate = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const readTaskSessionIdFromRecord = (value: unknown): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  return normalizeSessionIdCandidate(record.sessionID)
    ?? normalizeSessionIdCandidate(record.sessionId);
};

export const readTaskSessionIdFromOutput = (output: string | undefined): string | undefined => {
  if (typeof output !== 'string' || output.trim().length === 0) {
    return undefined;
  }

  const sessionMatch = output.match(/session[_\s-]?id\s*:\s*([^\s<"']+)/i);
  return normalizeSessionIdCandidate(sessionMatch?.[1]);
};
