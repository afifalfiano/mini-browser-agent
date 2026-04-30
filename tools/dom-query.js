// tools/dom-query.js — DOM query and inspection tools
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

  // ── Query Elements ──
  ToolRegistry.register({
    name: "query_elements",
    description: "Find elements on the page using CSS selector and return details about matching elements (text, attributes, visibility, position).",
    category: "inspection",
    icon: "🔍",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector to query (e.g. '.btn-primary', '#login-form input')",
          example: "button.submit"
        },
        limit: {
          type: "integer",
          description: "Max number of results to return. Default is 10.",
          default: 10
        }
      },
      required: ["selector"]
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "query_elements", params });
    }
  });

  // ── Get Element Info ──
  ToolRegistry.register({
    name: "get_element_info",
    description: "Get detailed information about a specific element: tag, text, attributes, styles, bounding box, visibility state, and accessibility properties.",
    category: "inspection",
    icon: "🔬",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "integer",
          description: "Label number of the element to inspect"
        },
        selector: {
          type: "string",
          description: "CSS selector of the element to inspect"
        }
      }
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "get_element_info", params });
    }
  });

  // ── Get Form Data ──
  ToolRegistry.register({
    name: "get_form_data",
    description: "Extract all form fields, their types, current values, and validation state from a specific form or all forms on the page.",
    category: "inspection",
    icon: "📝",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of a specific form. If omitted, returns data for all forms on the page."
        }
      }
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "get_form_data", params });
    }
  });

  // ── Count Elements ──
  ToolRegistry.register({
    name: "count_elements",
    description: "Count how many elements match a CSS selector. Useful for checking if search results exist, how many items are in a list, etc.",
    category: "inspection",
    icon: "🔢",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector to count matches for",
          example: ".search-result"
        }
      },
      required: ["selector"]
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "count_elements", params });
    }
  });
})();
