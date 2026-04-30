// tools/tab-manager.js — Tab management tools
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

  // ── List Tabs ──
  ToolRegistry.register({
    name: "list_tabs",
    description: "List all open browser tabs in the current window with their titles and URLs.",
    category: "tabs",
    icon: "📑",
    inputSchema: {
      type: "object",
      properties: {}
    },
    execute: async () => {
      return await sendBG({ type: "BROWSER_ACTION", action: "list_tabs", params: {} });
    }
  });

  // ── Switch Tab ──
  ToolRegistry.register({
    name: "switch_tab",
    description: "Switch to a different browser tab by its index (0-based) or by matching part of its title/URL.",
    category: "tabs",
    icon: "🔀",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "integer",
          description: "Zero-based index of the tab to switch to"
        },
        match: {
          type: "string",
          description: "Partial title or URL to match against open tabs"
        }
      }
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "switch_tab", params });
    }
  });

  // ── Close Tab ──
  ToolRegistry.register({
    name: "close_tab",
    description: "Close a specific browser tab by its index, or close the current tab.",
    category: "tabs",
    icon: "❌",
    inputSchema: {
      type: "object",
      properties: {
        index: {
          type: "integer",
          description: "Zero-based index of the tab to close. Omit to close the current active tab."
        }
      }
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "close_tab", params });
    }
  });

  // ── Done ──
  ToolRegistry.register({
    name: "done",
    description: "Signal that the current task is complete. Always use this action when you have finished the user's request. Include a brief summary of what was accomplished.",
    category: "control",
    icon: "✅",
    hidden: false,
    inputSchema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "Brief summary of what was accomplished"
        }
      }
    },
    execute: async (params) => {
      return { success: true, done: true, summary: params.summary || "Task complete" };
    }
  });
})();
