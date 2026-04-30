// background.js — Service Worker (Refactored for ToolRegistry & ProviderManager)

// ── Load Providers ──
importScripts(
  "providers/base.js",
  "providers/minimax.js",
  "providers/gemini.js"
);
// ── Allowed origins for message validation ──
const EXTENSION_ORIGIN = chrome.runtime.getURL("").slice(0, -1);

// ── Open sidebar on icon click ──
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// ── Message router ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const isFromExtension = sender.origin === EXTENSION_ORIGIN || !sender.tab;
  const isFromContentScript = !!sender.tab;

  if (!isFromExtension && !isFromContentScript) {
    console.warn("[BG] Rejected message from unknown origin:", sender.origin);
    sendResponse({ success: false, error: "Unauthorized sender" });
    return false;
  }

  switch (message.type) {
    case "PROVIDER_CHAT":
      ProviderManager.chat(message.provider, message.payload)
        .then((data) => sendResponse({ success: true, data }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "TAKE_SCREENSHOT":
      takeScreenshot()
        .then((dataUrl) => sendResponse({ success: true, dataUrl }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "DOWNLOAD_FILE":
      downloadFile(message.dataUrl, message.filename)
        .then(() => sendResponse({ success: true }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "GET_PAGE_CONTENT":
      getActiveTabContent(message.options)
        .then((content) => sendResponse({ success: true, content }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "BROWSER_ACTION":
      executeBrowserAction(message.action, message.params)
        .then((result) => sendResponse({ success: true, result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "TEXT_SELECTED":
      if (!sender.tab) break;
      chrome.runtime.sendMessage({
        type: "TEXT_SELECTED_SIDEBAR",
        text: message.text,
        url: message.url
      }).catch(() => {});
      break;
  }
  return false;
});



// ── Screenshot ──
async function takeScreenshot() {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(dataUrl);
    });
  });
}

// ── Download file from data URL ──
async function downloadFile(dataUrl, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({
      url: dataUrl,
      filename: filename || "download.png",
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(downloadId);
    });
  });
}

// ── Get active tab page content ──
async function getActiveTabContent(options = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("No active tab found");

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { action: "GET_PAGE_CONTENT", options }, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response?.content);
    });
  });
}

// ── Validate URL before navigation ──
function isSafeUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

// ── Execute browser actions requested by AI ──
async function executeBrowserAction(action, params) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  switch (action) {
    // ── Navigation ──
    case "navigate": {
      if (!tab?.id) throw new Error("No active tab found");
      if (!isSafeUrl(params.url)) throw new Error(`Unsafe or invalid URL: ${params.url}`);
      try {
        await sendToContentScript(tab.id, { action: "SHOW_NAVIGATING", url: params.url });
      } catch {}
      await sleep(600);
      await chrome.tabs.update(tab.id, { url: params.url });
      return { done: true, url: params.url };
    }

    case "new_tab": {
      const url = isSafeUrl(params.url) ? params.url : "about:blank";
      await chrome.tabs.create({ url });
      return { done: true };
    }

    case "go_back": {
      if (!tab?.id) throw new Error("No active tab found");
      await chrome.tabs.goBack(tab.id);
      return { done: true };
    }

    case "go_forward": {
      if (!tab?.id) throw new Error("No active tab found");
      await chrome.tabs.goForward(tab.id);
      return { done: true };
    }

    case "reload": {
      if (!tab?.id) throw new Error("No active tab found");
      await chrome.tabs.reload(tab.id, { bypassCache: params.hard || false });
      return { done: true };
    }

    // ── Interaction ──
    case "click":
    case "fill_input":
    case "scroll":
    case "scroll_to":
    case "press_enter":
    case "press_key":
    case "hover":
    case "select_option":
    case "get_selected_text":
      if (!tab?.id) throw new Error("No active tab found");
      return await sendToContentScript(tab.id, { action: action.toUpperCase(), ...params });

    // ── DOM Query ──
    case "query_elements":
    case "get_element_info":
    case "get_form_data":
    case "count_elements":
      if (!tab?.id) throw new Error("No active tab found");
      return await sendToContentScript(tab.id, { action: action.toUpperCase(), ...params });

    // ── Evaluate ──
    case "evaluate_js":
      if (!tab?.id) throw new Error("No active tab found");
      return await sendToContentScript(tab.id, { action: "EVALUATE_JS", expression: params.expression });

    case "extract_data":
      if (!tab?.id) throw new Error("No active tab found");
      return await sendToContentScript(tab.id, { action: "EXTRACT_DATA", ...params });

    // ── Wait ──
    case "wait_for_element":
      if (!tab?.id) throw new Error("No active tab found");
      return await sendToContentScript(tab.id, { action: "WAIT_FOR_ELEMENT", ...params });

    case "wait_for_navigation": {
      if (!tab?.id) throw new Error("No active tab found");
      const timeout = params.timeout || 10000;
      const startTime = Date.now();
      // Poll tab status until complete
      while (Date.now() - startTime < timeout) {
        const currentTab = await chrome.tabs.get(tab.id);
        if (currentTab.status === "complete") return { done: true, url: currentTab.url };
        await sleep(500);
      }
      return { done: true, timeout: true };
    }

    // ── Tab Management ──
    case "list_tabs": {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      return {
        done: true,
        tabs: tabs.map((t, i) => ({
          index: i,
          title: t.title,
          url: t.url,
          active: t.active
        }))
      };
    }

    case "switch_tab": {
      if (params.index !== undefined) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        if (params.index >= 0 && params.index < tabs.length) {
          await chrome.tabs.update(tabs[params.index].id, { active: true });
          return { done: true };
        }
        throw new Error(`Tab index ${params.index} out of range`);
      }
      if (params.match) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const needle = params.match.toLowerCase();
        const found = tabs.find((t) =>
          (t.title || "").toLowerCase().includes(needle) ||
          (t.url || "").toLowerCase().includes(needle)
        );
        if (found) {
          await chrome.tabs.update(found.id, { active: true });
          return { done: true, title: found.title };
        }
        throw new Error(`No tab matching "${params.match}"`);
      }
      throw new Error("Provide either 'index' or 'match' parameter");
    }

    case "close_tab": {
      if (params.index !== undefined) {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        if (params.index >= 0 && params.index < tabs.length) {
          await chrome.tabs.remove(tabs[params.index].id);
          return { done: true };
        }
        throw new Error(`Tab index ${params.index} out of range`);
      }
      if (tab?.id) {
        await chrome.tabs.remove(tab.id);
        return { done: true };
      }
      throw new Error("No active tab to close");
    }

    // ── Read/Screenshot (handled at sidebar level, just acknowledge) ──
    case "screenshot":
    case "read_page":
    case "get_url": {
      if (!tab?.id && action === "get_url") throw new Error("No active tab found");
      if (action === "get_url") {
        return { done: true, url: tab.url, title: tab.title };
      }
      return { done: true };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function sendToContentScript(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(response);
    });
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
