import { useUIStore } from '@/stores/useUIStore';
import { updateDesktopSettings } from '@/lib/persistence';
import { isVSCodeRuntime } from '@/lib/desktop';

type ModelRef = { providerID: string; modelID: string };

/** Selector — extracts only the model-preference fields relevant to auto-save. */
const modelPrefsSelector = (state: ReturnType<typeof useUIStore.getState>) => ({
  favoriteModels: state.favoriteModels,
  recentModels: state.recentModels,
});

const refsEqual = (a: ModelRef[], b: ModelRef[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]?.providerID !== b[i]?.providerID) return false;
    if (a[i]?.modelID !== b[i]?.modelID) return false;
  }
  return true;
};

const modelPrefsEqual = (
  a: { favoriteModels: ModelRef[]; recentModels: ModelRef[] },
  b: { favoriteModels: ModelRef[]; recentModels: ModelRef[] },
): boolean =>
  refsEqual(a.favoriteModels, b.favoriteModels) && refsEqual(a.recentModels, b.recentModels);

export const startModelPrefsAutoSave = () => {
  if (typeof window === 'undefined') {
    return () => {};
  }
  if (isVSCodeRuntime()) {
    return () => {};
  }

  let timer: number | null = null;
  let lastSent: { favoriteModels: ModelRef[]; recentModels: ModelRef[] } | null = null;
  let didSkipInitial = false;

  const flush = () => {
    timer = null;
    const { favoriteModels, recentModels } = useUIStore.getState();
    const payload = { favoriteModels, recentModels };

    if (
      lastSent &&
      refsEqual(lastSent.favoriteModels, payload.favoriteModels) &&
      refsEqual(lastSent.recentModels, payload.recentModels)
    ) {
      return;
    }

    lastSent = {
      favoriteModels: payload.favoriteModels.slice(),
      recentModels: payload.recentModels.slice(),
    };

    void updateDesktopSettings(payload).catch(() => {});
  };

  const schedule = () => {
    if (!didSkipInitial) {
      didSkipInitial = true;
      return;
    }
    if (timer !== null) {
      window.clearTimeout(timer);
    }
    timer = window.setTimeout(flush, 1200);
  };

  // Subscribe only to model-preference fields using subscribeWithSelector.
  // The callback fires only when favoriteModels or recentModels actually changes.
  const unsubscribe = useUIStore.subscribe(
    modelPrefsSelector,
    () => {
      schedule();
    },
    { equalityFn: modelPrefsEqual },
  );

  return () => {
    unsubscribe();
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  };
};
