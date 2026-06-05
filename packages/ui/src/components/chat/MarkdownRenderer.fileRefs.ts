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

export const resolveFileReferencePathCandidates = (baseDirectory: string, targetPath: string): string[] => {
  const primary = resolveFileReferencePath(baseDirectory, targetPath);
  if (!primary || isAbsoluteFileReferencePath(normalizeFileReferencePath(targetPath))) {
    return primary ? [primary] : [];
  }

  const normalizedBase = normalizeFileReferencePath(baseDirectory);
  const normalizedTarget = normalizeFileReferencePath(targetPath);
  const isWindowsDriveBase = /^[A-Za-z]:/.test(normalizedBase);
  const baseParts = (isWindowsDriveBase ? normalizedBase.slice(2) : normalizedBase).split('/').filter(Boolean);
  const targetParts = normalizedTarget.split('/').filter(Boolean);
  const baseName = baseParts[baseParts.length - 1] ?? '';
  const firstTargetPart = targetParts[0] ?? '';
  const matchesBaseName = isWindowsDriveBase
    ? firstTargetPart.toLowerCase() === baseName.toLowerCase()
    : firstTargetPart === baseName;

  if (!baseName || !matchesBaseName || targetParts.length < 2) {
    return [primary];
  }

  const fallback = resolveFileReferencePath(baseDirectory, targetParts.slice(1).join('/'));
  return fallback && fallback !== primary ? [primary, fallback] : [primary];
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

const KNOWN_FILE_BASENAMES = new Set([
  'dockerfile',
  'makefile',
  'readme',
  'license',
  '.env',
  '.gitignore',
  '.npmrc',
]);

const trimPathCandidate = (value: string): string => {
  let next = (value || '').trim();
  if (!next) {
    return '';
  }

  if ((next.startsWith('`') && next.endsWith('`')) || (next.startsWith('"') && next.endsWith('"')) || (next.startsWith("'") && next.endsWith("'"))) {
    next = next.slice(1, -1).trim();
  }

  return next.replace(/[.,;!?]+$/g, '');
};

const hasFileExtension = (path: string): boolean => {
  const base = path.split('/').filter(Boolean).pop() ?? '';
  if (!base || base.endsWith('.')) {
    return false;
  }
  return /\.[A-Za-z0-9_-]{1,16}$/.test(base);
};

export const isLikelyLocalFileReference = (value: string): boolean => {
  const candidate = trimPathCandidate(value);
  if (!candidate || candidate.startsWith('--') || candidate.includes('://')) {
    return false;
  }

  if (/[<>]/.test(candidate) || /\s{2,}/.test(candidate)) {
    return false;
  }

  const normalized = normalizeFileReferencePath(candidate.replace(/#.*$/, '').replace(/;.*$/, ''));
  const withoutLineSuffix = normalized.replace(/^(.*\.[A-Za-z0-9_-]{1,16}):(\d+)(?::\d+)?$/, '$1');
  const baseName = withoutLineSuffix.split('/').filter(Boolean).pop() ?? withoutLineSuffix;
  if (!baseName || baseName === '.' || baseName === '..') {
    return false;
  }

  const base = baseName.toLowerCase();
  return KNOWN_FILE_BASENAMES.has(base) || (base.startsWith('.') && base.length > 1) || hasFileExtension(withoutLineSuffix);
};

export const getFileReferenceCandidateFromAnchor = (href: string | null | undefined, text: string | null | undefined): string => {
  const hrefCandidate = trimPathCandidate(href ?? '');
  if (hrefCandidate && isLikelyLocalFileReference(hrefCandidate)) {
    return hrefCandidate;
  }

  const textCandidate = trimPathCandidate(text ?? '');
  if (!textCandidate || !isLikelyLocalFileReference(textCandidate)) {
    return '';
  }

  if (!hrefCandidate || hrefCandidate.startsWith('openchamber-ui://')) {
    return textCandidate;
  }

  return '';
};
