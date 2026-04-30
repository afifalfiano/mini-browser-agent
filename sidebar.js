// sidebar.js — Mini Browser Agent (Refactored with ToolRegistry + PromptEngine)

// ── DOM refs ──
const setupScreen      = document.getElementById("setup-screen");
const chatScreen       = document.getElementById("chat-screen");
const apiKeyInput      = document.getElementById("api-key-input");
const providerSelect   = document.getElementById("provider-select");
const modelSelect      = document.getElementById("model-select");
const saveBtn          = document.getElementById("save-btn");
const messagesEl       = document.getElementById("messages");
const chatInput        = document.getElementById("chat-input");
const sendBtn          = document.getElementById("send-btn");
const clearBtn         = document.getElementById("clear-btn");
const settingsBtn      = document.getElementById("settings-btn");
const headerModel      = document.getElementById("header-model");
const screenshotBtn    = document.getElementById("screenshot-btn");
const readPageBtn      = document.getElementById("read-page-btn");
const highlightToast   = document.getElementById("highlight-toast");
const highlightPreview = document.getElementById("highlight-preview");
const askHighlightBtn  = document.getElementById("ask-highlight-btn");
const inspectorBtn     = document.getElementById("inspector-btn");
const inspectorPanel   = document.getElementById("inspector-panel");
const chatPanel        = document.getElementById("chat-panel");
const modeSelector     = document.getElementById("mode-selector");
const stopBtn          = document.getElementById("stop-btn");
const taskProgress     = document.getElementById("task-progress");
const downloadBtn      = document.getElementById("download-btn");

// ── State ──
let conversationHistory = [];
let isLoading           = false;
let pendingHighlight    = null;
let stopRequested       = false;
let inspectorVisible    = false;
const MAX_HISTORY_TURNS = 20;
const MAX_AGENT_STEPS   = 25;

// ── Init ──
chrome.storage.local.get(["selected_provider", "minimax_api_key", "minimax_model", "agent_mode", "custom_instructions"], (data) => {
  if (chrome.runtime.lastError) {
    console.error("[Sidebar] Storage read error:", chrome.runtime.lastError.message);
    return;
  }
  
  const provider = data.selected_provider || "minimax";
  const hasKey = !!data.minimax_api_key;
  const model = data.minimax_model;

  if (hasKey) {
    showChatScreen(model || "MiniMax-M2.7");
  } else {
    // Populate setup screen
    providerSelect.value = provider;
    _updateModelOptions(provider);
  }

  // Restore agent mode
  if (data.agent_mode && typeof PromptEngine !== "undefined") {
    PromptEngine.setMode(data.agent_mode);
  }
  if (data.custom_instructions && typeof PromptEngine !== "undefined") {
    PromptEngine.setCustomInstructions(data.custom_instructions);
  }

  messagesEl.appendChild(buildWelcomeMsg());

  // Init mode selector
  initModeSelector();
  // Init inspector
  initInspector();
  // Log tool registry stats
  if (typeof ToolRegistry !== "undefined") {
    const stats = ToolRegistry.getStats();
    console.log(`[Sidebar] ToolRegistry ready: ${stats.totalTools} tools in ${stats.categories.length} categories`);
  }
});

// ── Mode Selector ──
function initModeSelector() {
  if (!modeSelector || typeof PromptEngine === "undefined") return;

  const modes = PromptEngine.getModes();
  modeSelector.innerHTML = modes.map((m) =>
    `<option value="${m.key}" ${m.key === PromptEngine.getMode() ? "selected" : ""}>${m.icon} ${m.name}</option>`
  ).join("");

  modeSelector.addEventListener("change", () => {
    PromptEngine.setMode(modeSelector.value);
    chrome.storage.local.set({ agent_mode: modeSelector.value });
  });
}

// ── Inspector Panel ──
function initInspector() {
  if (!inspectorBtn || !inspectorPanel) return;

  inspectorBtn.addEventListener("click", () => {
    inspectorVisible = !inspectorVisible;
    if (inspectorVisible) {
      inspectorPanel.classList.remove("hidden");
      if (chatPanel) chatPanel.classList.add("hidden");
      renderInspector();
    } else {
      inspectorPanel.classList.add("hidden");
      if (chatPanel) chatPanel.classList.remove("hidden");
    }
  });
}

function renderInspector() {
  if (!inspectorPanel || typeof ToolRegistry === "undefined") return;

  const tools = ToolRegistry.getAll();
  const events = ToolRegistry.getEvents(50);
  const categories = ToolRegistry.getCategories();

  // ── Toolbar row ──
  let html = `<div class="inspector-toolbar">
    <button class="insp-btn" id="insp-analyze-btn">🔍 Analyze Page</button>
    <button class="insp-btn" id="insp-export-btn">⬇ Export JSON</button>
    <button class="insp-btn insp-btn-dim" id="insp-clear-events-btn">🗑 Clear Events</button>
  </div>`;

  // ── Page Analysis Result placeholder ──
  html += `<div id="insp-analysis-result" class="insp-analysis hidden"></div>`;

  // ── Tool Execution Pane (shown when Execute is clicked) ──
  html += `<div id="insp-exec-pane" class="insp-exec-pane hidden">
    <div class="insp-exec-header">
      <span id="insp-exec-title">Execute tool</span>
      <button class="insp-close-btn" id="insp-exec-close">✕</button>
    </div>
    <div id="insp-exec-form" class="insp-exec-form"></div>
    <div class="insp-exec-actions">
      <button class="insp-run-btn" id="insp-exec-run">▶ Run</button>
    </div>
    <div id="insp-exec-result" class="insp-exec-result hidden"></div>
  </div>`;

  // ── Tool List ──
  html += `<div class="inspector-section">
    <h3 class="inspector-title">🔧 Registered Tools <span class="badge">${tools.length}</span></h3>`;

  for (const cat of categories) {
    const catTools = tools.filter((t) => t.category === cat);
    html += `<div class="inspector-category">
      <div class="inspector-cat-header">${cat} <span class="cat-count">${catTools.length}</span></div>`;

    for (const tool of catTools) {
      const props = tool.inputSchema?.properties || {};
      const hasInputs = Object.keys(props).length > 0;
      const schemaStr = _escapeHtml(JSON.stringify(props, null, 2));
      html += `<div class="inspector-tool" data-tool="${tool.name}">
        <div class="inspector-tool-header">
          <span class="tool-icon">${tool.icon}</span>
          <span class="tool-name">${tool.name}</span>
          ${tool.hidden ? '<span class="badge badge-dim">hidden</span>' : ''}
        </div>
        <div class="tool-desc">${_escapeHtml(tool.description)}</div>
        <details class="tool-schema-details">
          <summary>Schema ${hasInputs ? `(${Object.keys(props).length} params)` : "(no params)"}</summary>
          <pre class="tool-schema">${schemaStr}</pre>
        </details>
        <button class="btn-execute-tool" data-tool="${tool.name}">▶ Execute</button>
      </div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;

  // ── Event Timeline ──
  html += `<div class="inspector-section">
    <h3 class="inspector-title">📋 Event Timeline <span class="badge">${events.length}</span></h3>
    <div class="inspector-events" id="insp-events-list">`;

  if (events.length === 0) {
    html += `<div class="insp-empty">No events yet. Execute a tool to see activity.</div>`;
  }
  for (const evt of events.slice().reverse()) {
    const time = new Date(evt.ts).toLocaleTimeString();
    const icon = evt.type.includes("error") ? "❌" : evt.type.includes("executed") ? "✅" : evt.type.includes("executing") ? "⏳" : "📌";
    const durationStr = evt.duration ? ` <span class="event-duration">${evt.duration}ms</span>` : "";
    html += `<div class="inspector-event">
      <span class="event-icon">${icon}</span>
      <span class="event-time">${time}</span>
      <span class="event-type">${evt.type}</span>
      <span class="event-tool">${evt.tool || ""}</span>
      ${durationStr}
    </div>`;
  }
  html += `</div></div>`;

  inspectorPanel.innerHTML = html;
  _bindInspectorEvents();
}

// ── Bind all inspector events ──
function _bindInspectorEvents() {
  // Execute buttons → show inline form pane
  inspectorPanel.querySelectorAll(".btn-execute-tool").forEach((btn) => {
    btn.addEventListener("click", () => {
      const toolName = btn.dataset.tool;
      _openExecPane(toolName);
    });
  });

  // Close pane
  const closeBtn = document.getElementById("insp-exec-close");
  if (closeBtn) closeBtn.addEventListener("click", _closeExecPane);

  // Run button
  const runBtn = document.getElementById("insp-exec-run");
  if (runBtn) runBtn.addEventListener("click", _runExecPane);

  // Export JSON
  const exportBtn = document.getElementById("insp-export-btn");
  if (exportBtn) exportBtn.addEventListener("click", _exportToolsJSON);

  // Clear events
  const clearEvtBtn = document.getElementById("insp-clear-events-btn");
  if (clearEvtBtn) clearEvtBtn.addEventListener("click", () => {
    ToolRegistry.clearEvents();
    renderInspector();
  });

  // Analyze page
  const analyzeBtn = document.getElementById("insp-analyze-btn");
  if (analyzeBtn) analyzeBtn.addEventListener("click", _analyzePage);
}

// ── Open execution pane for a tool ──
function _openExecPane(toolName) {
  const tool = ToolRegistry.getTool(toolName);
  if (!tool) return;

  const pane = document.getElementById("insp-exec-pane");
  const titleEl = document.getElementById("insp-exec-title");
  const formEl = document.getElementById("insp-exec-form");
  const resultEl = document.getElementById("insp-exec-result");
  if (!pane || !formEl) return;

  titleEl.textContent = `${tool.icon} ${tool.name}`;
  resultEl.classList.add("hidden");
  resultEl.innerHTML = "";

  // Build form from inputSchema
  const props = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];

  if (Object.keys(props).length === 0) {
    formEl.innerHTML = `<p class="insp-no-params">This tool has no parameters.</p>`;
  } else {
    formEl.innerHTML = Object.entries(props).map(([key, prop]) => {
      const isRequired = required.includes(key);
      const defaultVal = prop.default !== undefined ? prop.default : (prop.example !== undefined ? prop.example : "");
      const labelText = `${key}${isRequired ? " *" : ""}`;
      const hint = prop.description || "";

      let inputHtml;
      if (prop.type === "boolean") {
        inputHtml = `<select class="insp-field-input" data-key="${key}" data-type="boolean">
          <option value="false" ${!defaultVal ? "selected" : ""}>false</option>
          <option value="true" ${defaultVal ? "selected" : ""}>true</option>
        </select>`;
      } else if (prop.type === "integer" || prop.type === "number") {
        inputHtml = `<input class="insp-field-input" type="number" data-key="${key}" data-type="${prop.type}"
          value="${defaultVal}" placeholder="${hint.slice(0, 40)}" />`;
      } else if (key === "expression" || key === "fields") {
        inputHtml = `<textarea class="insp-field-input insp-field-textarea" data-key="${key}" data-type="string"
          rows="3" placeholder="${_escapeHtml(hint.slice(0, 80))}">${defaultVal}</textarea>`;
      } else {
        inputHtml = `<input class="insp-field-input" type="text" data-key="${key}" data-type="string"
          value="${_escapeHtml(String(defaultVal))}" placeholder="${_escapeHtml(hint.slice(0, 60))}" />`;
      }

      return `<div class="insp-field">
        <label class="insp-field-label">${_escapeHtml(labelText)}</label>
        <div class="insp-field-hint">${_escapeHtml(hint)}</div>
        ${inputHtml}
      </div>`;
    }).join("");
  }

  // Store tool name for run handler
  pane.dataset.tool = toolName;
  pane.classList.remove("hidden");

  // Scroll pane into view
  pane.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function _closeExecPane() {
  const pane = document.getElementById("insp-exec-pane");
  if (pane) pane.classList.add("hidden");
}

// ── Run the tool from the pane ──
async function _runExecPane() {
  const pane = document.getElementById("insp-exec-pane");
  const resultEl = document.getElementById("insp-exec-result");
  const runBtn = document.getElementById("insp-exec-run");
  if (!pane || !resultEl) return;

  const toolName = pane.dataset.tool;
  const tool = ToolRegistry.getTool(toolName);
  if (!tool) return;

  // Collect param values from form fields
  const params = {};
  pane.querySelectorAll(".insp-field-input").forEach((input) => {
    const key = input.dataset.key;
    const type = input.dataset.type;
    let val = input.value.trim();
    if (!val) return;
    if (type === "integer") val = parseInt(val, 10);
    else if (type === "number") val = parseFloat(val);
    else if (type === "boolean") val = val === "true";
    else {
      // Try parsing JSON for object/array fields
      try { val = JSON.parse(val); } catch {}
    }
    params[key] = val;
  });

  // Disable run button during execution
  runBtn.disabled = true;
  runBtn.textContent = "⏳ Running...";
  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `<div class="insp-result-running">Executing ${toolName}...</div>`;

  try {
    const result = await ToolRegistry.execute(toolName, params);
    const resultStr = JSON.stringify(result, null, 2);

    resultEl.innerHTML = `
      <div class="insp-result-header">✅ Result</div>
      <pre class="insp-result-json">${_escapeHtml(resultStr)}</pre>`;

    // If screenshot result — show image
    if (result?.dataUrl && result.dataUrl.startsWith("data:image")) {
      resultEl.innerHTML += `<img class="insp-result-img" src="${result.dataUrl}" alt="screenshot" />`;
    }
    // If tool result has a page content block — show it nicely
    if (result?.content) {
      const c = result.content;
      resultEl.innerHTML += `<div class="insp-result-page">
        <strong>${_escapeHtml(c.title || "")}</strong><br>
        <span class="insp-result-url">${_escapeHtml(c.url || "")}</span>
        ${c.text ? `<pre class="insp-result-text">${_escapeHtml((c.text || "").slice(0, 1000))}</pre>` : ""}
      </div>`;
    }
  } catch (err) {
    resultEl.innerHTML = `<div class="insp-result-error">❌ ${_escapeHtml(err.message)}</div>`;
  }

  runBtn.disabled = false;
  runBtn.textContent = "▶ Run";

  // Refresh event timeline section without re-rendering whole inspector
  _refreshEventList();
}

// ── Export tool definitions as JSON ──
function _exportToolsJSON() {
  const schema = ToolRegistry.toSchemaJSON();
  const json = JSON.stringify(schema, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "minimax-agent-tools.json";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Page Analysis ──
async function _analyzePage() {
  const analysisEl = document.getElementById("insp-analysis-result");
  const analyzeBtn = document.getElementById("insp-analyze-btn");
  if (!analysisEl) return;

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "⏳ Analyzing...";
  analysisEl.classList.remove("hidden");
  analysisEl.innerHTML = `<div class="insp-analysis-loading">Reading page content...</div>`;

  try {
    const res = await sendToBackground({ type: "GET_PAGE_CONTENT", options: { mode: "full" } });
    if (!res.success || !res.content) {
      analysisEl.innerHTML = `<div class="insp-analysis-error">❌ Could not read page. Make sure you're on an http/https page.</div>`;
      return;
    }

    const content = res.content;
    const suggestions = _buildToolSuggestions(content);

    let html = `<div class="insp-analysis-header">
      <strong>📄 ${_escapeHtml(content.title || "Untitled")}</strong>
      <span class="insp-analysis-url">${_escapeHtml((content.url || "").slice(0, 60))}</span>
    </div>
    <div class="insp-analysis-stats">`;

    const labels = content.labels || [];
    const forms = content.forms || [];
    const links = content.links || [];

    html += `<span class="insp-stat">🏷️ ${labels.length} elements</span>`;
    html += `<span class="insp-stat">📝 ${forms.length} forms</span>`;
    html += `<span class="insp-stat">🔗 ${links.length} links</span>`;
    html += `</div>`;

    if (suggestions.length > 0) {
      html += `<div class="insp-analysis-suggestions">
        <div class="insp-suggestions-title">💡 Suggested Tools for This Page</div>`;
      for (const s of suggestions) {
        html += `<div class="insp-suggestion">
          <span class="insp-suggestion-icon">${s.icon}</span>
          <div class="insp-suggestion-content">
            <span class="insp-suggestion-tool">${s.tool}</span>
            <span class="insp-suggestion-reason">${s.reason}</span>
          </div>
          <button class="insp-suggestion-try" data-tool="${s.tool}">Try</button>
        </div>`;
      }
      html += `</div>`;
    }

    // Interactive elements preview
    if (labels.length > 0) {
      html += `<details class="insp-elements-details">
        <summary>Interactive Elements (${labels.length})</summary>
        <div class="insp-elements-list">`;
      for (const el of labels.slice(0, 20)) {
        html += `<div class="insp-element">
          <span class="insp-el-label">[${el.id}]</span>
          <span class="insp-el-tag">${el.tag}</span>
          <span class="insp-el-text">${_escapeHtml((el.text || el.placeholder || el.name || "").slice(0, 50))}</span>
        </div>`;
      }
      if (labels.length > 20) html += `<div class="insp-more">...and ${labels.length - 20} more</div>`;
      html += `</div></details>`;
    }

    analysisEl.innerHTML = html;

    // Bind suggestion Try buttons
    analysisEl.querySelectorAll(".insp-suggestion-try").forEach((btn) => {
      btn.addEventListener("click", () => {
        _openExecPane(btn.dataset.tool);
        analysisEl.scrollIntoView({ behavior: "smooth" });
      });
    });

  } catch (err) {
    analysisEl.innerHTML = `<div class="insp-analysis-error">❌ ${_escapeHtml(err.message)}</div>`;
  }

  analyzeBtn.disabled = false;
  analyzeBtn.textContent = "🔍 Analyze Page";
}

// ── Build tool suggestions based on page content ──
function _buildToolSuggestions(content) {
  const suggestions = [];
  const labels = content.labels || [];
  const forms = content.forms || [];
  const links = content.links || [];

  // Always useful
  suggestions.push({ tool: "screenshot", icon: "📸", reason: "Capture current state of the page" });
  suggestions.push({ tool: "read_page", icon: "📖", reason: "Read and summarize the full page content" });

  // Forms present → form-filling tools
  if (forms.length > 0) {
    suggestions.push({ tool: "fill_input", icon: "✏️", reason: `${forms.length} form(s) detected — fill in fields` });
    suggestions.push({ tool: "get_form_data", icon: "📝", reason: "Extract all form field data and current values" });
  }

  // Inputs in labels → click/fill
  const inputLabels = labels.filter((l) => ["input", "textarea", "select"].includes(l.tag));
  if (inputLabels.length > 0) {
    suggestions.push({ tool: "fill_input", icon: "✏️", reason: `${inputLabels.length} input(s) found (labels: ${inputLabels.map((l) => `[${l.id}]`).slice(0, 3).join(", ")})` });
  }

  // Links present → navigate
  if (links.length > 0) {
    suggestions.push({ tool: "navigate", icon: "🌐", reason: `${links.length} link(s) found — navigate to one` });
  }

  // Buttons present → click
  const buttonLabels = labels.filter((l) => l.tag === "button" || l.role === "button");
  if (buttonLabels.length > 0) {
    suggestions.push({ tool: "click", icon: "👆", reason: `${buttonLabels.length} button(s) detected (e.g. [${buttonLabels[0]?.id}] "${(buttonLabels[0]?.text || "").slice(0, 30)}")` });
  }

  // Scrollable-looking pages
  if ((content.text || "").length > 3000) {
    suggestions.push({ tool: "scroll", icon: "📜", reason: "Long page — scroll to see more content" });
  }

  // Deduplicate by tool name
  const seen = new Set();
  return suggestions.filter((s) => {
    if (seen.has(s.tool)) return false;
    seen.add(s.tool);
    return true;
  }).slice(0, 6);
}

// ── Refresh only the event list portion without full re-render ──
function _refreshEventList() {
  const listEl = document.getElementById("insp-events-list");
  if (!listEl) return;
  const events = ToolRegistry.getEvents(50);
  let html = "";
  if (events.length === 0) {
    html = `<div class="insp-empty">No events yet.</div>`;
  }
  for (const evt of events.slice().reverse()) {
    const time = new Date(evt.ts).toLocaleTimeString();
    const icon = evt.type.includes("error") ? "❌" : evt.type.includes("executed") ? "✅" : evt.type.includes("executing") ? "⏳" : "📌";
    const durationStr = evt.duration ? ` <span class="event-duration">${evt.duration}ms</span>` : "";
    html += `<div class="inspector-event">
      <span class="event-icon">${icon}</span>
      <span class="event-time">${time}</span>
      <span class="event-type">${evt.type}</span>
      <span class="event-tool">${evt.tool || ""}</span>
      ${durationStr}
    </div>`;
  }
  listEl.innerHTML = html;
}

// ── HTML escape helper ──
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Highlight toast ──
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "TEXT_SELECTED_SIDEBAR" && msg.text) {
    pendingHighlight = msg.text;
    const preview = msg.text.slice(0, 80) + (msg.text.length > 80 ? "…" : "");
    highlightPreview.textContent = '"' + preview + '"';
    highlightToast.classList.remove("hidden");
  }
});

askHighlightBtn.addEventListener("click", () => {
  if (!pendingHighlight) return;
  const prompt = 'I highlighted this text from the web page:\n\n"' + pendingHighlight + '"\n\nPlease explain or analyze this text.';
  highlightToast.classList.add("hidden");
  chatInput.value = prompt;
  sendMessage();
  pendingHighlight = null;
});

// ── Setup screen ──
function _updateModelOptions(provider) {
  let models = ["MiniMax-M2.7"];
  
  modelSelect.innerHTML = "";
  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    modelSelect.appendChild(opt);
  });
}

if (providerSelect) {
  providerSelect.addEventListener("change", () => {
    _updateModelOptions(providerSelect.value);
    chrome.storage.local.get(["minimax_api_key"], (data) => {
      apiKeyInput.value = data.minimax_api_key || "";
    });
  });
}

saveBtn.addEventListener("click", () => {
  const provider = providerSelect ? providerSelect.value : "minimax";
  const key = apiKeyInput.value.trim();
  const model = modelSelect.value;
  if (!key) { apiKeyInput.style.borderColor = "#f87171"; return; }
  apiKeyInput.style.borderColor = "";
  
  const payload = { selected_provider: provider };
  if (provider === "minimax") {
    payload.minimax_api_key = key;
    payload.minimax_model = model;
  }

  chrome.storage.local.set(payload, () => {
    if (chrome.runtime.lastError) { appendError("Failed to save settings: " + chrome.runtime.lastError.message); return; }
    showChatScreen(model);
  });
});

function showChatScreen(model) {
  setupScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  headerModel.textContent = model;
}

settingsBtn.addEventListener("click", () => {
  chrome.storage.local.get(["selected_provider", "minimax_api_key", "minimax_model"], (data) => {
    if (chrome.runtime.lastError) return;
    const provider = data.selected_provider || "minimax";
    if (providerSelect) providerSelect.value = provider;
    _updateModelOptions(provider);
    
    apiKeyInput.value = data.minimax_api_key || "";
    modelSelect.value = data.minimax_model || modelSelect.options[0].value;
  });
  chatScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
});

clearBtn.addEventListener("click", () => {
  conversationHistory = [];
  if (typeof PromptEngine !== "undefined") PromptEngine.clearTaskPlan();
  messagesEl.innerHTML = "";
  messagesEl.appendChild(buildWelcomeMsg("Chat cleared! Start a new conversation."));
  updateTaskProgressUI();
});

// ── Stop button ──
if (stopBtn) {
  stopBtn.addEventListener("click", () => {
    stopRequested = true;
    stopBtn.classList.add("hidden");
    appendActionStatus("⛔ Stopped by user", "done");
    isLoading = false;
    sendBtn.disabled = false;
    chatInput.focus();
  });
}

// ── Toolbar buttons ──
screenshotBtn.addEventListener("click", async () => {
  const s = appendActionStatus("Taking screenshot...", "running");
  const res = await sendToBackground({ type: "TAKE_SCREENSHOT" });
  s.remove();
  if (res.success) appendScreenshot(res.dataUrl);
  else appendError("Screenshot failed: " + res.error);
});

readPageBtn.addEventListener("click", () => {
  chatInput.value = "Read and summarize the page I currently have open.";
  sendMessage();
});

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("suggestion-chip")) {
    chatInput.value = e.target.dataset.prompt;
    sendMessage();
  }
});

// ── Input ──
chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + "px";
  sendBtn.disabled = !chatInput.value.trim() || isLoading;
});
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) sendMessage(); }
});
sendBtn.addEventListener("click", sendMessage);

// ── Send to background ──
function sendToBackground(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, (res) => {
      if (chrome.runtime.lastError) resolve({ success: false, error: chrome.runtime.lastError.message });
      else resolve(res || {});
    });
  });
}

// ── Build welcome message element ──
function buildWelcomeMsg(subtitle) {
  const div = document.createElement("div");
  div.className = "welcome-msg";

  const toolCount = typeof ToolRegistry !== "undefined" ? ToolRegistry.getVisible().length : 0;

  div.innerHTML = `
    <div class="welcome-icon" aria-hidden="true">🤖</div>
    <p><strong>Mini Browser Agent</strong></p>
    <p>${subtitle || `${toolCount} tools ready. I can read pages, click elements, navigate, fill forms, manage tabs, and more.`}</p>
    <div class="suggestions" role="list">
      <button class="suggestion-chip" data-prompt="Read and summarize this page" role="listitem">📄 Summarize this page</button>
      <button class="suggestion-chip" data-prompt="Take a screenshot of this page" role="listitem">📸 Screenshot</button>
      <button class="suggestion-chip" data-prompt="Open youtube.com in a new tab" role="listitem">🌐 Open YouTube</button>
      <button class="suggestion-chip" data-prompt="List all open tabs" role="listitem">📑 List tabs</button>
    </div>`;
  return div;
}

// ── Append error ──
function appendError(text) {
  const div = document.createElement("div");
  div.className = "msg msg-error";
  const icon = document.createElement("span");
  icon.textContent = "⚠️";
  const content = document.createElement("span");
  content.textContent = text;
  div.appendChild(icon);
  div.appendChild(content);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Append action status ──
function appendActionStatus(text, type) {
  const div = document.createElement("div");
  div.className = `msg msg-status msg-${type || "running"}`;
  const icon = document.createElement("span");
  icon.textContent = type === "done" ? "✅" : type === "error" ? "❌" : "⏳";
  const content = document.createElement("span");
  content.textContent = text;
  div.appendChild(icon);
  div.appendChild(content);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

// ── Append screenshot ──
function appendScreenshot(dataUrl) {
  const div = document.createElement("div");
  div.className = "msg msg-screenshot";
  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "Screenshot";
  img.style.maxWidth = "100%";
  img.style.borderRadius = "6px";
  div.appendChild(img);
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Append assistant message ──
function appendAssistantMsg(text) {
  const div = document.createElement("div");
  div.className = "msg msg-assistant";

  // Render text safely — convert newlines to <br> but escape HTML
  const safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/```action\s*\{.*?\}\s*```/gs, (match) => {
      // Dim the action block in display
      return `<span class="action-block">${match.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`;
    })
    .replace(/\n/g, "<br>");

  div.innerHTML = safe;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return div;
}

// ── Task Progress UI ──
function updateTaskProgressUI() {
  if (!taskProgress || typeof PromptEngine === "undefined") return;

  const plan = PromptEngine.getTaskPlan();
  if (!plan) {
    taskProgress.classList.add("hidden");
    taskProgress.innerHTML = "";
    return;
  }

  taskProgress.classList.remove("hidden");
  const stepsHtml = plan.steps.map((s) => {
    const icon = s.status === "done" ? "✅" : s.status === "running" ? "🔄" : s.status === "failed" ? "❌" : "⬜";
    const cls = `task-step task-step-${s.status}`;
    return `<div class="${cls}">${icon} ${s.text}</div>`;
  }).join("");

  taskProgress.innerHTML = `
    <div class="task-goal"><strong>🎯 ${plan.goal}</strong></div>
    ${stepsHtml}
  `;
}

// ── Send message — the main entry point ──
async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || isLoading) return;

  // Append user message
  const userDiv = document.createElement("div");
  userDiv.className = "msg msg-user";
  const userIcon = document.createElement("span");
  userIcon.textContent = "👤";
  const userContent = document.createElement("span");
  userContent.textContent = text;
  userDiv.appendChild(userIcon);
  userDiv.appendChild(userContent);
  messagesEl.appendChild(userDiv);
  chatInput.value = "";
  chatInput.style.height = "auto";
  sendBtn.disabled = true;
  isLoading = true;
  stopRequested = false;
  if (stopBtn) stopBtn.classList.remove("hidden");
  messagesEl.scrollTop = messagesEl.scrollHeight;

  conversationHistory.push({ role: "user", content: text });

  await runAgentLoop(text);
}

// ── Agent Loop — handles multi-step AI actions ──
function setWorkingFrame(active) {
  sendToBackground({ type: "BROWSER_ACTION", action: "set_working_frame", params: { active } }).catch(() => {});
}

async function runAgentLoop(initialPrompt) {
  let stepCount = 0;
  let contextUpdate = null;
  let isInitialMessage = true;

  setWorkingFrame(true);

  // Start recording session
  if (typeof SessionRecorder !== "undefined") {
    SessionRecorder.start(initialPrompt);
    if (downloadBtn) downloadBtn.classList.add("hidden");
  }

  while (stepCount < MAX_AGENT_STEPS && !stopRequested) {
    stepCount++;
    const _stepStart = Date.now();

    const statusDiv = appendActionStatus(stepCount === 1 ? "Thinking..." : `Step ${stepCount} — thinking...`, "running");

    try {
      // Load memory facts
      const facts = await MemoryManager.load();
      const memoryBlock = MemoryManager.toPromptBlock(facts);

      // Build system prompt from PromptEngine
      const systemPrompt = typeof PromptEngine !== "undefined"
        ? PromptEngine.buildSystemPrompt()
        : "You are a helpful browser AI agent.";

      // Compress history if needed
      const history = typeof PromptEngine !== "undefined"
        ? PromptEngine.compressHistory(conversationHistory, MAX_HISTORY_TURNS)
        : conversationHistory.slice(-MAX_HISTORY_TURNS * 2);

      // Build messages for API
      const apiMessages = [
        { role: "system", content: systemPrompt + memoryBlock }
      ];

      // Add conversation history (skip the last user message, we'll add it separately)
      const historyToSend = isInitialMessage
        ? history.slice(0, -1)
        : history;
      for (const m of historyToSend) {
        apiMessages.push({ role: m.role, content: m.content });
      }

      // Add current context
      if (isInitialMessage) {
        apiMessages.push({ role: "user", content: initialPrompt });
      } else if (contextUpdate) {
        apiMessages.push({ role: "user", content: contextUpdate });
      }

      // Get provider details
      const stored = await new Promise((resolve) => {
        chrome.storage.local.get(["selected_provider", "minimax_api_key", "minimax_model"], resolve);
      });
      
      const provider = stored.selected_provider || "minimax";
      const apiKey = stored.minimax_api_key;
      const model = stored.minimax_model;

      if (!apiKey) {
        throw new Error(`API key for ${provider} not configured. Click ⚙️ to set it.`);
      }

      // Call API
      const res = await sendToBackground({
        type: "PROVIDER_CHAT",
        provider: provider,
        payload: {
          apiKey: apiKey,
          model: model,
          messages: apiMessages
        }
      });

      statusDiv.remove();

      if (!res.success) {
        appendError(res.error || "Unknown error");
        break;
      }

      const reply = res.data?.content || "No response.";
      conversationHistory.push({ role: "assistant", content: reply });
      appendAssistantMsg(reply);
      isInitialMessage = false;

      // Parse action from response
      const action = typeof PromptEngine !== "undefined"
        ? PromptEngine.parseAction(reply)
        : parseActionFallback(reply);

      if (!action) {
        // No action — conversation is idle
        break;
      }

      // Handle done action
      if (action.type === "done") {
        appendActionStatus(action.summary || "Task complete ✅", "done");
        break;
      }

      // Execute the action
      if (stopRequested) break;

      const actionStatus = appendActionStatus(`Executing: ${action.type}...`, "running");

      try {
        let actionResult;
        const _actionStart = Date.now();

        // Check if tool is registered in ToolRegistry
        if (typeof ToolRegistry !== "undefined" && ToolRegistry.getTool(action.type)) {
          actionResult = await ToolRegistry.execute(action.type, action);
        } else {
          // Fallback to direct background message
          actionResult = await sendToBackground({
            type: "BROWSER_ACTION",
            action: action.type,
            params: action
          });
        }

        const _actionDuration = Date.now() - _actionStart;
        actionStatus.remove();

        // Take a screenshot after visual actions
        const visualActions = ["navigate", "click", "fill_input", "scroll", "new_tab", "hover", "select_option", "scroll_to"];
        let _capturedScreenshot = null;
        if (visualActions.includes(action.type)) {
          await sleep(800); // Wait for page to settle
          const ssRes = await sendToBackground({ type: "TAKE_SCREENSHOT" });
          if (ssRes.success) {
            appendScreenshot(ssRes.dataUrl);
            _capturedScreenshot = ssRes.dataUrl;
          }
        }

        // Record step
        if (typeof SessionRecorder !== "undefined") {
          SessionRecorder.recordStep({
            stepNum:      stepCount,
            action:       action.type,
            params:       action,
            result:       actionResult?.result ?? actionResult ?? null,
            success:      actionResult?.success !== false,
            errorMessage: actionResult?.error ?? null,
            duration:     _actionDuration
          });
          if (_capturedScreenshot) SessionRecorder.addScreenshot(stepCount, _capturedScreenshot);
        }

        appendActionStatus(`Done: ${action.type}`, "done");

        // Build context update for next iteration
        if (actionResult?.success === false) {
          contextUpdate = `[Action ${action.type} failed]: ${actionResult.error || "Unknown error"}`;
          conversationHistory.push({ role: "user", content: contextUpdate });
        } else if (action.type === "read_page" || action.type === "navigate" || action.type === "new_tab") {
          // Read page content after navigation
          await sleep(action.type === "navigate" || action.type === "new_tab" ? 2000 : 500);
          const pageRes = await sendToBackground({ type: "GET_PAGE_CONTENT", options: { mode: "full" } });
          if (pageRes.success && pageRes.content) {
            const pageBlock = typeof PromptEngine !== "undefined"
              ? PromptEngine.buildPageContextBlock(pageRes.content)
              : `[Page content]:\n${JSON.stringify(pageRes.content).slice(0, 3000)}`;
            contextUpdate = `[Action ${action.type} completed]\n${pageBlock}`;
          } else {
            contextUpdate = `[Action ${action.type} completed]\n[No page content available]`;
          }
          conversationHistory.push({ role: "user", content: contextUpdate });
        } else if (action.type === "screenshot") {
          contextUpdate = "[Screenshot taken and displayed to user]";
          conversationHistory.push({ role: "user", content: contextUpdate });
        } else if (action.type === "list_tabs" && actionResult?.result?.tabs) {
          const tabList = actionResult.result.tabs
            .map((t) => `  ${t.active ? "→" : " "} [${t.index}] ${t.title} — ${t.url}`)
            .join("\n");
          contextUpdate = `[Action ${action.type} completed]\nOpen tabs:\n${tabList}`;
          conversationHistory.push({ role: "user", content: contextUpdate });
        } else {
          contextUpdate = `[Action ${action.type} completed]: ${JSON.stringify(actionResult?.result || actionResult || {}).slice(0, 1000)}`;
          conversationHistory.push({ role: "user", content: contextUpdate });
        }

      } catch (e) {
        actionStatus.remove();
        appendError("Action error: " + e.message);
        contextUpdate = `[Action ${action.type} error]: ${e.message}`;
        conversationHistory.push({ role: "user", content: contextUpdate });
        if (typeof SessionRecorder !== "undefined") {
          SessionRecorder.recordStep({
            stepNum: stepCount, action: action.type, params: action,
            result: null, success: false, errorMessage: e.message,
            duration: Date.now() - (_stepStart || Date.now())
          });
        }
      }

    } catch (err) {
      statusDiv.remove();
      appendError(err.message || String(err));
      break;
    }
  }

  if (stepCount >= MAX_AGENT_STEPS) {
    appendError(`Agent reached maximum steps (${MAX_AGENT_STEPS}). Stopping.`);
  }

  // Finish recording and show download button
  if (typeof SessionRecorder !== "undefined") {
    SessionRecorder.end();
    if (downloadBtn && SessionRecorder.hasData()) {
      downloadBtn.classList.remove("hidden");
      downloadBtn.textContent = `📦 Download Report (${SessionRecorder.getSession()?.steps?.length ?? 0} steps)`;
    }
  }

  // Reset state
  isLoading = false;
  stopRequested = false;
  sendBtn.disabled = false;
  if (stopBtn) stopBtn.classList.add("hidden");
  chatInput.focus();
  updateTaskProgressUI();
  setWorkingFrame(false);
}

// ── Fallback action parser (when PromptEngine is not available) ──
function parseActionFallback(text) {
  const match = text.match(/```action\s*(\{.*?\})\s*```/s);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Download report button ──
if (downloadBtn) {
  downloadBtn.addEventListener("click", async () => {
    if (typeof SessionRecorder === "undefined" || !SessionRecorder.hasData()) return;
    downloadBtn.disabled = true;
    downloadBtn.textContent = "⏳ Building ZIP...";
    try {
      await SessionRecorder.downloadZip();
      downloadBtn.textContent = "✅ Downloaded!";
      setTimeout(() => { downloadBtn.textContent = `📦 Download Report`; downloadBtn.disabled = false; }, 2500);
    } catch (e) {
      downloadBtn.textContent = "❌ Failed";
      setTimeout(() => { downloadBtn.disabled = false; }, 2000);
      console.error("[Sidebar] ZIP download failed:", e);
    }
  });
}
