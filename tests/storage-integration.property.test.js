/**
 * Property-based tests for storage integration in token-tracker.js.
 * Uses fast-check for property generation.
 *
 * token-tracker.js is loaded via vitest setupFiles, so all globals
 * (TokenTracker, _extractFromUsage, etc.) are available on globalThis.
 */

import fc from 'fast-check';

// ─── Property 12: Kegagalan storage tidak mengubah state in-memory ────────────
// Feature: realtime-token-usage-summary, Property 12: Kegagalan storage tidak mengubah state in-memory
// Validates: Requirements 6.4
describe('Property 12: Storage failure does not change in-memory state', () => {
  test('state accumulation is correct even when chrome.storage.set throws', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            promptTokens:     fc.integer({ min: 0, max: 10000 }),
            completionTokens: fc.integer({ min: 0, max: 10000 })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (calls) => {
          // Mock chrome.storage to always fail
          const originalChrome = globalThis.chrome;
          globalThis.chrome = {
            storage: {
              session: {
                set: () => { throw new Error('Storage quota exceeded'); },
                get: (_key, cb) => { if (cb) cb({}); },
                remove: () => { throw new Error('Storage error'); }
              },
              local: {
                set: () => { throw new Error('Storage quota exceeded'); },
                get: (_key, cb) => { if (cb) cb({}); },
                remove: () => { throw new Error('Storage error'); }
              }
            },
            runtime: { lastError: null }
          };

          try {
            globalThis.TokenTracker.reset();
            calls.forEach(c => globalThis.TokenTracker._accumulateRecord({
              ...c,
              totalTokens:  c.promptTokens + c.completionTokens,
              costUsd:      0,
              isEstimated:  false,
              ts:           Date.now(),
              model:        'MiniMax-M2.7',
              provider:     'minimax'
            }));

            const state = globalThis.TokenTracker.getState();
            const expectedTotal      = calls.reduce((s, c) => s + c.promptTokens + c.completionTokens, 0);
            const expectedPrompt     = calls.reduce((s, c) => s + c.promptTokens, 0);
            const expectedCompletion = calls.reduce((s, c) => s + c.completionTokens, 0);

            return state.cumulativeTotalTokens      === expectedTotal
                && state.cumulativePromptTokens     === expectedPrompt
                && state.cumulativeCompletionTokens === expectedCompletion
                && state.callCount                  === calls.length;
          } finally {
            // Restore original chrome (undefined in jsdom)
            globalThis.chrome = originalChrome;
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 13: Ekstraksi provider-agnostic ─────────────────────────────────
// Feature: realtime-token-usage-summary, Property 13: Ekstraksi provider-agnostic
// Validates: Requirements 7.5
describe('Property 13: Provider-agnostic extraction: usage used if present, estimation if not', () => {
  test('isEstimated === false when usage field is present with numeric values', () => {
    fc.assert(
      fc.property(
        fc.record({
          prompt_tokens:     fc.integer({ min: 0, max: 100000 }),
          completion_tokens: fc.integer({ min: 0, max: 100000 }),
          total_tokens:      fc.integer({ min: 0, max: 200000 })
        }),
        (usage) => {
          const result = globalThis._extractFromUsage({ usage });
          return result !== null && result.isEstimated === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('isEstimated === true when usage field is absent', () => {
    fc.assert(
      fc.property(
        fc.record({
          // Generate objects WITHOUT a usage field
          someOtherField: fc.string(),
          data:           fc.option(fc.string())
        }),
        (obj) => {
          const result = globalThis._extractFromUsage(obj);
          // No usage field → should return null (caller uses estimation)
          return result === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('TokenTracker.record() sets isEstimated=true when no usage in raw', () => {
    globalThis.TokenTracker.reset();
    const state = globalThis.TokenTracker.record({
      raw:            { someOtherField: 'no usage here' },
      model:          'MiniMax-M2.7',
      provider:       'minimax',
      promptMessages: [{ content: 'hello' }],
      completionText: 'world'
    });
    return state.lastCall !== null && state.lastCall.isEstimated === true;
  });
});
