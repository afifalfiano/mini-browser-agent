// tools/screenshot.js — Screenshot tools
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

  // ── Screenshot ──
  ToolRegistry.register({
    name: "screenshot",
    description: "Take a screenshot of the currently visible browser tab. The image will be displayed in the chat. Use this to see what the page looks like or verify visual changes.",
    category: "capture",
    icon: "📸",
    inputSchema: {
      type: "object",
      properties: {}
    },
    execute: async () => {
      const res = await sendBG({ type: "TAKE_SCREENSHOT" });
      if (res.success) {
        return { success: true, dataUrl: res.dataUrl, type: "screenshot" };
      }
      return res;
    }
  });

  // ── Download Screenshot ──
  ToolRegistry.register({
    name: "save_screenshot",
    description: "Take a screenshot and save/download it as a PNG file to the user's computer.",
    category: "capture",
    icon: "💾",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename for the screenshot (without extension). Default is 'screenshot'.",
          default: "screenshot"
        }
      }
    },
    execute: async (params) => {
      const res = await sendBG({ type: "TAKE_SCREENSHOT" });
      if (!res.success) return res;

      // Trigger download via background
      const dlRes = await sendBG({
        type: "DOWNLOAD_FILE",
        dataUrl: res.dataUrl,
        filename: (params.filename || "screenshot") + ".png"
      });

      return { success: true, type: "screenshot_saved", dataUrl: res.dataUrl };
    }
  });
})();
