import { useUIStore } from '@/stores/useUIStore';
import { updateDesktopSettings } from '@/lib/persistence';
import type { DesktopSettings } from '@/lib/desktop';

// Fields in UIStore that affect appearance / desktop settings persistence.
const APPEARANCE_FIELDS = new Set([
  'showReasoningTraces', 'collapsibleThinkingBlocks', 'showDeletionDialog',
  'nativeNotificationsEnabled', 'notificationMode',
  'notifyOnSubtasks', 'notifyOnCompletion', 'notifyOnError', 'notifyOnQuestion',
  'notificationTemplates',
  'summarizeLastMessage', 'summaryThreshold', 'summaryLength', 'maxLastMessageLength',
  'autoDeleteEnabled', 'autoDeleteAfterDays', 'sessionRetentionAction',
  'fontSize', 'terminalFontSize', 'uiFont', 'monoFont',
  'padding', 'cornerRadius', 'inputBarOffset', 'mobileKeyboardMode',
  'diffLayoutPreference', 'diffViewMode', 'gitChangesViewMode',
] as const);

/** Selector — extracts only the appearance-relevant fields. */
const appearanceSelector = (state: ReturnType<typeof useUIStore.getState>) => {
  const slice: Record<string, unknown> = {};
  for (const key of APPEARANCE_FIELDS) {
    slice[key] = (state as unknown as Record<string, unknown>)[key];
  }
  return slice;
};

/** Structural equality comparison for the appearance slice (handles nested templates object). */
const appearanceEqual = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
  for (const key of APPEARANCE_FIELDS) {
    if (key === 'notificationTemplates') {
      if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) return false;
    } else if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
};

/** Compute the diff between two appearance slices, returning only changed fields. */
const appearanceDiff = (
  current: Record<string, unknown>,
  previous: Record<string, unknown>,
): Partial<DesktopSettings> => {
  const diff: Partial<DesktopSettings> = {};
  for (const key of APPEARANCE_FIELDS) {
    if (key === 'notificationTemplates') {
      if (JSON.stringify(current[key]) !== JSON.stringify(previous[key])) {
        (diff as Record<string, unknown>)[key] = current[key];
      }
    } else if (current[key] !== previous[key]) {
      (diff as Record<string, unknown>)[key] = current[key];
    }
  }
  return diff;
};

let initialized = false;

export const startAppearanceAutoSave = (): void => {
  if (initialized || typeof window === 'undefined') {
    return;
  }

  initialized = true;

  let previous = appearanceSelector(useUIStore.getState());

  let pending: Partial<DesktopSettings> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    const payload = pending;
    pending = null;
    timer = null;
    if (payload && Object.keys(payload).length > 0) {
      void updateDesktopSettings(payload);
    }
  };

  const schedule = (changes: Partial<DesktopSettings>) => {
    pending = { ...(pending ?? {}), ...changes };
    if (timer) {
      return;
    }
    timer = setTimeout(flush, 150);
  };

  // Subscribe only to appearance-relevant fields using subscribeWithSelector.
  // The callback fires only when one of the selected fields actually changes.
  useUIStore.subscribe(
    appearanceSelector,
    (current) => {
      const diff = appearanceDiff(current, previous);
      previous = current;
      if (Object.keys(diff).length > 0) {
        schedule(diff);
      }
    },
    { equalityFn: appearanceEqual },
  );
};
