// tools/evaluate.js — JavaScript evaluation tool (sandboxed)
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

  // ── Evaluate JavaScript ──
  ToolRegistry.register({
    name: "evaluate_js",
    description: "Execute a JavaScript expression on the current page and return the result. Use for reading dynamic state, checking variables, or performing calculations on the page. The expression runs in the page context.",
    category: "advanced",
    icon: "⚡",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description: "JavaScript expression to evaluate. Must be a single expression (not statements). The result is JSON-serialized and returned.",
          example: "document.title"
        }
      },
      required: ["expression"]
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "evaluate_js", params });
    }
  });

  // ── Extract Data ──
  ToolRegistry.register({
    name: "extract_data",
    description: "Extract structured data from the page using CSS selectors. Returns an array of objects with the extracted text/attributes from matching elements.",
    category: "advanced",
    icon: "📊",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector for the repeating container elements (e.g. '.product-card', 'tr.data-row')",
          example: ".search-result"
        },
        fields: {
          type: "object",
          description: "Map of field names to sub-selectors within each container. Example: { \"title\": \"h3\", \"price\": \".price\", \"link\": \"a@href\" }. Use @attr to extract an attribute instead of text."
        },
        limit: {
          type: "integer",
          description: "Maximum number of items to extract. Default is 20.",
          default: 20
        }
      },
      required: ["selector"]
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "extract_data", params });
    }
  });
})();
