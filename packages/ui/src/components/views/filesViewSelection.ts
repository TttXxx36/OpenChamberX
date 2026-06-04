const normalizePath = (value: string): string => {
  if (!value) return '';

  const raw = value.replace(/\\/g, '/');
  const hadUncPrefix = raw.startsWith('//');
  let normalized = raw.replace(/\/+/g, '/');
  if (hadUncPrefix && !normalized.startsWith('//')) {
    normalized = `/${normalized}`;
  }

  const isUnixRoot = normalized === '/';
  const isWindowsDriveRoot = /^[A-Za-z]:\/$/.test(normalized);
  if (!isUnixRoot && !isWindowsDriveRoot) {
    normalized = normalized.replace(/\/+$/g, '');
  }
  return normalized;
};

export const normalizeFilesViewTargetPath = (targetPath: string | null | undefined): string => {
  if (typeof targetPath !== 'string') return '';
  return normalizePath(targetPath.trim());
};

export const resolveFilesViewEffectiveSelectedPath = (params: {
  targetPath?: string | null;
  selectedPath?: string | null;
  openPaths?: string[];
}): string | null => {
  const normalizedTargetPath = normalizeFilesViewTargetPath(params.targetPath);
  if (normalizedTargetPath) return normalizedTargetPath;
  return params.selectedPath ?? params.openPaths?.[0] ?? null;
};
