// tools-registry.js — Plugin-based Tool Registry (WebMCP-inspired)
// Loaded by sidebar.html before individual tool files and sidebar.js

/**
 * @typedef {{
 *   name: string,
 *   description: string,
 *   inputSchema: object,
 *   execute: (params: object, context: object) => Promise<object>,
 *   category?: string,
 *   icon?: string,
 *   hidden?: boolean
 * }} ToolDefinition
 *
 * @typedef {{ type: string, tool: string, data?: any, duration?: number, ts: number }} ToolEvent
 */

const ToolRegistry = (() => {
  /** @type {Map<string, ToolDefinition>} */
  const _tools = new Map();

  /** @type {ToolEvent[]} */
  const _events = [];
  const MAX_EVENTS = 200;

  /** @type {Map<string, Set<Function>>} */
  const _listeners = new Map();

  // ── Event System ──

  function _emit(eventType, detail) {
    const event = { type: eventType, ...detail, ts: Date.now() };
    _events.push(event);
    if (_events.length > MAX_EVENTS) _events.splice(0, _events.length - MAX_EVENTS);

    const fns = _listeners.get(eventType);
    if (fns) fns.forEach((fn) => { try { fn(event); } catch (e) { console.error("[ToolRegistry] Listener error:", e); } });
    // Also emit wildcard
    const allFns = _listeners.get("*");
    if (allFns) allFns.forEach((fn) => { try { fn(event); } catch (e) { console.error("[ToolRegistry] Listener error:", e); } });
  }

  function on(eventType, fn) {
    if (!_listeners.has(eventType)) _listeners.set(eventType, new Set());
    _listeners.get(eventType).add(fn);
    return () => _listeners.get(eventType)?.delete(fn);
  }

  // ── Registration ──

  function register(toolDef) {
    if (!toolDef.name || typeof toolDef.name !== "string") {
      throw new Error("[ToolRegistry] Tool must have a string 'name'");
    }
    if (!toolDef.description || typeof toolDef.description !== "string") {
      throw new Error(`[ToolRegistry] Tool '${toolDef.name}' must have a 'description'`);
    }
    if (typeof toolDef.execute !== "function") {
      throw new Error(`[ToolRegistry] Tool '${toolDef.name}' must have an 'execute' function`);
    }

    const existing = _tools.has(toolDef.name);
    _tools.set(toolDef.name, {
      category: "general",
      icon: "🔧",
      hidden: false,
      inputSchema: { type: "object", properties: {} },
      ...toolDef
    });

    _emit(existing ? "tool:updated" : "tool:registered", { tool: toolDef.name, definition: toolDef });
    return true;
  }

  function unregister(name) {
    if (!_tools.has(name)) return false;
    _tools.delete(name);
    _emit("tool:unregistered", { tool: name });
    return true;
  }

  // ── Retrieval ──

  function getTool(name) {
    return _tools.get(name) || null;
  }

  function getAll() {
    return Array.from(_tools.values());
  }

  function getVisible() {
    return Array.from(_tools.values()).filter((t) => !t.hidden);
  }

  function getByCategory(category) {
    return Array.from(_tools.values()).filter((t) => t.category === category);
  }

  function getCategories() {
    const cats = new Set();
    _tools.forEach((t) => cats.add(t.category || "general"));
    return Array.from(cats);
  }

  function getSchema(name) {
    const tool = _tools.get(name);
    return tool ? tool.inputSchema : null;
  }

  // ── Execution ──

  async function execute(name, params = {}, context = {}) {
    const tool = _tools.get(name);
    if (!tool) {
      _emit("tool:error", { tool: name, error: `Tool '${name}' not found` });
      throw new Error(`[ToolRegistry] Tool '${name}' not found`);
    }

    _emit("tool:executing", { tool: name, params });

    const startTime = performance.now();
    try {
      const result = await tool.execute(params, context);
      const duration = Math.round(performance.now() - startTime);
      _emit("tool:executed", { tool: name, params, result, duration });
      return result;
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      _emit("tool:error", { tool: name, params, error: err.message, duration });
      throw err;
    }
  }

  // ── Prompt Generation ──

  /**
   * Generate a formatted string of all visible tools for injection into the system prompt.
   * Output format matches the action block convention used by the agent.
   */
  function toPromptBlock() {
    const visible = getVisible();
    if (visible.length === 0) return "";

    const lines = visible.map((t) => {
      const example = _schemaToExample(t.inputSchema, t.name);
      return `• **${t.name}** — ${t.description}\n  Example:\n  \`\`\`action\n  ${JSON.stringify(example)}\n  \`\`\``;
    });

    return `
ACTION FORMAT — CRITICAL RULES:
To execute a browser action, output EXACTLY this format (and nothing else for that action):

\`\`\`action
{"type": "navigate", "url": "https://example.com"}
\`\`\`

RULES:
1. The block must start with \`\`\`action and end with \`\`\` — no other delimiters.
2. The JSON must be valid — double-quoted keys and strings, no trailing commas.
3. The "type" field must exactly match one of the tool names below.
4. Output ONE action block per reply. Wait for the result before the next action.
5. ❌ NEVER use formats like [TOOL_CALL], <tool>, XML tags, or any other syntax.
6. ❌ NEVER invent tool names not in the list below.
7. When the task is fully complete, use: \`\`\`action\n{"type": "done", "summary": "..."}\n\`\`\`

AVAILABLE TOOLS:

${lines.join("\n\n")}`;
  }

  /**
   * Generate a detailed JSON Schema description for tool inspector / documentation.
   */
  function toSchemaJSON() {
    const visible = getVisible();
    return visible.map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
      icon: t.icon,
      inputSchema: t.inputSchema
    }));
  }

  // ── Helpers ──

  function _schemaToExample(schema, toolName) {
    const example = { type: toolName };
    if (schema && schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (key === "type") continue; // skip — we already set it
        if (prop.example !== undefined) {
          example[key] = prop.example;
        } else if (prop.type === "string") {
          example[key] = prop.description ? `<${prop.description}>` : `<${key}>`;
        } else if (prop.type === "number" || prop.type === "integer") {
          example[key] = prop.default || 0;
        } else if (prop.type === "boolean") {
          example[key] = prop.default || false;
        }
      }
    }
    return example;
  }

  function getEvents(limit = 50) {
    return _events.slice(-limit);
  }

  function clearEvents() {
    _events.length = 0;
  }

  function getStats() {
    return {
      totalTools: _tools.size,
      visibleTools: getVisible().length,
      categories: getCategories(),
      totalEvents: _events.length
    };
  }

  // ── Public API ──
  return {
    register,
    unregister,
    getTool,
    getAll,
    getVisible,
    getByCategory,
    getCategories,
    getSchema,
    execute,
    toPromptBlock,
    toSchemaJSON,
    getEvents,
    clearEvents,
    getStats,
    on
  };
})();

// Export
window.ToolRegistry = ToolRegistry;
