// prompt-engine.js — Dynamic prompt builder & agent loop controller
// Loaded by sidebar.html after tools-registry.js, before sidebar.js

const PromptEngine = (() => {
  // ── Prompt Modes ──
  const MODES = {
    agent: {
      name: "Agent",
      icon: "🤖",
      persona: `You are Mini Browser Agent — an AI assistant embedded as a Chrome extension sidebar.
You have real capabilities to control the user's browser and can complete multi-step tasks autonomously.
You are precise, efficient, and never ask for unnecessary confirmation.`
    },
    reader: {
      name: "Reader",
      icon: "📖",
      persona: `You are a smart page reader and summarizer. Your job is to read, analyze, and explain web content.
Focus on extracting key information, summarizing clearly, and answering questions about page content.
You can read pages and take screenshots but avoid clicking or navigating unless explicitly asked.`
    },
    form_filler: {
      name: "Form Filler",
      icon: "📝",
      persona: `You are a form-filling specialist. Your job is to help users fill out web forms efficiently.
Always read the page first to understand the form structure, then fill fields step by step.
After filling, always review the form data before submitting.`
    },
    researcher: {
      name: "Researcher",
      icon: "🔬",
      persona: `You are a web researcher. Your job is to find information across multiple pages and tabs.
Open new tabs for different sources, read and compare content, then synthesize findings.
Always cite your sources with URLs.`
    }
  };

  let _currentMode = "agent";
  let _customInstructions = "";
  let _taskPlan = null;

  // ── Core Prompt Builder ──

  function buildSystemPrompt(options = {}) {
    const mode = MODES[_currentMode] || MODES.agent;
    const parts = [];

    // 1. Persona layer
    parts.push(mode.persona);

    // 2. Tool layer — auto-generated from ToolRegistry
    if (typeof ToolRegistry !== "undefined") {
      const toolBlock = ToolRegistry.toPromptBlock();
      if (toolBlock) parts.push(toolBlock);
    }

    // 3. Rules layer
    parts.push(_buildRules());

    // 4. Custom instructions
    if (_customInstructions) {
      parts.push(`\n[CUSTOM INSTRUCTIONS]\n${_customInstructions}\n[END CUSTOM INSTRUCTIONS]`);
    }

    // 5. Task plan layer (if active)
    if (_taskPlan) {
      parts.push(_buildTaskPlanBlock());
    }

    // 6. Memory layer — injected by caller (sidebar.js)
    // (not handled here — memory block is appended externally)

    return parts.join("\n\n");
  }

  function _buildRules() {
    const rules = [
      "Break complex tasks into steps, one action per reply.",
      "After navigate or new_tab, always follow with read_page to see the result.",
      "After filling an input, press Enter or click the submit button if appropriate.",
      "After each action you receive the result — use it to decide the next step.",
      "Use the 'done' action when the full task is complete, with a summary.",
      "Never ask the user for confirmation mid-task — just proceed.",
      "Reply in the same language as the user.",
      "When referencing elements, prefer label numbers [1], [2], etc. from the page content.",
      "If an action fails, try an alternative approach before giving up.",
      "Keep your text replies concise — focus on actions, not explanations."
    ];

    return "RULES:\n" + rules.map((r) => `- ${r}`).join("\n");
  }

  // ── Task Planning ──

  function createTaskPlan(goal, steps = []) {
    _taskPlan = {
      goal,
      steps: steps.map((s, i) => ({ id: i + 1, text: s, status: "pending" })),
      currentStep: 0,
      createdAt: Date.now()
    };
    return _taskPlan;
  }

  function updateTaskStep(stepId, status) {
    if (!_taskPlan) return null;
    const step = _taskPlan.steps.find((s) => s.id === stepId);
    if (step) step.status = status; // "pending" | "running" | "done" | "failed" | "skipped"
    return _taskPlan;
  }

  function advanceTask() {
    if (!_taskPlan) return null;
    _taskPlan.currentStep++;
    if (_taskPlan.currentStep <= _taskPlan.steps.length) {
      updateTaskStep(_taskPlan.currentStep, "running");
    }
    return _taskPlan;
  }

  function clearTaskPlan() {
    _taskPlan = null;
  }

  function getTaskPlan() {
    return _taskPlan;
  }

  function _buildTaskPlanBlock() {
    if (!_taskPlan) return "";
    const lines = _taskPlan.steps.map((s) => {
      const icon = s.status === "done" ? "✅" : s.status === "running" ? "🔄" : s.status === "failed" ? "❌" : "⬜";
      return `${icon} Step ${s.id}: ${s.text}`;
    });
    return `\n[CURRENT TASK PLAN]\nGoal: ${_taskPlan.goal}\n${lines.join("\n")}\n[END TASK PLAN]`;
  }

  // ── Page Context Builder ──

  function buildPageContextBlock(pageContent) {
    if (!pageContent) return "";
    const parts = [`[CURRENT PAGE]`];

    if (pageContent.title) parts.push(`Title: ${pageContent.title}`);
    if (pageContent.url) parts.push(`URL: ${pageContent.url}`);

    if (pageContent.text) {
      parts.push(`\nContent:\n${pageContent.text}`);
    }

    if (pageContent.labels && pageContent.labels.length > 0) {
      const labelLines = pageContent.labels.map((l) =>
        `[${l.id}] ${l.tag} ${l.role ? `(${l.role})` : ""}: "${l.text}" ${l.name ? `name="${l.name}"` : ""}`
      ).join("\n");
      parts.push(`\nInteractive Elements:\n${labelLines}`);
    }

    if (pageContent.forms && pageContent.forms.length > 0) {
      const formLines = pageContent.forms.map((f, i) => {
        const fields = f.fields.map((fd) =>
          `  - [${fd.label}] ${fd.type} "${fd.name || fd.placeholder || ''}" ${fd.value ? `= "${fd.value}"` : ""} ${fd.required ? "(required)" : ""}`
        ).join("\n");
        return `Form ${i + 1}${f.action ? ` (action: ${f.action})` : ""}:\n${fields}`;
      }).join("\n");
      parts.push(`\nForms:\n${formLines}`);
    }

    if (pageContent.links && pageContent.links.length > 0) {
      const linkLines = pageContent.links
        .slice(0, 15)
        .map((l) => `  - [${l.label || "?"}] "${l.text}" → ${l.href}`)
        .join("\n");
      parts.push(`\nLinks:\n${linkLines}`);
    }

    parts.push(`[END PAGE]`);
    return parts.join("\n");
  }

  // ── History Compression ──

  function compressHistory(messages, maxTurns = 20) {
    if (messages.length <= maxTurns * 2) return messages;

    // Keep first 2 messages (initial context) + last maxTurns*2 messages
    const kept = messages.slice(-maxTurns * 2);

    // Summarize older messages into a single context message
    const older = messages.slice(0, -maxTurns * 2);
    const summary = older
      .filter((m) => m.role === "user")
      .map((m) => m.content.slice(0, 100))
      .join("; ");

    if (summary) {
      kept.unshift({
        role: "system",
        content: `[Previous conversation summary: ${summary.slice(0, 500)}]`
      });
    }

    return kept;
  }

  // ── Action Parsing ──

  /**
   * Parse an AI response to extract action JSON.
   * Supports multiple formats:
   * 1. ```action { ... } ```
   * 2. ```json { "type": "..." } ```
   * 3. Bare JSON object with "type" field
   */
  function parseAction(responseText) {
    // Format 1: ```action ... ```
    const actionMatch = responseText.match(/```action\s*(\{.*?\})\s*```/s);
    if (actionMatch) {
      try { return JSON.parse(actionMatch[1]); } catch {}
    }

    // Format 2: ```json ... ``` with a "type" field
    const jsonMatch = responseText.match(/```json\s*(\{.*?\})\s*```/s);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.type) return parsed;
      } catch {}
    }

    // Format 3: bare JSON line with "type" (e.g. AI just outputs the JSON)
    const bareMatch = responseText.match(/\{[^{}]*"type"\s*:\s*"[^"]+?"[^{}]*\}/);
    if (bareMatch) {
      try { return JSON.parse(bareMatch[0]); } catch {}
    }

    return null;
  }

  // ── Mode Management ──

  function setMode(mode) {
    if (MODES[mode]) _currentMode = mode;
  }

  function getMode() {
    return _currentMode;
  }

  function getModes() {
    return Object.entries(MODES).map(([key, val]) => ({
      key,
      name: val.name,
      icon: val.icon
    }));
  }

  function setCustomInstructions(text) {
    _customInstructions = (text || "").trim().slice(0, 2000);
  }

  function getCustomInstructions() {
    return _customInstructions;
  }

  // ── Public API ──
  return {
    buildSystemPrompt,
    buildPageContextBlock,
    compressHistory,
    parseAction,
    createTaskPlan,
    updateTaskStep,
    advanceTask,
    clearTaskPlan,
    getTaskPlan,
    setMode,
    getMode,
    getModes,
    setCustomInstructions,
    getCustomInstructions
  };
})();

window.PromptEngine = PromptEngine;
