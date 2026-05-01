/**
 * token-tracker.js
 * Plain script (no ESM import/export) for browser extension compatibility.
 * Exposes TokenTracker, TokenDisplay, and internal helpers via globalThis.
 */

// ─── Pricing Configuration ────────────────────────────────────────────────────

const PRICING_CONFIG = {
  "MiniMax-M2.7":     { inputPer1k: 0.0008, outputPer1k: 0.0008 },
  "MiniMax-M2.7-Pro": { inputPer1k: 0.0016, outputPer1k: 0.0016 },
  "MiniMax-M2.5":     { inputPer1k: 0.0004, outputPer1k: 0.0004 },
  "MiniMax-M2.5-Pro": { inputPer1k: 0.0008, outputPer1k: 0.0008 }
};

const DEFAULT_PRICING_MODEL = "MiniMax-M2.7";

// ─── Internal Helper Functions ────────────────────────────────────────────────

/**
 * Extract token counts from a raw API response object.
 * Returns null if the `usage` field is missing or any sub-field is not a number.
 *
 * @param {object} raw - Raw API response object
 * @returns {{ promptTokens: number, completionTokens: number, totalTokens: number, isEstimated: false } | null}
 */
function _extractFromUsage(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const usage = raw.usage;
  if (!usage || typeof usage !== 'object') return null;

  const prompt     = usage.prompt_tokens;
  const completion = usage.completion_tokens;
  const total      = usage.total_tokens;

  if (typeof prompt !== 'number' || typeof completion !== 'number' || typeof total !== 'number') {
    return null;
  }

  return {
    promptTokens:     prompt,
    completionTokens: completion,
    totalTokens:      total,
    isEstimated:      false
  };
}

/**
 * Estimate token count from a text string using the ceil(chars / 4) formula.
 *
 * @param {string} text
 * @returns {number}
 */
function _estimateTokens(text) {
  if (typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Calculate the cost in USD for a single API call.
 * Falls back to DEFAULT_PRICING_MODEL if the given model is not in PRICING_CONFIG.
 *
 * @param {number} promptTokens
 * @param {number} completionTokens
 * @param {string} model
 * @returns {number}
 */
function _calculateCost(promptTokens, completionTokens, model) {
  const pricing = PRICING_CONFIG[model] || PRICING_CONFIG[DEFAULT_PRICING_MODEL];
  return (promptTokens / 1000 * pricing.inputPer1k) + (completionTokens / 1000 * pricing.outputPer1k);
}

/**
 * Format a token count with thousands separators.
 *
 * @param {number} n
 * @returns {string}  e.g. "1,234"
 */
function _formatTokenCount(n) {
  return n.toLocaleString('en-US');
}

/**
 * Format a USD cost value to two decimal places.
 *
 * @param {number} usd
 * @returns {string}  e.g. "$0.03"
 */
function _formatCost(usd) {
  return '$' + usd.toFixed(2);
}

// ─── TokenTracker ─────────────────────────────────────────────────────────────

/**
 * In-memory session state.
 * @type {{
 *   cumulativePromptTokens: number,
 *   cumulativeCompletionTokens: number,
 *   cumulativeTotalTokens: number,
 *   cumulativeCostUsd: number,
 *   callCount: number,
 *   lastCall: object|null,
 *   hasEstimatedCalls: boolean
 * }}
 */
var _state = {
  cumulativePromptTokens:     0,
  cumulativeCompletionTokens: 0,
  cumulativeTotalTokens:      0,
  cumulativeCostUsd:          0,
  callCount:                  0,
  lastCall:                   null,
  hasEstimatedCalls:          false
};

var _loading = false;

/**
 * Accumulate a single ApiCallRecord into the session state.
 * @param {{ ts: number, model: string, provider: string, promptTokens: number, completionTokens: number, totalTokens: number, costUsd: number, isEstimated: boolean }} record
 */
function _accumulateRecord(record) {
  _state.cumulativePromptTokens     += record.promptTokens;
  _state.cumulativeCompletionTokens += record.completionTokens;
  _state.cumulativeTotalTokens      += record.totalTokens;
  _state.cumulativeCostUsd          += record.costUsd;
  _state.callCount                  += 1;
  _state.lastCall                    = record;
  if (record.isEstimated) {
    _state.hasEstimatedCalls = true;
  }

  // Persist to storage asynchronously (non-blocking)
  try {
    var storageData = { token_usage_session: Object.assign({}, _state) };
    if (typeof chrome !== 'undefined' && chrome.storage) {
      var storage = (chrome.storage.session || chrome.storage.local);
      storage.set(storageData, function() {
        if (chrome.runtime && chrome.runtime.lastError) {
          console.warn('[TokenTracker] Storage set error:', chrome.runtime.lastError);
        }
      });
    }
  } catch (e) {
    console.warn('[TokenTracker] Storage set failed:', e);
  }
}

var TokenTracker = {
  /**
   * Record a single API call and accumulate into session state.
   * @param {{ raw: object, model: string, provider: string, promptMessages: Array, completionText: string }} opts
   * @returns {object} TokenState (shallow copy)
   */
  record: function(opts) {
    var raw            = opts.raw;
    var model          = opts.model || DEFAULT_PRICING_MODEL;
    var provider       = opts.provider || 'unknown';
    var promptMessages = opts.promptMessages || [];
    var completionText = opts.completionText || '';

    var extracted = _extractFromUsage(raw);
    var promptTokens, completionTokens, totalTokens, isEstimated;

    if (extracted !== null) {
      promptTokens     = extracted.promptTokens;
      completionTokens = extracted.completionTokens;
      totalTokens      = extracted.totalTokens;
      isEstimated      = false;
    } else {
      // Estimate from text length
      var promptText = promptMessages.map(function(m) {
        return (m && m.content) ? m.content : '';
      }).join(' ');
      promptTokens     = _estimateTokens(promptText);
      completionTokens = _estimateTokens(completionText);
      totalTokens      = promptTokens + completionTokens;
      isEstimated      = true;
    }

    var costUsd = _calculateCost(promptTokens, completionTokens, model);

    // If model not in PRICING_CONFIG, mark as estimated
    if (!PRICING_CONFIG[model]) {
      isEstimated = true;
    }

    var record = {
      ts:               Date.now(),
      model:            model,
      provider:         provider,
      promptTokens:     promptTokens,
      completionTokens: completionTokens,
      totalTokens:      totalTokens,
      costUsd:          costUsd,
      isEstimated:      isEstimated
    };

    _accumulateRecord(record);
    return this.getState();
  },

  /** Reset all accumulated state to zero and clear storage. */
  reset: function() {
    _state = {
      cumulativePromptTokens:     0,
      cumulativeCompletionTokens: 0,
      cumulativeTotalTokens:      0,
      cumulativeCostUsd:          0,
      callCount:                  0,
      lastCall:                   null,
      hasEstimatedCalls:          false
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        var storage = (chrome.storage.session || chrome.storage.local);
        storage.remove('token_usage_session', function() {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn('[TokenTracker] Storage remove error:', chrome.runtime.lastError);
          }
        });
      }
    } catch (e) {
      console.warn('[TokenTracker] Storage remove failed:', e);
    }
  },

  /** Return a shallow copy of the current session state. */
  getState: function() {
    return Object.assign({}, _state);
  },

  /** Set loading indicator state. */
  setLoading: function(active) {
    _loading = !!active;
  },

  /** Return whether the tracker is in loading state. */
  isLoading: function() {
    return _loading;
  },

  /**
   * Restore state from chrome.storage (called on init).
   * @returns {Promise<void>}
   */
  loadFromStorage: function() {
    return new Promise(function(resolve) {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          var storage = (chrome.storage.session || chrome.storage.local);
          storage.get('token_usage_session', function(result) {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn('[TokenTracker] Storage get error:', chrome.runtime.lastError);
              resolve();
              return;
            }
            if (result && result.token_usage_session) {
              var saved = result.token_usage_session;
              _state.cumulativePromptTokens     = saved.cumulativePromptTokens     || 0;
              _state.cumulativeCompletionTokens = saved.cumulativeCompletionTokens || 0;
              _state.cumulativeTotalTokens      = saved.cumulativeTotalTokens      || 0;
              _state.cumulativeCostUsd          = saved.cumulativeCostUsd          || 0;
              _state.callCount                  = saved.callCount                  || 0;
              _state.lastCall                   = saved.lastCall                   || null;
              _state.hasEstimatedCalls          = saved.hasEstimatedCalls          || false;
            }
            resolve();
          });
        } else {
          resolve();
        }
      } catch (e) {
        console.warn('[TokenTracker] loadFromStorage failed:', e);
        resolve();
      }
    });
  },

  // Expose internal accumulate for testing (Properties 3, 4, 6)
  _accumulateRecord: _accumulateRecord
};

// ─── TokenDisplay ─────────────────────────────────────────────────────────────

var TokenDisplay = {
  /** Initialise — find the panel element in the DOM. */
  init: function() {
    var panel = document.getElementById('token-display-panel');
    if (!panel) {
      console.warn('[TokenDisplay] #token-display-panel not found in DOM');
    }
    // Restore state from storage
    TokenTracker.loadFromStorage().then(function() {
      var state = TokenTracker.getState();
      if (state.cumulativeTotalTokens > 0) {
        TokenDisplay.update(state);
      }
    });
  },

  /**
   * Update the panel with the latest TokenState.
   * @param {object} state - TokenState
   */
  update: function(state) {
    try {
      var panel = document.getElementById('token-display-panel');
      if (!panel) {
        console.warn('[TokenDisplay] #token-display-panel not found, skipping render');
        return;
      }

      // Show/hide panel based on cumulative tokens
      if (state.cumulativeTotalTokens > 0) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
        return;
      }

      var elCumulative = document.getElementById('token-cumulative');
      var elBreakdown  = document.getElementById('token-breakdown');
      var elCalls      = document.getElementById('token-calls');
      var elCost       = document.getElementById('token-cost');
      var elLast       = document.getElementById('token-last');

      if (elCumulative) {
        elCumulative.textContent = _formatTokenCount(state.cumulativeTotalTokens);
      }
      if (elBreakdown) {
        elBreakdown.textContent = '\u2191' + _formatTokenCount(state.cumulativePromptTokens) +
                                  ' \u2193' + _formatTokenCount(state.cumulativeCompletionTokens);
      }
      if (elCalls) {
        elCalls.textContent = state.callCount + ' call' + (state.callCount !== 1 ? 's' : '');
      }
      if (elCost) {
        elCost.textContent = _formatCost(state.cumulativeCostUsd);
      }
      if (elLast && state.lastCall) {
        elLast.textContent = '+' + _formatTokenCount(state.lastCall.totalTokens) +
                             (state.lastCall.isEstimated ? ' ~' : '');
        elLast.title = 'Last call: ' + _formatTokenCount(state.lastCall.promptTokens) +
                       ' prompt + ' + _formatTokenCount(state.lastCall.completionTokens) + ' completion';
      }
    } catch (e) {
      console.warn('[TokenDisplay] update error:', e);
    }
  },

  /**
   * Show or hide the loading indicator.
   * @param {boolean} active
   */
  setLoading: function(active) {
    try {
      var el = document.querySelector('.token-loading');
      if (!el) return;
      if (active) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    } catch (e) {
      console.warn('[TokenDisplay] setLoading error:', e);
    }
  }
};

// ─── Expose to globalThis (browser extension + jsdom test environment) ────────

if (typeof globalThis !== 'undefined') {
  globalThis.TokenTracker      = TokenTracker;
  globalThis.TokenDisplay      = TokenDisplay;
  globalThis.PRICING_CONFIG    = PRICING_CONFIG;
  globalThis._extractFromUsage = _extractFromUsage;
  globalThis._estimateTokens   = _estimateTokens;
  globalThis._calculateCost    = _calculateCost;
  globalThis._formatTokenCount = _formatTokenCount;
  globalThis._formatCost       = _formatCost;
}
