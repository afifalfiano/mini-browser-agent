/**
 * Property-based tests for token-tracker.js internal functions.
 * Uses fast-check for property generation.
 *
 * token-tracker.js is loaded via vitest setupFiles, so all globals
 * (_extractFromUsage, _estimateTokens, _calculateCost, _formatTokenCount,
 *  _formatCost, PRICING_CONFIG, TokenTracker) are available on globalThis.
 */

import fc from 'fast-check';

// ─── Property 1: Ekstraksi token dari `usage` adalah identitas ────────────────
// Feature: realtime-token-usage-summary, Property 1: Ekstraksi token dari `usage` adalah identitas
// Validates: Requirements 1.1
describe('Property 1: Token extraction from `usage` is identity', () => {
  test('extracted values match usage fields exactly', () => {
    fc.assert(
      fc.property(
        fc.record({
          prompt_tokens:     fc.integer({ min: 0, max: 100000 }),
          completion_tokens: fc.integer({ min: 0, max: 100000 }),
          total_tokens:      fc.integer({ min: 0, max: 200000 })
        }),
        (usage) => {
          const result = globalThis._extractFromUsage({ usage });
          return (
            result !== null &&
            result.promptTokens     === usage.prompt_tokens &&
            result.completionTokens === usage.completion_tokens &&
            result.totalTokens      === usage.total_tokens &&
            result.isEstimated      === false
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Estimasi token berbasis karakter mengikuti formula ceil(n/4) ─
// Feature: realtime-token-usage-summary, Property 2: Estimasi token berbasis karakter mengikuti formula ceil(n/4)
// Validates: Requirements 1.2
describe('Property 2: Character-based token estimation follows ceil(n/4)', () => {
  test('_estimateTokens(s) === Math.ceil(s.length / 4) for any string', () => {
    fc.assert(
      fc.property(
        fc.string(),
        (s) => globalThis._estimateTokens(s) === Math.ceil(s.length / 4)
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: Kalkulasi biaya mengikuti formula pricing ────────────────────
// Feature: realtime-token-usage-summary, Property 5: Kalkulasi biaya mengikuti formula pricing
// Validates: Requirements 3.2
describe('Property 5: Cost calculation follows pricing formula', () => {
  test('_calculateCost matches (promptTokens/1000 * inputPer1k) + (completionTokens/1000 * outputPer1k)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.constantFrom('MiniMax-M2.7', 'MiniMax-M2.7-Pro', 'MiniMax-M2.5', 'MiniMax-M2.5-Pro'),
        (promptTokens, completionTokens, model) => {
          const pricing  = globalThis.PRICING_CONFIG[model];
          const expected = (promptTokens / 1000 * pricing.inputPer1k) +
                           (completionTokens / 1000 * pricing.outputPer1k);
          const actual   = globalThis._calculateCost(promptTokens, completionTokens, model);
          return Math.abs(actual - expected) < 1e-10;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 7: Format biaya selalu menghasilkan string USD dua desimal ──────
// Feature: realtime-token-usage-summary, Property 7: Format biaya selalu menghasilkan string USD dua desimal
// Validates: Requirements 3.5
describe('Property 7: Cost format always produces two-decimal USD string', () => {
  test('_formatCost(n) matches /^\\$\\d+\\.\\d{2}$/ for any non-negative float', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 9999, noNaN: true }),
        (n) => /^\$\d+\.\d{2}$/.test(globalThis._formatCost(n))
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 8: Format token count menggunakan pemisah ribuan ────────────────
// Feature: realtime-token-usage-summary, Property 8: Format token count menggunakan pemisah ribuan untuk n >= 1000
// Validates: Requirements 4.6
describe('Property 8: Token count format uses thousands separator', () => {
  test('_formatTokenCount(n) contains comma for n >= 1000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 10_000_000 }),
        (n) => globalThis._formatTokenCount(n).includes(',')
      ),
      { numRuns: 100 }
    );
  });

  test('_formatTokenCount(n) does not contain comma for n < 1000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        (n) => !globalThis._formatTokenCount(n).includes(',')
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3: Akumulasi token adalah jumlah dari semua panggilan ───────────
// Feature: realtime-token-usage-summary, Property 3: Akumulasi token adalah jumlah dari semua panggilan
// Validates: Requirements 2.1, 2.2, 2.3
describe('Property 3: Token accumulation equals sum of all calls', () => {
  test('cumulative totals match sum of individual records', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            promptTokens:     fc.integer({ min: 0, max: 10000 }),
            completionTokens: fc.integer({ min: 0, max: 10000 })
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (calls) => {
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
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 4: Reset mengembalikan semua akumulasi ke nol ───────────────────
// Feature: realtime-token-usage-summary, Property 4: Reset mengembalikan semua akumulasi ke nol
// Validates: Requirements 2.4
describe('Property 4: Reset returns all accumulations to zero', () => {
  test('all state fields are zero after reset', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 10000 }), { minLength: 0, maxLength: 30 }),
        (totals) => {
          totals.forEach(t => globalThis.TokenTracker._accumulateRecord({
            promptTokens:     t,
            completionTokens: 0,
            totalTokens:      t,
            costUsd:          0,
            isEstimated:      false,
            ts:               Date.now(),
            model:            'MiniMax-M2.7',
            provider:         'minimax'
          }));
          globalThis.TokenTracker.reset();
          const s = globalThis.TokenTracker.getState();
          return s.cumulativeTotalTokens      === 0
              && s.cumulativePromptTokens     === 0
              && s.cumulativeCompletionTokens === 0
              && s.cumulativeCostUsd          === 0
              && s.callCount                  === 0
              && s.lastCall                   === null;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: Akumulasi biaya adalah jumlah dari semua biaya per panggilan ─
// Feature: realtime-token-usage-summary, Property 6: Akumulasi biaya adalah jumlah dari semua biaya per panggilan
// Validates: Requirements 3.3
describe('Property 6: Cumulative cost equals sum of individual call costs', () => {
  test('cumulativeCostUsd matches sum of costUsd from each record', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.float({ min: 0, max: 1, noNaN: true }),
          { minLength: 0, maxLength: 50 }
        ),
        (costs) => {
          globalThis.TokenTracker.reset();
          costs.forEach(cost => globalThis.TokenTracker._accumulateRecord({
            promptTokens:     0,
            completionTokens: 0,
            totalTokens:      0,
            costUsd:          cost,
            isEstimated:      false,
            ts:               Date.now(),
            model:            'MiniMax-M2.7',
            provider:         'minimax'
          }));
          const state    = globalThis.TokenTracker.getState();
          const expected = costs.reduce((s, c) => s + c, 0);
          return Math.abs(state.cumulativeCostUsd - expected) < 1e-9;
        }
      ),
      { numRuns: 100 }
    );
  });
});
