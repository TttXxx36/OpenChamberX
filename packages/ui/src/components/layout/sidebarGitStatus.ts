export type SidebarFileStatus = 'open' | 'modified' | 'git-modified' | 'git-added' | 'git-deleted';

export type SidebarGitFile = {
  path: string;
  index?: string;
  working_dir?: string;
};

export type SidebarFolderBadge = { modified: number; added: number };

const getRelativePath = (root: string, path: string): string => {
  if (!root) return path;
  return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
};

const getGitFileStatus = (file: SidebarGitFile): SidebarFileStatus | null => {
  if (file.index === 'A' || file.working_dir === '?') return 'git-added';
  if (file.index === 'D') return 'git-deleted';
  if (file.index === 'M' || file.working_dir === 'M') return 'git-modified';
  return null;
};

export const buildSidebarGitStatusIndex = (files: SidebarGitFile[] | null | undefined): Map<string, SidebarFileStatus> => {
  const result = new Map<string, SidebarFileStatus>();
  for (const file of files ?? []) {
    const status = getGitFileStatus(file);
    if (status) result.set(file.path, status);
  }
  return result;
};

export const getSidebarFileStatus = (
  path: string,
  root: string,
  openContextFilePaths: Set<string>,
  statusByPath: Map<string, SidebarFileStatus>,
): SidebarFileStatus | null => {
  if (openContextFilePaths.has(path)) return 'open';
  return statusByPath.get(getRelativePath(root, path)) ?? null;
};

export const buildSidebarFolderBadgeIndex = (files: SidebarGitFile[] | null | undefined): Map<string, SidebarFolderBadge> => {
  const result = new Map<string, SidebarFolderBadge>();

  const addToAncestor = (directory: string, file: SidebarGitFile) => {
    const current = result.get(directory) ?? { modified: 0, added: 0 };
    if (file.index === 'M' || file.working_dir === 'M') current.modified++;
    if (file.index === 'A' || file.working_dir === '?') current.added++;
    result.set(directory, current);
  };

  for (const file of files ?? []) {
    const segments = file.path.split('/').filter(Boolean);
    for (let index = 1; index < segments.length; index++) {
      addToAncestor(segments.slice(0, index).join('/'), file);
    }
  }

  return result;
};
