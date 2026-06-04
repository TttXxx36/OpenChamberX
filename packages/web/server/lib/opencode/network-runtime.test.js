import { afterEach, describe, expect, it, vi } from 'vitest';

import { createOpenCodeNetworkRuntime } from './network-runtime.js';

const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    writable: true,
    value,
  });
}

const createRuntime = () => createOpenCodeNetworkRuntime({
  state: {
    openCodePort: 4096,
    openCodeBaseUrl: null,
    openCodeApiPrefix: '',
    openCodeApiPrefixDetected: false,
    openCodeApiDetectionTimer: null,
  },
  getOpenCodeAuthHeaders: () => ({}),
});

describe('OpenCode network runtime', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setGlobal('fetch', originalFetch);
    setGlobal('setTimeout', originalSetTimeout);
    setGlobal('clearTimeout', originalClearTimeout);
  });

  it('clears the probe abort timer when readiness fetch rejects', async () => {
    const activeTimers = new Set();
    setGlobal('setTimeout', (handler, timeout, ...args) => {
      const timer = originalSetTimeout(() => {
        activeTimers.delete(timer);
        handler(...args);
      }, timeout);
      activeTimers.add(timer);
      return timer;
    });
    setGlobal('clearTimeout', (timer) => {
      activeTimers.delete(timer);
      return originalClearTimeout(timer);
    });
    setGlobal('fetch', vi.fn(async () => {
      throw new Error('offline');
    }));

    const runtime = createRuntime();
    const readyPromise = runtime.waitForReady('http://127.0.0.1:4096', 1);

    await expect(readyPromise).resolves.toBe(false);

    expect(activeTimers.size).toBe(0);
  });
});
