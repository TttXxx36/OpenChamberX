import React from 'react';
import { Icon } from '@/components/icon/Icon';
import { useUIStore } from '@/stores/useUIStore';
import { useConfigStore } from '@/stores/useConfigStore';
import { useGitBranchLabel } from '@/stores/useGitStore';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSessionUIStore } from '@/sync/session-ui-store';
import { cn } from '@/lib/utils';
import type { SessionContextUsage } from '@/stores/types/sessionTypes';

/**
 * StatusBar — a 28px bar at the bottom of the main layout,
 * modelled after the VS Code status bar pattern.
 *
 * Left section: git branch, current agent.
 * Right section: model name, token count, connection indicator.
 */
export const StatusBar: React.FC = () => {
  /* ── Git branch ─────────────────────────────────────────── */
  const activeProject = useProjectsStore((state) => {
    if (!state.activeProjectId) return null;
    return state.projects.find((p) => p.id === state.activeProjectId) ?? null;
  });
  const openDirectory = activeProject?.path ?? null;
  const gitBranch = useGitBranchLabel(openDirectory);

  /* ── Agent name ─────────────────────────────────────────── */
  const currentAgentName = useConfigStore((state) => state.currentAgentName);

  /* ── Current model (reactive: re-renders when model changes) ─── */
  const currentProviderId = useConfigStore((state) => state.currentProviderId);
  const currentModelId = useConfigStore((state) => state.currentModelId);
  const providers = useConfigStore((state) => state.providers);
  const currentModel = React.useMemo(() => {
    const provider = providers.find((p) => p.id === currentProviderId);
    if (!provider) return undefined;
    return provider.models.find((m) => m.id === currentModelId);
  }, [providers, currentProviderId, currentModelId]);
  const modelName = currentModel?.name ?? currentModel?.id ?? '';

  /* ── Connection status ──────────────────────────────────── */
  const isConnected = useConfigStore((state) => state.isConnected);

  /* ── Token usage (basic count from the current session) ─── */
  const getContextUsage = useSessionUIStore((state) => state.getContextUsage);
  const currentSessionId = useSessionUIStore((state) => state.currentSessionId);

  /* Retry mechanism for async-loaded tokens:
   * getContextUsage returns null until sync messages arrive via SSE.
   * We poll briefly after session switch so tokens appear automatically. */
  const [retryKey, setRetryKey] = React.useState(0);
  React.useEffect(() => {
    if (!currentSessionId) return;
    let cancelled = false;
    let attempts = 0;
    const poll = () => {
      if (cancelled || attempts >= 8) return;
      attempts++;
      setRetryKey((k) => k + 1);
      setTimeout(poll, 600);
    };
    const timer = setTimeout(poll, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentSessionId, getContextUsage]);

  const tokenUsage: SessionContextUsage | null = React.useMemo(() => {
    const limit =
      currentModel &&
      typeof currentModel.limit === 'object' &&
      currentModel.limit !== null
        ? (currentModel.limit as Record<string, unknown>)
        : null;
    const contextLimit =
      limit && typeof limit.context === 'number' ? limit.context : 0;
    const outputLimit =
      limit && typeof limit.output === 'number' ? limit.output : 0;
    return getContextUsage(contextLimit, outputLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentModel, getContextUsage, currentSessionId, retryKey]);

  /* ── Actions ────────────────────────────────────────────── */
  const setActiveMainTab = useUIStore((state) => state.setActiveMainTab);

  const handleGitClick = React.useCallback(() => {
    setActiveMainTab('git');
  }, [setActiveMainTab]);

  return (
    <div
      className={
        'flex h-7 items-center justify-between bg-sidebar ' +
        'px-3 text-[11px] text-muted-foreground select-none shrink-0 ' +
        'border-t border-border/50'
      }
    >
      {/* ── Left section ─────────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {gitBranch && (
          <button
            onClick={handleGitClick}
            className={
              'flex items-center gap-1 hover:text-foreground ' +
              'transition-colors focus-visible:outline-none'
            }
            title={`Git branch: ${gitBranch}`}
          >
            <Icon name="git-branch" className="h-3.5 w-3.5" />
            <span>{gitBranch}</span>
          </button>
        )}

        {currentAgentName && (
          <span className="flex items-center gap-1">
            <Icon name="robot-2" className="h-3.5 w-3.5" />
            <span>{currentAgentName}</span>
          </span>
        )}
      </div>

      {/* ── Right section ────────────────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        {modelName && (
          <span
            className="flex items-center gap-1"
            title={`Model: ${modelName}`}
          >
            <Icon name="brain" className="h-3.5 w-3.5" />
            <span>{modelName}</span>
          </span>
        )}

        {tokenUsage != null && (
          <>
            <span className="text-[10px] text-muted-foreground/40">·</span>

            {/* Token usage: current / limit (percentage%) */}
            <span
              className="flex items-center gap-1"
              title={`${tokenUsage.totalTokens.toLocaleString()} / ${tokenUsage.contextLimit.toLocaleString()} tokens (${tokenUsage.percentage}%)`}
            >
              <span className="text-[10px]">tokens:</span>
              <span className="tabular-nums">
                {tokenUsage.totalTokens.toLocaleString()}
              </span>
              <span className="text-[10px]">/</span>
              <span className="tabular-nums">
                {tokenUsage.contextLimit.toLocaleString()}
              </span>
              <span className="text-[10px]">
                ({tokenUsage.percentage}%)
              </span>
            </span>

            {/* Cache percentage (if cache data is available) */}
            {tokenUsage.cacheRead != null && tokenUsage.cacheRead > 0 && tokenUsage.totalTokens > 0 && (
              <>
                <span className="text-[10px] text-muted-foreground/40">·</span>
                <span className="flex items-center gap-1 tabular-nums">
                  cache:{' '}
                  {Math.round(
                    (tokenUsage.cacheRead / tokenUsage.totalTokens) * 100,
                  )}
                  %
                </span>
              </>
            )}
          </>
        )}

        {/* Connection indicator */}
        <span
          className="flex items-center gap-1"
          title={isConnected ? 'Connected' : 'Disconnected'}
        >
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )}
          />
        </span>
      </div>
    </div>
  );
};

StatusBar.displayName = 'StatusBar';
