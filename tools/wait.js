// tools/wait.js — Wait/timing tools
// Depends on: tools-registry.js (ToolRegistry)

(() => {
  function sendBG(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
        else resolve(res || {});
      });
    });
  }

  // ── Wait for time ──
  ToolRegistry.register({
    name: "wait",
    description: "Wait/pause for a specified duration in milliseconds before continuing. Useful for waiting for animations, page loads, or delayed content.",
    category: "timing",
    icon: "⏱️",
    inputSchema: {
      type: "object",
      properties: {
        ms: {
          type: "integer",
          description: "Milliseconds to wait. Default is 1000 (1 second). Max is 10000 (10 seconds).",
          default: 1000,
          example: 1000
        }
      }
    },
    execute: async (params) => {
      const ms = Math.min(Math.max(params.ms || 1000, 100), 10000);
      await new Promise((r) => setTimeout(r, ms));
      return { success: true, waited: ms };
    }
  });

  // ── Wait for Element ──
  ToolRegistry.register({
    name: "wait_for_element",
    description: "Wait until a specific element appears on the page. Useful for waiting for dynamic content, modals, or AJAX-loaded elements.",
    category: "timing",
    icon: "⏳",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to wait for",
          example: ".modal-content"
        },
        timeout: {
          type: "integer",
          description: "Maximum time to wait in ms. Default is 5000 (5 seconds).",
          default: 5000
        }
      },
      required: ["selector"]
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "wait_for_element", params });
    }
  });

  // ── Wait for Navigation ──
  ToolRegistry.register({
    name: "wait_for_navigation",
    description: "Wait for the page to finish loading after a navigation or form submission. Waits for the 'complete' ready state.",
    category: "timing",
    icon: "🔄",
    inputSchema: {
      type: "object",
      properties: {
        timeout: {
          type: "integer",
          description: "Maximum time to wait in ms. Default is 10000 (10 seconds).",
          default: 10000
        }
      }
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "wait_for_navigation", params });
    }
  });
})();
