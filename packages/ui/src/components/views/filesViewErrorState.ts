export const shouldShowFilesViewRetry = ({
  fileError,
  selectedPath,
  fileLoading,
}: {
  fileError: string | null;
  selectedPath: string | null | undefined;
  fileLoading: boolean;
}): boolean => Boolean(fileError && selectedPath && !fileLoading);
