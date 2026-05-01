/**
 * Unit tests for TokenDisplay component.
 *
 * token-tracker.js is loaded via vitest setupFiles, so TokenDisplay
 * is available on globalThis.
 */

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

const zeroState = {
  cumulativeTotalTokens:      0,
  cumulativePromptTokens:     0,
  cumulativeCompletionTokens: 0,
  cumulativeCostUsd:          0,
  callCount:                  0,
  lastCall:                   null,
  hasEstimatedCalls:          false
};

const activeState = {
  cumulativeTotalTokens:      1500,
  cumulativePromptTokens:     1000,
  cumulativeCompletionTokens: 500,
  cumulativeCostUsd:          0.0012,
  callCount:                  3,
  lastCall: {
    ts:               Date.now(),
    model:            'MiniMax-M2.7',
    provider:         'minimax',
    promptTokens:     300,
    completionTokens: 200,
    totalTokens:      500,
    costUsd:          0.0004,
    isEstimated:      false
  },
  hasEstimatedCalls: false
};

describe('TokenDisplay rendering', () => {
  beforeEach(() => setupDOM());

  test('panel is hidden when cumulativeTotalTokens === 0', () => {
    globalThis.TokenDisplay.update(zeroState);
    const panel = document.getElementById('token-display-panel');
    expect(panel.classList.contains('hidden')).toBe(true);
  });

  test('panel is visible when cumulativeTotalTokens > 0', () => {
    globalThis.TokenDisplay.update(activeState);
    const panel = document.getElementById('token-display-panel');
    expect(panel.classList.contains('hidden')).toBe(false);
  });

  test('panel has aria-live="polite" attribute', () => {
    const panel = document.getElementById('token-display-panel');
    expect(panel.getAttribute('aria-live')).toBe('polite');
  });

  test('loading indicator appears when setLoading(true)', () => {
    const el = document.querySelector('.token-loading');
    globalThis.TokenDisplay.setLoading(true);
    expect(el.classList.contains('hidden')).toBe(false);
  });

  test('loading indicator disappears when setLoading(false)', () => {
    const el = document.querySelector('.token-loading');
    globalThis.TokenDisplay.setLoading(true);
    globalThis.TokenDisplay.setLoading(false);
    expect(el.classList.contains('hidden')).toBe(true);
  });

  test('lastCall data is displayed when present', () => {
    globalThis.TokenDisplay.update(activeState);
    const elLast = document.getElementById('token-last');
    expect(elLast.textContent.length).toBeGreaterThan(0);
  });

  test('TokenDisplay.update() does not throw when panel element is missing', () => {
    document.body.innerHTML = ''; // remove all DOM
    expect(() => globalThis.TokenDisplay.update(activeState)).not.toThrow();
  });
});
