/**
 * Property-based tests for TokenDisplay component.
 * Uses fast-check for property generation.
 *
 * token-tracker.js is loaded via vitest setupFiles, so TokenDisplay
 * is available on globalThis.
 */

import fc from 'fast-check';

// Helper to set up minimal DOM for TokenDisplay tests
function setupDOM() {
  document.body.innerHTML = `
    <div id="token-display-panel" class="token-panel hidden" aria-live="polite" aria-label="Token usage summary" role="status">
      <div class="token-panel-inner">
        <span class="token-label">Tokens</span>
        <span class="token-loading hidden" aria-hidden="true">⏳</span>
        <span class="token-cumulative" id="token-cumulative">0</span>
        <span class="token-breakdown" id="token-breakdown">↑0 ↓0</span>
        <span class="token-calls" id="token-calls">0 calls</span>
        <span class="token-cost" id="token-cost">$0.00</span>
        <span class="token-last" id="token-last" title="Last call tokens"></span>
      </div>
    </div>
  `;
}

// Feature: realtime-token-usage-summary, Property 9: Panel token visible jika dan hanya jika cumulative > 0
// Validates: Requirements 4.4, 4.5
describe('Property 9: Token panel visible if and only if cumulative > 0', () => {
  beforeEach(() => setupDOM());

  test('panel is visible when cumulativeTotalTokens > 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        (total) => {
          setupDOM();
          const state = {
            cumulativeTotalTokens:      total,
            cumulativePromptTokens:     Math.floor(total / 2),
            cumulativeCompletionTokens: total - Math.floor(total / 2),
            cumulativeCostUsd:          0.001,
            callCount:                  1,
            lastCall:                   null,
            hasEstimatedCalls:          false
          };
          globalThis.TokenDisplay.update(state);
          const panel = document.getElementById('token-display-panel');
          return !panel.classList.contains('hidden');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('panel is hidden when cumulativeTotalTokens === 0', () => {
    setupDOM();
    const state = {
      cumulativeTotalTokens:      0,
      cumulativePromptTokens:     0,
      cumulativeCompletionTokens: 0,
      cumulativeCostUsd:          0,
      callCount:                  0,
      lastCall:                   null,
      hasEstimatedCalls:          false
    };
    globalThis.TokenDisplay.update(state);
    const panel = document.getElementById('token-display-panel');
    expect(panel.classList.contains('hidden')).toBe(true);
  });
});

// Feature: realtime-token-usage-summary, Property 10: Rendered display mengandung semua data yang diperlukan
// Validates: Requirements 4.3
describe('Property 10: Rendered display contains all required data', () => {
  test('DOM elements contain formatted values from state', () => {
    fc.assert(
      fc.property(
        fc.record({
          cumulativeTotalTokens:      fc.integer({ min: 1, max: 1_000_000 }),
          cumulativePromptTokens:     fc.integer({ min: 0, max: 500_000 }),
          cumulativeCompletionTokens: fc.integer({ min: 0, max: 500_000 }),
          callCount:                  fc.integer({ min: 1, max: 1000 }),
          cumulativeCostUsd:          fc.float({ min: 0, max: 100, noNaN: true })
        }),
        (state) => {
          setupDOM();
          const fullState = { ...state, lastCall: null, hasEstimatedCalls: false };
          globalThis.TokenDisplay.update(fullState);

          const elCumulative = document.getElementById('token-cumulative');
          const elCalls      = document.getElementById('token-calls');
          const elCost       = document.getElementById('token-cost');

          // Verify elements contain non-empty content
          return elCumulative.textContent.length > 0
              && elCalls.textContent.includes(String(state.callCount))
              && elCost.textContent.startsWith('$');
        }
      ),
      { numRuns: 100 }
    );
  });
});
