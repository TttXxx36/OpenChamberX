export const normalizeFileReferencePath = (value: string): string => {
  const source = value.trim();
  if (!source) {
    return '';
  }

  const withSlashes = source.replace(/\\/g, '/');
  const hadUncPrefix = withSlashes.startsWith('//');
  let normalized = withSlashes.replace(/\/+/g, '/');
  if (hadUncPrefix && !normalized.startsWith('//')) {
    normalized = `/${normalized}`;
  }

  const isUnixRoot = normalized === '/';
  const isWindowsDriveRoot = /^[A-Za-z]:\/$/.test(normalized);
  if (!isUnixRoot && !isWindowsDriveRoot) {
    normalized = normalized.replace(/\/+$/, '');
  }

  return normalized;
};

const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_PATH_PATTERN = /^\\\\[^\\]+\\[^\\]+/;

export const isAbsoluteFileReferencePath = (value: string): boolean => {
  return value.startsWith('/') || WINDOWS_DRIVE_PATH_PATTERN.test(value) || WINDOWS_UNC_PATH_PATTERN.test(value);
};

export const getFileReferenceBaseDirectory = (input: {
  referenceDirectory?: string | null;
  effectiveDirectory?: string | null;
}): string => {
  return normalizeFileReferencePath(input.referenceDirectory ?? '')
    || normalizeFileReferencePath(input.effectiveDirectory ?? '');
};

export const resolveFileReferencePath = (baseDirectory: string, targetPath: string): string => {
  const normalizedTarget = normalizeFileReferencePath(targetPath);
  if (!normalizedTarget) {
    return '';
  }
  if (isAbsoluteFileReferencePath(normalizedTarget)) {
    return normalizedTarget;
  }

  const normalizedBase = normalizeFileReferencePath(baseDirectory);
  if (!normalizedBase) {
    return normalizedTarget;
  }

  const isWindowsDriveBase = /^[A-Za-z]:/.test(normalizedBase);
  const prefix = isWindowsDriveBase ? normalizedBase.slice(0, 2) : '';
  const baseRemainder = isWindowsDriveBase ? normalizedBase.slice(2) : normalizedBase;
  const stack = baseRemainder.split('/').filter(Boolean);
  const parts = normalizedTarget.split('/').filter(Boolean);
  for (const part of parts) {
    if (part === '.') {
      continue;
    }
    if (part === '..') {
      if (stack.length > 0) {
        stack.pop();
      }
      continue;
    }
    stack.push(part);
  }

  const joined = stack.join('/');
  if (prefix) {
    return joined ? `${prefix}/${joined}` : `${prefix}/`;
  }
  return `/${joined}`;
};

export const getFileReferenceContextDirectory = (baseDirectory: string, resolvedPath: string): string => {
  const normalizedBase = normalizeFileReferencePath(baseDirectory);
  const normalizedPath = normalizeFileReferencePath(resolvedPath);
  if (!normalizedPath) {
    return normalizedBase;
  }

  if (normalizedBase && (normalizedPath === normalizedBase || normalizedPath.startsWith(`${normalizedBase}/`))) {
    return normalizedBase;
  }

  const parent = normalizedPath.replace(/\/[^/]*$/, '');
  return parent || normalizedPath;
};
