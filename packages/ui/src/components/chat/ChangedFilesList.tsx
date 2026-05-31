import React from 'react';
import { FileTypeIcon } from '@/components/icons/FileTypeIcon';
import { type ChangedFileEntry, getDisplayPath, getFileStats } from './changedFiles';
import { useI18n } from '@/lib/i18n';

interface ChangedFilesListProps {
    files: ChangedFileEntry[];
    currentDirectory: string;
    onOpenFile: (file: ChangedFileEntry) => void;
}

interface ChangedFileRowProps {
    file: ChangedFileEntry;
    currentDirectory: string;
    onOpenFile: (file: ChangedFileEntry) => void;
}

const ChangedFileRow: React.FC<ChangedFileRowProps> = React.memo(({ file, currentDirectory, onOpenFile }) => {
    const { t } = useI18n();
    const { fileName, dirPart } = getDisplayPath(file, currentDirectory);
    const stats = getFileStats(file);

    const handleClick = React.useCallback(() => {
        onOpenFile(file);
    }, [file, onOpenFile]);

    return (
        <button
            type="button"
            className="relative flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1 typography-ui-label outline-hidden select-none text-left hover:bg-interactive-hover"
            title={t('chat.changedFiles.actions.openFileTitle', { path: file.path })}
            onClick={handleClick}
        >
            <FileTypeIcon filePath={file.path} className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="min-w-0 flex-1 flex items-baseline overflow-hidden" title={file.path}>
                {dirPart ? (
                    <>
                        <span
                            className="min-w-0 truncate text-muted-foreground"
                            style={{ direction: 'rtl', textAlign: 'left', unicodeBidi: 'plaintext' }}
                        >
                            {dirPart}
                        </span>
                        <span className="flex-shrink-0">
                            <span className="text-muted-foreground">/</span>
                            <span className="text-foreground">{fileName}</span>
                        </span>
                    </>
                ) : (
                    <span className="truncate text-foreground">{fileName}</span>
                )}
            </span>
            {(stats.additions > 0 || stats.deletions > 0) ? (
                <span className="flex-shrink-0 inline-flex items-baseline gap-1 text-[0.75rem] tabular-nums">
                    {stats.additions > 0 ? <span style={{ color: 'var(--status-success)' }}>+{stats.additions}</span> : null}
                    {stats.deletions > 0 ? <span style={{ color: 'var(--status-error)' }}>-{stats.deletions}</span> : null}
                </span>
            ) : null}
        </button>
    );
});

export const ChangedFilesList: React.FC<ChangedFilesListProps> = React.memo(({ files, currentDirectory, onOpenFile }) => {
    const { t } = useI18n();
    return (
        <>
            <div className="flex items-center gap-1.5 px-2 py-1 typography-ui-label font-medium text-muted-foreground">
                <span>{t('chat.changedFiles.title')}</span>
                <span className="typography-meta tabular-nums">{files.length}</span>
            </div>

            <div className="max-h-[260px] overflow-y-auto">
                {files.map((file, index) => (
                    <ChangedFileRow
                        key={`${file.path}:${index}`}
                        file={file}
                        currentDirectory={currentDirectory}
                        onOpenFile={onOpenFile}
                    />
                ))}
            </div>
        </>
    );
});
