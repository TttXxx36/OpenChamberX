import { resolveFileReferencePathCandidates } from '../../MarkdownRenderer.fileRefs';

type ToolFileStat = (path: string, options?: { directory?: string }) => Promise<{ isFile?: boolean } | null | undefined>;

export const resolveToolFilePathCandidatesForOpen = (currentDirectory: string, filePath: string): string[] => {
    return resolveFileReferencePathCandidates(currentDirectory, filePath);
};

export const resolveToolFilePathForOpen = (currentDirectory: string, filePath: string): string => {
    const candidates = resolveToolFilePathCandidatesForOpen(currentDirectory, filePath);
    return candidates[candidates.length - 1] ?? '';
};

export const selectToolFilePathForOpen = async (
    currentDirectory: string,
    filePath: string,
    statFile?: ToolFileStat,
): Promise<string> => {
    const candidates = resolveToolFilePathCandidatesForOpen(currentDirectory, filePath);
    if (candidates.length === 0) {
        return '';
    }

    if (statFile) {
        for (const candidate of candidates) {
            const stat = await statFile(candidate, { directory: currentDirectory }).catch(() => null);
            if (stat?.isFile) {
                return candidate;
            }
        }
    }

    return candidates[candidates.length - 1] ?? '';
};
