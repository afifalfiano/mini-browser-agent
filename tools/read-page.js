// tools/read-page.js — Enhanced page reading tools
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

  // ── Read Page ──
  ToolRegistry.register({
    name: "read_page",
    description: "Read the full content of the current page including text, interactive elements (with label numbers), links, forms, and page metadata. Always use this after navigating to a new page.",
    category: "reading",
    icon: "📖",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          description: "Reading mode: 'full' (default) = text + interactive elements, 'text' = text only, 'interactive' = only interactive elements and forms, 'metadata' = title, URL, meta tags only",
          default: "full",
          example: "full"
        },
        max_length: {
          type: "integer",
          description: "Maximum character length of the text content to return. Default is 8000.",
          default: 8000
        }
      }
    },
    execute: async (params) => {
      const res = await sendBG({ type: "GET_PAGE_CONTENT", options: params });
      if (res.success) {
        return { success: true, content: res.content };
      }
      return res;
    }
  });

  // ── Get Selected Text ──
  ToolRegistry.register({
    name: "get_selected_text",
    description: "Get the text that the user currently has selected/highlighted on the page.",
    category: "reading",
    icon: "✂️",
    inputSchema: {
      type: "object",
      properties: {}
    },
    execute: async () => {
      return await sendBG({ type: "BROWSER_ACTION", action: "get_selected_text", params: {} });
    }
  });

  // ── Get Page URL ──
  ToolRegistry.register({
    name: "get_url",
    description: "Get the current page URL and title without reading the full content.",
    category: "reading",
    icon: "🔗",
    inputSchema: {
      type: "object",
      properties: {}
    },
    execute: async () => {
      return await sendBG({ type: "BROWSER_ACTION", action: "get_url", params: {} });
    }
  });
})();
