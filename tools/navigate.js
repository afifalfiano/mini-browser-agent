// tools/navigate.js — Navigation tools
// Depends on: tools-registry.js (ToolRegistry)

(() => {
  // ── Helper: send message to background ──
  function sendBG(msg) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
        else resolve(res || {});
      });
    });
  }

  // ── Navigate ──
  ToolRegistry.register({
    name: "navigate",
    description: "Navigate the current browser tab to a specified URL. Use this when the user asks to go to a website or open a URL.",
    category: "navigation",
    icon: "🌐",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The full URL to navigate to (must start with http:// or https://)",
          example: "https://example.com"
        }
      },
      required: ["url"]
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "navigate", params });
    }
  });

  // ── New Tab ──
  ToolRegistry.register({
    name: "new_tab",
    description: "Open a URL in a new browser tab. Use this when the user wants to keep the current page and open something new.",
    category: "navigation",
    icon: "📑",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to open in a new tab",
          example: "https://example.com"
        }
      },
      required: ["url"]
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "new_tab", params });
    }
  });

  // ── Go Back ──
  ToolRegistry.register({
    name: "go_back",
    description: "Navigate back to the previous page in browser history. Like clicking the browser's back button.",
    category: "navigation",
    icon: "⬅️",
    inputSchema: {
      type: "object",
      properties: {}
    },
    execute: async () => {
      return await sendBG({ type: "BROWSER_ACTION", action: "go_back", params: {} });
    }
  });

  // ── Go Forward ──
  ToolRegistry.register({
    name: "go_forward",
    description: "Navigate forward in browser history. Like clicking the browser's forward button.",
    category: "navigation",
    icon: "➡️",
    inputSchema: {
      type: "object",
      properties: {}
    },
    execute: async () => {
      return await sendBG({ type: "BROWSER_ACTION", action: "go_forward", params: {} });
    }
  });

  // ── Reload Page ──
  ToolRegistry.register({
    name: "reload",
    description: "Reload/refresh the current page.",
    category: "navigation",
    icon: "🔄",
    inputSchema: {
      type: "object",
      properties: {
        hard: {
          type: "boolean",
          description: "If true, bypass cache (hard reload)",
          default: false
        }
      }
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "reload", params });
    }
  });
})();
