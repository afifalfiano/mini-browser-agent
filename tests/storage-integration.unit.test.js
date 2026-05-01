/**
 * Unit tests for chrome.storage integration in TokenTracker.
 *
 * token-tracker.js is loaded via vitest setupFiles, so all globals
 * (TokenTracker, etc.) are available on globalThis.
 *
 * chrome is undefined in jsdom — we mock it per test.
 */

// Feature: realtime-token-usage-summary
// Unit tests for chrome.storage integration in TokenTracker

describe('TokenTracker storage integration', () => {
  let originalChrome;

  beforeEach(() => {
    originalChrome = globalThis.chrome;
    globalThis.TokenTracker.reset();
  });

  afterEach(() => {
    globalThis.chrome = originalChrome;
  });

  test('data is saved to chrome.storage after each record() call', () => {
    let savedData = null;
    globalThis.chrome = {
      storage: {
        session: {
          set: (data) => { savedData = data; },
          get: (_key, cb) => { if (cb) cb({}); },
          remove: () => {}
        }
      },
      runtime: { lastError: null }
    };

    globalThis.TokenTracker.record({
      raw: { usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } },
      model: 'MiniMax-M2.7',
      provider: 'minimax',
      promptMessages: [],
      completionText: ''
    });

    expect(savedData).not.toBeNull();
    expect(savedData.token_usage_session).toBeDefined();
    expect(savedData.token_usage_session.cumulativeTotalTokens).toBe(150);
  });

  test('loadFromStorage() restores state from chrome.storage', async () => {
    const savedState = {
      cumulativePromptTokens:     200,
      cumulativeCompletionTokens: 100,
      cumulativeTotalTokens:      300,
      cumulativeCostUsd:          0.00024,
      callCount:                  2,
      lastCall:                   null,
      hasEstimatedCalls:          false
    };

    globalThis.chrome = {
      storage: {
        session: {
          get: (_key, cb) => { if (cb) cb({ token_usage_session: savedState }); },
          set: () => {},
          remove: () => {}
        }
      },
      runtime: { lastError: null }
    };

    // Reset first, then load
    globalThis.TokenTracker.reset();
    await globalThis.TokenTracker.loadFromStorage();

    const state = globalThis.TokenTracker.getState();
    expect(state.cumulativeTotalTokens).toBe(300);
    expect(state.callCount).toBe(2);
    expect(state.cumulativeCostUsd).toBeCloseTo(0.00024, 10);
  });

  test('reset() removes data from chrome.storage', () => {
    let removedKey = null;
    globalThis.chrome = {
      storage: {
        session: {
          set: () => {},
          get: (_key, cb) => { if (cb) cb({}); },
          remove: (key) => { removedKey = key; }
        }
      },
      runtime: { lastError: null }
    };

    globalThis.TokenTracker.reset();
    expect(removedKey).toBe('token_usage_session');
  });

  test('loadFromStorage() starts with empty state when chrome.storage.get fails', async () => {
    globalThis.chrome = {
      storage: {
        session: {
          get: (_key, cb) => {
            // Simulate error by setting lastError
            if (cb) cb({});
          },
          set: () => {},
          remove: () => {}
        }
      },
      runtime: { lastError: { message: 'Storage unavailable' } }
    };

    await globalThis.TokenTracker.loadFromStorage();
    const state = globalThis.TokenTracker.getState();
    expect(state.cumulativeTotalTokens).toBe(0);
    expect(state.callCount).toBe(0);
  });
});
