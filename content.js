// content.js — Enhanced content script with element labeling system
// Injected into every page

// ── Debounce helper ──
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ── Element Label System ──
// Each interactive element gets a numbered label [1], [2], [3]...
// AI can reference elements by label instead of fragile CSS selectors
let _labelMap = new Map(); // label number → element
let _labelCounter = 0;

function resetLabels() {
  _labelMap.clear();
  _labelCounter = 0;
}

function assignLabel(el) {
  _labelCounter++;
  _labelMap.set(_labelCounter, el);
  return _labelCounter;
}

function getElementByLabel(label) {
  return _labelMap.get(Number(label)) || null;
}

// ── Check if element is in viewport ──
function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// ── Deep interactive element scanner (Shadow DOM & Iframes) ──
function getDeepInteractiveElements(root = document, depth = 0, maxDepth = 5) {
  if (depth > maxDepth) return [];
  let elements = [];

  // 1. Regular interactive elements in current root
  const selectors = [
    'button', 'a[href]', '[role="button"]', '[role="tab"]', '[role="menuitem"]',
    'input:not([type="hidden"])', 'textarea', 'select',
    '[onclick]', '[tabindex]:not([tabindex="-1"])',
    'summary', 'details', '[contenteditable="true"]'
  ];
  
  try {
    const currentLevel = Array.from(root.querySelectorAll(selectors.join(',')));
    elements.push(...currentLevel);
  } catch (e) {}

  // 2. Traverse Shadow DOM
  const allNodes = root.querySelectorAll('*');
  for (const node of allNodes) {
    if (node.shadowRoot) {
      elements.push(...getDeepInteractiveElements(node.shadowRoot, depth + 1, maxDepth));
    }
    // 3. Traverse Iframes (if accessible)
    if (node.tagName === 'IFRAME') {
      try {
        if (node.contentDocument) {
          elements.push(...getDeepInteractiveElements(node.contentDocument, depth + 1, maxDepth));
        }
      } catch (e) {
        // Cross-origin iframe, skip
      }
    }
  }

  return elements;
}

// ── Listen for messages from background/sidebar ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;

  switch (message.action) {
    case "GET_PAGE_CONTENT":
      sendResponse({ content: getPageContent(message.options) });
      break;

    case "SHOW_NAVIGATING":
      showNavigatingIndicator(message.url);
      sendResponse({ success: true });
      break;

    case "SET_WORKING_FRAME":
      toggleWorkingFrame(message.active);
      sendResponse({ success: true });
      break;

    case "PRESS_ENTER": {
      const el = document.activeElement;
      if (el) {
        el.focus();
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true }));
      }
      sendResponse({ success: true });
      break;
    }

    case "PRESS_KEY": {
      const target = document.activeElement || document.body;
      const key = message.key || "Escape";
      target.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, bubbles: true }));
      target.dispatchEvent(new KeyboardEvent("keyup", { key, code: key, bubbles: true }));
      sendResponse({ success: true, key });
      break;
    }

    case "CLICK":
      clickElement(message.selector, message.text, message.label)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    // Keep legacy support
    case "CLICK_ELEMENT":
      clickElement(message.selector, message.text, message.label)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "NAVIGATE":
      try {
        const parsed = new URL(message.url);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          sendResponse({ success: false, error: "Unsafe URL protocol" });
          break;
        }
        window.location.href = message.url;
        sendResponse({ success: true });
      } catch {
        sendResponse({ success: false, error: "Invalid URL" });
      }
      break;

    case "SCROLL":
      if (message.selector) {
        const container = document.querySelector(message.selector);
        if (container) {
          container.scrollBy({ top: message.amount || 400, behavior: "smooth" });
        } else {
          window.scrollBy({ top: message.amount || 400, behavior: "smooth" });
        }
      } else {
        window.scrollBy({ top: message.amount || 400, behavior: "smooth" });
      }
      sendResponse({ success: true });
      break;

    case "SCROLL_TO":
      scrollToElement(message.label, message.selector)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "HOVER":
      hoverElement(message.label, message.selector, message.text)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "SELECT_OPTION":
      selectOption(message.label, message.selector, message.value)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "GET_SELECTED_TEXT":
      sendResponse({ text: window.getSelection().toString().trim() });
      break;

    case "FILL_INPUT":
      fillInput(message.selector, message.value, message.label, message.clear)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    // ── DOM Query ──
    case "QUERY_ELEMENTS":
      sendResponse(queryElements(message.selector, message.limit));
      break;

    case "GET_ELEMENT_INFO":
      sendResponse(getElementInfo(message.label, message.selector));
      break;

    case "GET_FORM_DATA":
      sendResponse(getFormData(message.selector));
      break;

    case "COUNT_ELEMENTS":
      sendResponse(countElements(message.selector));
      break;

    // ── Evaluate ──
    case "EVALUATE_JS":
      evaluateJS(message.expression)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;

    case "EXTRACT_DATA":
      sendResponse(extractData(message.selector, message.fields, message.limit));
      break;

    // ── Wait ──
    case "WAIT_FOR_ELEMENT":
      waitForElement(message.selector, message.timeout)
        .then((result) => sendResponse(result))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
  }
  return false;
});

// ── Get readable page content (enhanced with labels) ──
function getPageContent(options = {}) {
  const mode = options?.mode || "full";
  const maxLength = options?.max_length || 8000;
  const title = document.title;
  const url = window.location.href;

  // Reset labels for fresh assignment
  resetLabels();

  const result = { title, url };

  // ── Text content ──
  if (mode === "full" || mode === "text") {
    const mainSelectors = ["main", "article", "[role='main']", "#content", "#main", ".content", ".main"];
    let contentEl = null;
    for (const sel of mainSelectors) {
      contentEl = document.querySelector(sel);
      if (contentEl) break;
    }
    if (!contentEl) contentEl = document.body;

    const clone = contentEl.cloneNode(true);
    clone.querySelectorAll(
      "script, style, nav, footer, header, iframe, noscript, svg, [aria-hidden='true']"
    ).forEach((el) => el.remove());

    result.text = (clone.innerText || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, maxLength);
  }

  if (mode === "metadata") {
    // Just title + URL, already set
    result.meta = getMetaTags();
    return result;
  }

  // ── Interactive elements with labels ──
  if (mode === "full" || mode === "interactive") {
    result.labels = [];

    // Deep scan for all interactive elements
    const allInteractive = getDeepInteractiveElements();
    
    // Sort by: 1. Viewport presence, 2. Vertical position
    const sortedEls = allInteractive.sort((a, b) => {
      const inViewA = isElementInViewport(a);
      const inViewB = isElementInViewport(b);
      if (inViewA && !inViewB) return -1;
      if (!inViewA && inViewB) return 1;
      
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectA.top - rectB.top;
    });

    const seen = new Set();
    for (const el of sortedEls) {
      // Skip hidden/invisible elements
      if (!isElementVisible(el)) continue;

      // Skip duplicates
      const text = getElementText(el).trim();
      const key = el.tagName + "|" + text.slice(0, 50) + "|" + (el.href || "");
      if (seen.has(key)) continue;
      seen.add(key);

      const label = assignLabel(el);
      const info = {
        id: label,
        tag: el.tagName.toLowerCase(),
        text: text.slice(0, 80),
        role: el.getAttribute("role") || "",
        type: el.type || "",
        name: el.name || el.id || "",
        placeholder: el.placeholder || "",
        href: "",
        disabled: el.disabled || false,
        checked: el.checked || undefined,
        inViewport: isElementInViewport(el)
      };

      // Handle Shadow DOM context
      let parent = el.parentNode;
      while (parent) {
        if (parent instanceof ShadowRoot) {
          info.shadow = true;
          break;
        }
        parent = parent.parentNode;
      }

      // Add href for links
      if (el.href) {
        try {
          const parsed = new URL(el.href);
          if (["http:", "https:"].includes(parsed.protocol)) {
            info.href = el.href;
          }
        } catch {}
      }

      // Add current value for inputs
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") {
        info.value = (el.value || "").slice(0, 100);
      }

      result.labels.push(info);

      // Cap at 100 labels (increased from 60 for better coverage)
      if (result.labels.length >= 100) break;
    }

    // ── Forms ──
    result.forms = [];
    const forms = document.querySelectorAll("form");
    for (const form of Array.from(forms).slice(0, 8)) {
      const formInfo = {
        action: form.action || "",
        method: form.method || "get",
        fields: []
      };
      const fields = form.querySelectorAll("input:not([type='hidden']), textarea, select");
      for (const field of Array.from(fields).slice(0, 15)) {
        // Find if this field already has a label
        let existingLabel = null;
        for (const [lbl, el] of _labelMap) {
          if (el === field) { existingLabel = lbl; break; }
        }
        formInfo.fields.push({
          label: existingLabel || assignLabel(field),
          type: field.type || field.tagName.toLowerCase(),
          name: field.name || field.id || "",
          placeholder: field.placeholder || "",
          value: (field.value || "").slice(0, 100),
          required: field.required || false
        });
      }
      result.forms.push(formInfo);
    }
  }

  return result;
}

// ── Get meta tags ──
function getMetaTags() {
  const metas = {};
  document.querySelectorAll("meta[name], meta[property]").forEach((m) => {
    const key = m.getAttribute("name") || m.getAttribute("property");
    if (key) metas[key] = (m.content || "").slice(0, 200);
  });
  return metas;
}

// ── Check if element is visible ──
function isElementVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

// ── Get element text (smart) ──
function getElementText(el) {
  return (
    el.textContent?.trim() ||
    el.value ||
    el.getAttribute("aria-label") ||
    el.getAttribute("title") ||
    el.getAttribute("alt") ||
    el.placeholder ||
    ""
  );
}

// ── Resolve element by label, selector, or text ──
function resolveElement(label, selector, text) {
  // Try label first
  if (label !== undefined && label !== null) {
    const el = getElementByLabel(Number(label));
    if (el) return el;
  }

  // Try CSS selector
  if (selector) {
    try {
      const el = document.querySelector(selector);
      if (el) return el;
    } catch {}
  }

  // Try text matching — broad search for SPA compatibility
  if (text) {
    // Expand the search scope to include nav items, list items, and any clickable element
    const searchScope = [
      "a", "button",
      "[role='button']", "[role='tab']", "[role='menuitem']", "[role='link']", "[role='option']",
      "[onclick]", "input[type='submit']", "input[type='button']",
      "nav li", "li a", "li button",
      "[tabindex]:not([tabindex='-1'])"
    ];
    const all = document.querySelectorAll(searchScope.join(","));
    const needle = text.toLowerCase().trim();

    // Pass 1: exact text match (faster and more accurate)
    for (const candidate of all) {
      if (!isElementVisible(candidate)) continue;
      const candidateText = getElementText(candidate).toLowerCase().trim();
      if (candidateText === needle) return candidate;
    }

    // Pass 2: check aria-label and title attributes (common in SPAs)
    for (const candidate of all) {
      if (!isElementVisible(candidate)) continue;
      const ariaLabel = (candidate.getAttribute("aria-label") || "").toLowerCase();
      const title = (candidate.getAttribute("title") || "").toLowerCase();
      if (ariaLabel === needle || title === needle) return candidate;
    }

    // Pass 3: partial text includes (most lenient)
    for (const candidate of all) {
      if (!isElementVisible(candidate)) continue;
      const candidateText = getElementText(candidate).toLowerCase();
      const ariaLabel = (candidate.getAttribute("aria-label") || "").toLowerCase();
      const title = (candidate.getAttribute("title") || "").toLowerCase();
      if (candidateText.includes(needle) || ariaLabel.includes(needle) || title.includes(needle)) {
        return candidate;
      }
    }
  }

  return null;
}

// ── Click element by label, CSS selector, or visible text ──
async function clickElement(selector, text, label) {
  const el = resolveElement(label, selector, text);

  if (!el) {
    return {
      success: false,
      error: `Element not found: label=${label}, selector="${selector}", text="${text}". Tip: use navigate with a direct URL instead, or try read_page first to get element labels.`
    };
  }

  showActionIndicator(el, "clicking");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  await sleep(300);

  // Dispatch full mouse event sequence for SPA frameworks (React, Vue, etc.)
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseup",   { bubbles: true }));
  el.click();

  return { success: true, element: el.tagName, text: getElementText(el).slice(0, 50) };
}

// ── Fill input — uses native input setter to work with React/Vue ──
async function fillInput(selector, value, label, clear = true) {
  const el = resolveElement(label, selector, null);
  if (!el) return { success: false, error: `Input not found: label=${label}, selector="${selector}"` };

  showActionIndicator(el, "filling");

  // Use native value setter so React/Vue controlled inputs update correctly
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, "value"
  )?.set;
  const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, "value"
  )?.set;

  const setter = el.tagName === "TEXTAREA" ? nativeTextareaSetter : nativeInputValueSetter;

  // Focus first
  el.focus();

  if (clear !== false && setter) {
    setter.call(el, "");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));

  return { success: true };
}

// ── Scroll to element ──
async function scrollToElement(label, selector) {
  const el = resolveElement(label, selector, null);
  if (!el) return { success: false, error: "Element not found" };
  showActionIndicator(el, "hovering"); // Just highlight it
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  return { success: true };
}

// ── Hover element ──
async function hoverElement(label, selector, text) {
  const el = resolveElement(label, selector, text);
  if (!el) return { success: false, error: "Element not found" };

  showActionIndicator(el, "hovering");
  el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));

  return { success: true, element: el.tagName, text: getElementText(el).slice(0, 50) };
}

// ── Select option ──
async function selectOption(label, selector, value) {
  const el = resolveElement(label, selector, null);
  if (!el || el.tagName !== "SELECT") return { success: false, error: "Select element not found" };

  showActionIndicator(el, "selecting");

  // Try matching by value first, then by text
  let found = false;
  for (const opt of el.options) {
    if (opt.value === value || opt.textContent.trim().toLowerCase() === value.toLowerCase()) {
      el.value = opt.value;
      found = true;
      break;
    }
  }

  if (!found) return { success: false, error: `Option "${value}" not found in select` };

  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));

  return { success: true };
}

// ── Query Elements ──
function queryElements(selector, limit = 10) {
  try {
    const els = document.querySelectorAll(selector);
    const results = Array.from(els).slice(0, limit).map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        text: getElementText(el).slice(0, 100),
        visible: isElementVisible(el),
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        attributes: getKeyAttributes(el)
      };
    });
    return { success: true, count: els.length, results };
  } catch (e) {
    return { success: false, error: `Invalid selector: ${e.message}` };
  }
}

// ── Get Element Info ──
function getElementInfo(label, selector) {
  const el = resolveElement(label, selector, null);
  if (!el) return { success: false, error: "Element not found" };

  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);

  return {
    success: true,
    info: {
      tag: el.tagName.toLowerCase(),
      text: getElementText(el).slice(0, 200),
      html: el.outerHTML.slice(0, 500),
      visible: isElementVisible(el),
      disabled: el.disabled || false,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      attributes: getKeyAttributes(el),
      computedStyle: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        color: style.color,
        backgroundColor: style.backgroundColor,
        fontSize: style.fontSize
      },
      aria: {
        role: el.getAttribute("role"),
        label: el.getAttribute("aria-label"),
        describedBy: el.getAttribute("aria-describedby"),
        expanded: el.getAttribute("aria-expanded"),
        selected: el.getAttribute("aria-selected"),
        hidden: el.getAttribute("aria-hidden")
      }
    }
  };
}

// ── Get Form Data ──
function getFormData(selector) {
  const forms = selector
    ? [document.querySelector(selector)].filter(Boolean)
    : Array.from(document.querySelectorAll("form"));

  if (forms.length === 0) return { success: true, forms: [] };

  const result = forms.slice(0, 5).map((form) => {
    const fields = Array.from(form.querySelectorAll("input:not([type='hidden']), textarea, select"))
      .slice(0, 20)
      .map((f) => ({
        tag: f.tagName.toLowerCase(),
        type: f.type || f.tagName.toLowerCase(),
        name: f.name || f.id || "",
        placeholder: f.placeholder || "",
        value: (f.value || "").slice(0, 200),
        required: f.required,
        disabled: f.disabled,
        readonly: f.readOnly,
        options: f.tagName === "SELECT"
          ? Array.from(f.options).map((o) => ({ value: o.value, text: o.text, selected: o.selected }))
          : undefined
      }));
    return {
      action: form.action || "",
      method: form.method || "get",
      id: form.id || "",
      name: form.name || "",
      fields
    };
  });

  return { success: true, forms: result };
}

// ── Count Elements ──
function countElements(selector) {
  try {
    const count = document.querySelectorAll(selector).length;
    return { success: true, count };
  } catch (e) {
    return { success: false, error: `Invalid selector: ${e.message}` };
  }
}

// ── Evaluate JS ──
async function evaluateJS(expression) {
  // Security: block dangerous patterns (enhanced)
  // NOTE: Blocklist approach; prefer whitelist for true sandboxing.
  const blocked = [
    // Network
    "fetch(", "xmlhttprequest", "navigator.sendbeacon",
    // Code execution
    "eval(", "function(", "import(", "settimeout(", "setinterval(",
    "new function", "(0,eval)", "[`eval`]",
    // Chrome extension APIs
    "chrome.",
    // Sensitive storage & cookies
    "document.cookie", "localstorage", "sessionstorage",
    "indexeddb", "caches.", "serviceworker",
    // Navigation hijacking
    "location.href =", "location.assign", "location.replace",
    "location.reload", "history.push", "history.replace",
    // Window abuse
    "window.open", "window.close",
    // Global object bypasses
    "globalthis", "self.", "top.", "parent.", "frames[",
    // Encoding obfuscation
    "\\x", "\\u", "atob(", "btoa(",
    // Sensitive DOM reads
    "document.forms", "document.body.innerhtml", "document.documentelement",
    // Prototype pollution
    "__proto__", "constructor[", ".constructor",
    // Node.js/Worker globals that may exist
    "require(", "process.", "module."
  ];

  // Hard length cap to prevent obfuscation via very long strings
  if (!expression || typeof expression !== "string" || expression.length > 500) {
    return { success: false, error: "Expression too long or invalid" };
  }

  const lowerExpr = expression.toLowerCase();
  for (const pattern of blocked) {
    if (lowerExpr.includes(pattern.toLowerCase())) {
      return { success: false, error: `Blocked expression pattern: ${pattern}` };
    }
  }

  try {
    const fn = new Function(`"use strict"; return (${expression})`);
    const result = fn();
    // Serialize result
    const serialized = typeof result === "object" ? JSON.stringify(result, null, 2)?.slice(0, 3000) : String(result);
    return { success: true, result: serialized };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Extract Structured Data ──
function extractData(selector, fields, limit = 20) {
  try {
    const containers = document.querySelectorAll(selector);
    const items = [];

    for (const container of Array.from(containers).slice(0, limit)) {
      const item = {};
      if (fields && typeof fields === "object") {
        for (const [fieldName, fieldSelector] of Object.entries(fields)) {
          // Support @attr syntax: "a@href" means get href attribute from <a>
          const [sel, attr] = fieldSelector.split("@");
          const el = container.querySelector(sel);
          if (el) {
            item[fieldName] = attr ? (el.getAttribute(attr) || "") : (el.textContent?.trim() || "");
          } else {
            item[fieldName] = "";
          }
        }
      } else {
        item.text = container.textContent?.trim().slice(0, 200) || "";
      }
      items.push(item);
    }

    return { success: true, count: containers.length, items };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ── Wait for Element ──
async function waitForElement(selector, timeout = 5000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    const el = document.querySelector(selector);
    if (el && isElementVisible(el)) {
      return { success: true, found: true };
    }
    await sleep(250);
  }
  return { success: true, found: false, timeout: true };
}

// ── Get key attributes of an element ──
function getKeyAttributes(el) {
  const attrs = {};
  const keys = ["id", "class", "name", "href", "src", "type", "value", "placeholder",
    "data-testid", "data-id", "aria-label", "title", "alt", "role"];
  for (const key of keys) {
    const val = el.getAttribute(key);
    if (val) attrs[key] = val.slice(0, 100);
  }
  return attrs;
}

// ── Visual feedback — pulsing ring indicator on element ──

function showNavigatingIndicator(url) {
  const overlay = document.createElement("div");
  overlay.id = "__ai_nav_overlay__";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", zIndex: "2147483647",
    background: "rgba(12,12,15,0.85)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    gap: "12px", fontFamily: "system-ui, sans-serif"
  });

  // Security: build overlay with DOM API, not innerHTML, to prevent XSS via malicious URLs
  const iconEl = document.createElement("div");
  Object.assign(iconEl.style, { fontSize: "36px", animation: "__ai_ring_pulse__ 1s ease-in-out infinite" });
  iconEl.textContent = "🌐";

  const labelEl = document.createElement("div");
  Object.assign(labelEl.style, { color: "#e2e2ee", fontSize: "15px", fontWeight: "600" });
  labelEl.textContent = "Navigating...";

  const urlEl = document.createElement("div");
  Object.assign(urlEl.style, { color: "#888899", fontSize: "12px", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
  urlEl.textContent = url; // textContent auto-escapes — safe against XSS

  overlay.appendChild(iconEl);
  overlay.appendChild(labelEl);
  overlay.appendChild(urlEl);

  const s = document.createElement("style");
  s.textContent = "@keyframes __ai_ring_pulse__ { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.7;transform:scale(1.08)} }";
  document.head.appendChild(s);
  document.body.appendChild(overlay);
}

let _indicatorTimeout = null;
function showActionIndicator(el, label) {
  try {
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  } catch (e) {}

  // Remove previous indicator
  const prev = document.getElementById("__ai_action_ring__");
  if (prev) prev.remove();
  const prevBox = document.getElementById("__ai_action_box__");
  if (prevBox) prevBox.remove();
  const prevStyle = document.getElementById("__ai_ring_style__");
  if (prevStyle) prevStyle.remove();

  let rect = { top: 0, left: 0, width: 0, height: 0 };
  try {
    if (el && el.getBoundingClientRect) {
      const domRect = el.getBoundingClientRect();
      if (domRect) rect = domRect;
    }
  } catch (e) {}
  
  // Highlight box over the element
  const box = document.createElement("div");
  box.id = "__ai_action_box__";
  Object.assign(box.style, {
    position: "fixed",
    zIndex: "2147483646",
    border: "3px solid #a855f7",
    backgroundColor: "rgba(168, 85, 247, 0.15)",
    borderRadius: "4px",
    pointerEvents: "none",
    animation: "__ai_box_pulse__ 0.8s ease-in-out infinite alternate",
    transition: "all 0.2s ease"
  });

  const style = document.createElement("style");
  style.id = "__ai_ring_style__";
  style.textContent = `
    @keyframes __ai_box_pulse__ {
      0% { transform: scale(1); box-shadow: 0 0 0px rgba(168, 85, 247, 0); }
      100% { transform: scale(1.02); box-shadow: 0 0 15px rgba(168, 85, 247, 0.5); }
    }
  `;
  document.head.appendChild(style);
  box.style.top = (rect.top || 0) + "px";
  box.style.left = (rect.left || 0) + "px";
  box.style.width = (rect.width || 0) + "px";
  box.style.height = (rect.height || 0) + "px";

  // Label ring
  const ring = document.createElement("div");
  ring.id = "__ai_action_ring__";
  const icons = { clicking: "👆 Clicking", filling: "✏️ Typing", hovering: "🖱️ Hovering", selecting: "☑️ Selecting" };
  ring.textContent = icons[label] || "🔧 Action";
  Object.assign(ring.style, {
    position: "fixed",
    zIndex: "2147483647",
    background: "rgba(168, 85, 247, 0.95)",
    color: "#fff",
    borderRadius: "6px",
    padding: "4px 10px",
    fontSize: "12px",
    fontFamily: "system-ui, sans-serif",
    fontWeight: "600",
    pointerEvents: "none",
    boxShadow: "0 4px 20px rgba(108,99,255,0.5)",
    whiteSpace: "nowrap"
  });
  ring.style.top = Math.max(0, (rect.top || 0) - 36) + "px";
  ring.style.left = Math.max(0, (rect.left || 0)) + "px";

  const ringStyle = document.createElement("style");
  ringStyle.id = "__ai_ring_style__";
  ringStyle.textContent = `
    @keyframes __ai_ring_pulse__ {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.05); }
      100% { opacity: 1; transform: scale(1); }
    }
    #__ai_action_ring__, #__ai_action_box__ { animation: __ai_ring_pulse__ 1s ease-in-out infinite; }
  `;
  document.head.appendChild(ringStyle);

  document.body.appendChild(box);
  document.body.appendChild(ring);
}
  
// ── Highlight selection listener — debounced, min 20 chars ──
const handleSelection = debounce(() => {
  const selected = window.getSelection().toString().trim();
  if (selected.length >= 20) {
    chrome.runtime.sendMessage({
      type: "TEXT_SELECTED",
      text: selected.slice(0, 2000),
      url: window.location.href
    }).catch(() => {});
  }
}, 400);

document.addEventListener("mouseup", handleSelection);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Working Frame Indicator ──
function toggleWorkingFrame(active) {
  let frame = document.getElementById("__ai_working_frame__");
  if (active) {
    if (!frame) {
      frame = document.createElement("div");
      frame.id = "__ai_working_frame__";
      Object.assign(frame.style, {
        position: "fixed",
        top: "0",
        left: "0",
        right: "0",
        bottom: "0",
        zIndex: 2147483645,
        pointerEvents: "none",
        border: "6px solid rgba(168, 85, 247, 0.7)",
        boxShadow: "inset 0 0 40px rgba(168, 85, 247, 0.4)",
        transition: "all 0.3s ease"
      });
      document.body.appendChild(frame);
    }
  } else {
    if (frame) frame.remove();
  }
}
