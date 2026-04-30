// tools/interact.js — DOM Interaction tools
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

  // ── Click Element ──
  ToolRegistry.register({
    name: "click",
    description: "Click an element on the page. You can target by label number (e.g. [3]), visible text, or CSS selector. Prefer label number when available.",
    category: "interaction",
    icon: "👆",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "integer",
          description: "The label number of the element to click (from page content labels like [1], [2], [3])"
        },
        text: {
          type: "string",
          description: "Visible text of the button/link to click (fallback if no label)"
        },
        selector: {
          type: "string",
          description: "CSS selector of the element to click (last resort fallback)"
        }
      }
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "click", params });
    }
  });

  // ── Fill Input ──
  ToolRegistry.register({
    name: "fill_input",
    description: "Type text into an input field or textarea. Target by label number, CSS selector, or name attribute.",
    category: "interaction",
    icon: "✏️",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "integer",
          description: "The label number of the input element (from page content labels)"
        },
        selector: {
          type: "string",
          description: "CSS selector of the input (e.g. input[name='q'], #search-box)"
        },
        value: {
          type: "string",
          description: "The text to type into the input field"
        },
        clear: {
          type: "boolean",
          description: "If true, clear the field before typing. Default is true.",
          default: true
        }
      },
      required: ["value"]
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "fill_input", params });
    }
  });

  // ── Press Enter ──
  ToolRegistry.register({
    name: "press_enter",
    description: "Press the Enter key on the currently focused element. Useful after filling a search input to submit the form.",
    category: "interaction",
    icon: "⏎",
    inputSchema: {
      type: "object",
      properties: {}
    },
    execute: async () => {
      return await sendBG({ type: "BROWSER_ACTION", action: "press_enter", params: {} });
    }
  });

  // ── Press Key ──
  ToolRegistry.register({
    name: "press_key",
    description: "Press a specific keyboard key (e.g. Escape, Tab, ArrowDown, Space). Use for keyboard navigation or dismissing modals.",
    category: "interaction",
    icon: "⌨️",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "The key to press (e.g. 'Escape', 'Tab', 'ArrowDown', 'Space', 'Backspace')",
          example: "Escape"
        }
      },
      required: ["key"]
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "press_key", params });
    }
  });

  // ── Scroll ──
  ToolRegistry.register({
    name: "scroll",
    description: "Scroll the page up or down. Use positive amount to scroll down, negative to scroll up.",
    category: "interaction",
    icon: "📜",
    inputSchema: {
      type: "object",
      properties: {
        amount: {
          type: "integer",
          description: "Pixels to scroll. Positive = down, negative = up. Default is 400.",
          default: 400,
          example: 400
        },
        selector: {
          type: "string",
          description: "Optional CSS selector of a scrollable container to scroll inside"
        }
      }
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "scroll", params });
    }
  });

  // ── Scroll To Element ──
  ToolRegistry.register({
    name: "scroll_to",
    description: "Scroll the page so a specific element is visible in the viewport. Target by label number or selector.",
    category: "interaction",
    icon: "🎯",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "integer",
          description: "Label number of the element to scroll to"
        },
        selector: {
          type: "string",
          description: "CSS selector of the element to scroll to"
        }
      }
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "scroll_to", params });
    }
  });

  // ── Hover ──
  ToolRegistry.register({
    name: "hover",
    description: "Hover over an element to trigger hover effects, dropdown menus, or tooltips.",
    category: "interaction",
    icon: "🖱️",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "integer",
          description: "Label number of the element to hover over"
        },
        selector: {
          type: "string",
          description: "CSS selector of the element to hover over"
        },
        text: {
          type: "string",
          description: "Visible text of the element to hover over"
        }
      }
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "hover", params });
    }
  });

  // ── Select Option ──
  ToolRegistry.register({
    name: "select_option",
    description: "Select an option from a dropdown/select element by value or visible text.",
    category: "interaction",
    icon: "📋",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "integer",
          description: "Label number of the select element"
        },
        selector: {
          type: "string",
          description: "CSS selector of the select element"
        },
        value: {
          type: "string",
          description: "The value attribute or visible text of the option to select"
        }
      },
      required: ["value"]
    },
    execute: async (params) => {
      return await sendBG({ type: "BROWSER_ACTION", action: "select_option", params });
    }
  });
})();
