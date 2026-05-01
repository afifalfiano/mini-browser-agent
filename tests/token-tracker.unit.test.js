/**
 * Unit tests for token-tracker.js internal functions.
 *
 * token-tracker.js is loaded via vitest setupFiles, so all globals
 * (_extractFromUsage, _estimateTokens, _calculateCost, _formatTokenCount,
 *  _formatCost, PRICING_CONFIG, TokenTracker) are available on globalThis.
 */

// ─── _extractFromUsage ────────────────────────────────────────────────────────

describe('_extractFromUsage', () => {
  test('returns correct values for a valid usage object', () => {
    const raw = {
      usage: {
        prompt_tokens:     512,
        completion_tokens: 128,
        total_tokens:      640
      }
    };
    const result = globalThis._extractFromUsage(raw);
    expect(result).not.toBeNull();
    expect(result.promptTokens).toBe(512);
    expect(result.completionTokens).toBe(128);
    expect(result.totalTokens).toBe(640);
    expect(result.isEstimated).toBe(false);
  });

  test('returns null when raw is null', () => {
    expect(globalThis._extractFromUsage(null)).toBeNull();
  });

  test('returns null when raw is undefined', () => {
    expect(globalThis._extractFromUsage(undefined)).toBeNull();
  });

  test('returns null when usage field is missing', () => {
    expect(globalThis._extractFromUsage({})).toBeNull();
    expect(globalThis._extractFromUsage({ data: {} })).toBeNull();
  });

  test('returns null when usage is null', () => {
    expect(globalThis._extractFromUsage({ usage: null })).toBeNull();
  });

  test('returns null when prompt_tokens is not a number', () => {
    const raw = {
      usage: {
        prompt_tokens:     '512',   // string, not number
        completion_tokens: 128,
        total_tokens:      640
      }
    };
    expect(globalThis._extractFromUsage(raw)).toBeNull();
  });

  test('returns null when completion_tokens is not a number', () => {
    const raw = {
      usage: {
        prompt_tokens:     512,
        completion_tokens: null,
        total_tokens:      640
      }
    };
    expect(globalThis._extractFromUsage(raw)).toBeNull();
  });

  test('returns null when total_tokens is not a number', () => {
    const raw = {
      usage: {
        prompt_tokens:     512,
        completion_tokens: 128,
        total_tokens:      undefined
      }
    };
    expect(globalThis._extractFromUsage(raw)).toBeNull();
  });

  test('handles zero token values correctly', () => {
    const raw = {
      usage: {
        prompt_tokens:     0,
        completion_tokens: 0,
        total_tokens:      0
      }
    };
    const result = globalThis._extractFromUsage(raw);
    expect(result).not.toBeNull();
    expect(result.promptTokens).toBe(0);
    expect(result.completionTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
    expect(result.isEstimated).toBe(false);
  });
});

// ─── _estimateTokens ──────────────────────────────────────────────────────────

describe('_estimateTokens', () => {
  test('returns 0 for empty string', () => {
    expect(globalThis._estimateTokens('')).toBe(0);
  });

  test('returns ceil(length/4) for a short string', () => {
    // "hello" = 5 chars → ceil(5/4) = 2
    expect(globalThis._estimateTokens('hello')).toBe(2);
  });

  test('returns ceil(length/4) for a string whose length is exactly divisible by 4', () => {
    // "abcd" = 4 chars → ceil(4/4) = 1
    expect(globalThis._estimateTokens('abcd')).toBe(1);
  });

  test('returns ceil(length/4) for a long string', () => {
    const s = 'a'.repeat(1000);
    expect(globalThis._estimateTokens(s)).toBe(250);
  });

  test('returns ceil(length/4) for a string with length not divisible by 4', () => {
    // "abc" = 3 chars → ceil(3/4) = 1
    expect(globalThis._estimateTokens('abc')).toBe(1);
    // "abcde" = 5 chars → ceil(5/4) = 2
    expect(globalThis._estimateTokens('abcde')).toBe(2);
  });
});

// ─── _calculateCost ───────────────────────────────────────────────────────────

describe('_calculateCost', () => {
  test('calculates cost correctly for MiniMax-M2.7', () => {
    // 1000 prompt + 1000 completion with rate 0.0008/1k each
    // = (1000/1000 * 0.0008) + (1000/1000 * 0.0008) = 0.0016
    const cost = globalThis._calculateCost(1000, 1000, 'MiniMax-M2.7');
    expect(Math.abs(cost - 0.0016)).toBeLessThan(1e-10);
  });

  test('calculates cost correctly for MiniMax-M2.7-Pro', () => {
    const cost = globalThis._calculateCost(1000, 1000, 'MiniMax-M2.7-Pro');
    expect(Math.abs(cost - 0.0032)).toBeLessThan(1e-10);
  });

  test('calculates cost correctly for MiniMax-M2.5', () => {
    const cost = globalThis._calculateCost(1000, 1000, 'MiniMax-M2.5');
    expect(Math.abs(cost - 0.0008)).toBeLessThan(1e-10);
  });

  test('calculates cost correctly for MiniMax-M2.5-Pro', () => {
    const cost = globalThis._calculateCost(1000, 1000, 'MiniMax-M2.5-Pro');
    expect(Math.abs(cost - 0.0016)).toBeLessThan(1e-10);
  });

  test('falls back to DEFAULT_PRICING_MODEL for unknown model', () => {
    // Unknown model should use MiniMax-M2.7 pricing (0.0008/1k each)
    const costUnknown = globalThis._calculateCost(1000, 1000, 'UnknownModel-X');
    const costDefault = globalThis._calculateCost(1000, 1000, 'MiniMax-M2.7');
    expect(costUnknown).toBe(costDefault);
  });

  test('returns 0 for zero tokens', () => {
    expect(globalThis._calculateCost(0, 0, 'MiniMax-M2.7')).toBe(0);
  });
});

// ─── _formatCost ──────────────────────────────────────────────────────────────

describe('_formatCost', () => {
  test('formats 0 as "$0.00"', () => {
    expect(globalThis._formatCost(0)).toBe('$0.00');
  });

  test('formats a small value with two decimal places', () => {
    expect(globalThis._formatCost(0.03)).toBe('$0.03');
  });

  test('formats a larger value with two decimal places', () => {
    expect(globalThis._formatCost(1.5)).toBe('$1.50');
  });

  test('formats a large value with two decimal places', () => {
    expect(globalThis._formatCost(9999.99)).toBe('$9999.99');
  });

  test('rounds to two decimal places', () => {
    // 0.005 rounds to 0.01 (toFixed rounding)
    const result = globalThis._formatCost(0.005);
    expect(result).toMatch(/^\$\d+\.\d{2}$/);
  });
});

// ─── _formatTokenCount ────────────────────────────────────────────────────────

describe('_formatTokenCount', () => {
  test('formats 0 without comma', () => {
    expect(globalThis._formatTokenCount(0)).toBe('0');
  });

  test('formats 999 without comma', () => {
    expect(globalThis._formatTokenCount(999)).toBe('999');
  });

  test('formats 1000 with comma', () => {
    expect(globalThis._formatTokenCount(1000)).toBe('1,000');
  });

  test('formats 1000000 with commas', () => {
    expect(globalThis._formatTokenCount(1000000)).toBe('1,000,000');
  });

  test('formats 1234 as "1,234"', () => {
    expect(globalThis._formatTokenCount(1234)).toBe('1,234');
  });
});

// ─── TokenTracker state management ───────────────────────────────────────────

describe('TokenTracker state management', () => {
  beforeEach(() => {
    globalThis.TokenTracker.reset();
  });

  test('initial state has all zeros after reset', () => {
    const s = globalThis.TokenTracker.getState();
    expect(s.cumulativeTotalTokens).toBe(0);
    expect(s.cumulativePromptTokens).toBe(0);
    expect(s.cumulativeCompletionTokens).toBe(0);
    expect(s.cumulativeCostUsd).toBe(0);
    expect(s.callCount).toBe(0);
    expect(s.lastCall).toBeNull();
    expect(s.hasEstimatedCalls).toBe(false);
  });

  test('record() with raw response that has usage (extraction path)', () => {
    const raw = { usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } };
    const state = globalThis.TokenTracker.record({ raw, model: 'MiniMax-M2.7', provider: 'minimax', promptMessages: [], completionText: '' });
    expect(state.cumulativePromptTokens).toBe(100);
    expect(state.cumulativeCompletionTokens).toBe(50);
    expect(state.cumulativeTotalTokens).toBe(150);
    expect(state.callCount).toBe(1);
    expect(state.lastCall.isEstimated).toBe(false);
  });

  test('record() without usage (estimation path)', () => {
    const state = globalThis.TokenTracker.record({
      raw: null,
      model: 'MiniMax-M2.7',
      provider: 'minimax',
      promptMessages: [{ content: 'hello world' }],
      completionText: 'hi there'
    });
    expect(state.callCount).toBe(1);
    expect(state.lastCall.isEstimated).toBe(true);
    expect(state.cumulativeTotalTokens).toBeGreaterThan(0);
  });

  test('record() with unknown model uses fallback pricing and marks hasEstimatedCalls', () => {
    const raw = { usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } };
    const state = globalThis.TokenTracker.record({ raw, model: 'UnknownModel-X', provider: 'unknown', promptMessages: [], completionText: '' });
    expect(state.hasEstimatedCalls).toBe(true);
  });

  test('reset() clears all state after multiple calls', () => {
    globalThis.TokenTracker.record({ raw: { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }, model: 'MiniMax-M2.7', provider: 'minimax', promptMessages: [], completionText: '' });
    globalThis.TokenTracker.record({ raw: { usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } }, model: 'MiniMax-M2.7', provider: 'minimax', promptMessages: [], completionText: '' });
    globalThis.TokenTracker.reset();
    const s = globalThis.TokenTracker.getState();
    expect(s.cumulativeTotalTokens).toBe(0);
    expect(s.callCount).toBe(0);
    expect(s.lastCall).toBeNull();
  });

  test('getState() returns a copy, not a direct reference', () => {
    globalThis.TokenTracker.record({ raw: { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }, model: 'MiniMax-M2.7', provider: 'minimax', promptMessages: [], completionText: '' });
    const state1 = globalThis.TokenTracker.getState();
    state1.cumulativeTotalTokens = 9999;
    const state2 = globalThis.TokenTracker.getState();
    expect(state2.cumulativeTotalTokens).toBe(15); // unchanged
  });
});
