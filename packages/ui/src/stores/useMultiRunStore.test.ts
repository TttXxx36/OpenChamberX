import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { Session } from '@opencode-ai/sdk/v2';
import { registerRuntimeAPIs } from '@/contexts/runtimeAPIRegistry';

afterAll(() => {
  registerRuntimeAPIs(null);
  mock.restore();
});

const upsertedSessions: Session[] = [];
const registeredDirectories: Array<{ sessionID: string; directory: string }> = [];
const ensureChildCalls: Array<{ directory: string; bootstrap?: boolean }> = [];
const childState = {
  session: [] as Session[],
  sessionTotal: 0,
  limit: 5,
};
let currentDirectory = '/repo';

mock.module('@/lib/opencode/client', () => ({
  opencodeClient: {
    withDirectory: async (directory: string, fn: () => Promise<Session>) => {
      const previous = currentDirectory;
      currentDirectory = directory;
      try {
        return await fn();
      } finally {
        currentDirectory = previous;
      }
    },
    createSession: async (params?: { title?: string }): Promise<Session> => ({
      id: 'ses_multirun',
      title: params?.title ?? '',
      directory: currentDirectory,
      time: { created: 1, updated: 1 },
    } as Session),
  },
}));

mock.module('@/lib/worktrees/worktreeCreate', () => ({
  createWorktreeWithDefaults: mock(),
  resolveRootTrackingRemote: mock(() => Promise.resolve(null)),
}));

mock.module('@/lib/openchamberConfig', () => ({
  saveWorktreeSetupCommands: mock(() => Promise.resolve()),
}));

mock.module('./useDirectoryStore', () => ({
  useDirectoryStore: {
    getState: () => ({ currentDirectory: '/repo' }),
  },
}));

mock.module('./useProjectsStore', () => ({
  useProjectsStore: {
    getState: () => ({
      activeProjectId: 'project-1',
      projects: [{ id: 'project-1', path: '/repo' }],
    }),
  },
}));

mock.module('./useSnippetsStore', () => ({
  useSnippetsStore: {
    getState: () => ({
      expandText: (value: string) => Promise.resolve(value),
    }),
  },
}));

mock.module('./useGlobalSessionsStore', () => ({
  resolveGlobalSessionDirectory: () => null,
  useGlobalSessionsStore: {
    getState: () => ({
      upsertSession: (session: Session) => {
        upsertedSessions.push(session);
      },
    }),
  },
}));

mock.module('@/sync/sync-refs', () => ({
  setSyncRefs: () => undefined,
  registerSessionDirectory: (sessionID: string, directory: string) => {
    registeredDirectories.push({ sessionID, directory });
  },
  getSyncSDK: () => ({}),
  getSyncDirectory: () => '/repo',
  getSyncSessions: () => [],
  getAllSyncSessions: () => [],
  getSyncMessages: () => [],
  getSyncParts: () => [],
  getSyncSessionMaterializationStatus: () => ({ hasMessages: false, renderable: false, missingPartMessageIDs: [] }),
  getSyncSessionStatus: () => undefined,
  getSyncPermissions: () => [],
  getSyncQuestions: () => [],
  getDirectoryState: () => undefined,
  getSyncChildStores: () => ({
    children: new Map(),
    getState: () => undefined,
    ensureChild: (directory: string, options?: { bootstrap?: boolean }) => {
      ensureChildCalls.push({ directory, bootstrap: options?.bootstrap });
      return {
        setState: (updater: typeof childState | ((state: typeof childState) => Partial<typeof childState> | typeof childState)) => {
          const patch = typeof updater === 'function' ? updater(childState) : updater;
          if (patch !== childState) {
            Object.assign(childState, patch);
          }
        },
      };
    },
  }),
}));

const { useMultiRunStore } = await import('./useMultiRunStore');
mock.restore();

describe('useMultiRunStore', () => {
  beforeEach(() => {
    upsertedSessions.length = 0;
    registeredDirectories.length = 0;
    ensureChildCalls.length = 0;
    childState.session = [];
    childState.sessionTotal = 0;
    childState.limit = 5;
    currentDirectory = '/repo';
    registerRuntimeAPIs({
      git: {
        checkIsGitRepository: async () => false,
      },
    } as unknown as Parameters<typeof registerRuntimeAPIs>[0]);
    useMultiRunStore.setState({ isLoading: false, error: null });
  });

  test('registers created sessions without waiting for a sidebar refresh', async () => {
    const result = await useMultiRunStore.getState().createMultiRun({
      name: 'Fix thing',
      isolateRuns: false,
      groups: [{
        prompt: 'Fix it',
        models: [{ providerID: 'anthropic', modelID: 'claude-sonnet-4-5' }],
      }],
    });

    expect(result?.sessionIds).toEqual(['ses_multirun']);
    expect(upsertedSessions.map((session) => session.id)).toEqual(['ses_multirun']);
    expect(registeredDirectories).toEqual([{ sessionID: 'ses_multirun', directory: '/repo' }]);
    expect(ensureChildCalls).toEqual([{ directory: '/repo', bootstrap: false }]);
    expect(childState.session.map((session) => session.id)).toEqual(['ses_multirun']);
  });
});
