# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (MV3) — AI browser agent. Embeds a side panel with chat that controls the browser (navigate, click, fill forms, screenshots, page reading, tab management, DOM inspection). Includes a realtime token usage summary panel that tracks cumulative tokens and estimated cost per session.

## No Build Step

Pure Chrome extension. No bundler, no transpiler.

- Edit files directly
- Reload at `chrome://extensions` → click ↺ on the extension card
- Debug sidebar: right-click inside sidebar → Inspect
- Debug background: `chrome://extensions` → click "service worker" link

### Tests

```bash
npm test
```

Runs 69 tests (Vitest + fast-check) covering the `TokenTracker` and `TokenDisplay` modules. Tests use jsdom and do not require a browser. `chrome.*` APIs are mocked per test.

## Architecture

```
background.js       → Service worker. API calls, screenshots, tab control, message routing
content.js          → Injected into every page. DOM reading, clicking, scrolling, form filling,
                      element labeling system, DOM query, JS evaluation, visual indicators
token-tracker.js    → TokenTracker (token extraction, accumulation, cost calc, storage persistence)
                      + TokenDisplay (DOM rendering of the token panel). Plain browser script,
                      no ESM — exposes globals via globalThis for both extension and test use.
tools-registry.js   → ToolRegistry — plugin-based tool registration & execution system
prompt-engine.js    → PromptEngine — dynamic system prompt builder, action parser, task planner
memory.js           → Session manager + MemoryManager.
session-recorder.js → Session recording tracker for ZIP report generation
lib/zip-builder.js  → Pure JS utility for creating .zip files
sidebar.html        → Side panel entry point (loads all scripts in order)
sidebar.js          → Chat UI logic, agent loop, inspector panel, action handlers
sidebar.css         → Styles (including inspector panel, task progress, message types, token panel)
config.js           → Default API key/model config

providers/          → Provider Architecture
  base.js           → ProviderManager (central registry for AI providers)

tools/              → Individual tool modules (each registers with ToolRegistry on load)
  navigate.js       → navigate, new_tab, go_back, go_forward, reload
  interact.js       → click, fill_input, press_enter, press_key, scroll, scroll_to, hover, select_option
  read-page.js      → read_page (with modes: full/text/interactive/metadata), get_selected_text, get_url
  screenshot.js     → screenshot, save_screenshot
  dom-query.js      → query_elements, get_element_info, get_form_data, count_elements
  wait.js           → wait, wait_for_element, wait_for_navigation
  evaluate.js       → evaluate_js, extract_data
  tab-manager.js    → list_tabs, switch_tab, close_tab, done

tests/              → Vitest test suite (jsdom environment)
  token-tracker.unit.test.js
  token-tracker.property.test.js      → Properties 1, 2, 3, 4, 5, 6, 7, 8
  token-display.unit.test.js
  token-display.property.test.js      → Properties 9, 10
  sidebar-integration.unit.test.js
  sidebar-integration.property.test.js → Property 11
  storage-integration.unit.test.js
  storage-integration.property.test.js → Properties 12, 13
```

## Key Concepts

### TokenTracker + TokenDisplay (token-tracker.js)
- Plain browser script (no ESM) — exposes `window.TokenTracker`, `window.TokenDisplay`, and internal helpers via `globalThis`.
- `TokenTracker.record({ raw, model, provider, promptMessages, completionText })` — extracts tokens from `raw.usage` or falls back to `ceil(chars/4)` estimation, calculates cost, accumulates state, persists to `chrome.storage.session`.
- `TokenDisplay.update(state)` — renders the token panel in the DOM; shows/hides based on `cumulativeTotalTokens > 0`.
- All operations are wrapped in try/catch — errors never propagate to the agent loop.
- Tested with Vitest + fast-check (13 correctness properties, 100 runs each).

### Multi-Provider Architecture (providers/)
- Handled by `ProviderManager` (`base.js`).
- Sidebar sends `{ type: "PROVIDER_CHAT", provider, payload }` to background.
- Each provider normalizes the API response to `{ content: "string", raw: { ... } }` so the sidebar logic remains provider-agnostic.

### ToolRegistry (tools-registry.js)
- Plugin system: each tool registers with `ToolRegistry.register({ name, description, inputSchema, execute })`
- Auto-generates system prompt tool blocks via `ToolRegistry.toPromptBlock()`
- Event system: `on("tool:registered")`, `on("tool:executed")`, etc.
- Inspector panel reads from `ToolRegistry.getAll()` and `ToolRegistry.getEvents()`

### PromptEngine (prompt-engine.js)
- Dynamic system prompt from registered tools: `PromptEngine.buildSystemPrompt()`
- Modes: agent, reader, form_filler, researcher
- Page context builder: `PromptEngine.buildPageContextBlock(pageContent)`
- Action parser: `PromptEngine.parseAction(responseText)` — supports ```action, ```json, bare JSON
- Task planning: `createTaskPlan()`, `advanceTask()`, etc.

### Element Labeling & Indicators (content.js)
- Every interactive element gets a label [1], [2], [3]...
- AI references elements by label instead of fragile CSS selectors
- Labels reset on each `GET_PAGE_CONTENT` call
- Visual action indicators (purple ring) and "working frame" (viewport border) alert the user during autonomous tasks.

## Message Flow

1. User types in sidebar → `sidebar.js` calls `runAgentLoop()`
2. Agent loop builds system prompt via `PromptEngine.buildSystemPrompt()` + memory
3. Gets provider settings from `chrome.storage.local`
4. API call via `background.js` → Provider API
5. Response parsed by `PromptEngine.parseAction()` → if action found, execute via `ToolRegistry`
6. Tool sends `BROWSER_ACTION` to `background.js` → delegates to `content.js`
7. Result fed back as context → loop continues until `done` action or max steps

## Key Constants

**memory.js:**
- `MAX_FACTS = 60`
- `MAX_SESSIONS = 20`
- `MAX_MSGS_PER_SESSION = 100`

**sidebar.js:**
- `MAX_HISTORY_TURNS = 20`
- `MAX_AGENT_STEPS = 25`

**background.js:**
- API timeout: 60s
- max_tokens: 4096

## Data Storage

All persistence via `chrome.storage.local` (and `chrome.storage.session` for token data):
- `agent_sessions` — `{ [id]: Session }`
- `agent_active_session` — session id string
- `agent_memory` — `MemoryFact[]`
- `selected_provider` — "minimax"
- `minimax_api_key` & `minimax_model`
- `agent_mode` — current PromptEngine mode
- `custom_instructions` — user's custom prompt additions
- `token_usage_session` — `TokenState` snapshot (session storage, cleared on chat reset)

## Security

- `background.js` validates `sender.origin` on all messages
- URL navigation restricted to `http:` and `https:` only
- API keys checked before use
- 60s timeout on all API calls via AbortController
- `evaluate_js` blocks dangerous patterns (fetch, XMLHttpRequest, eval, chrome.*, document.cookie)
- All AI output rendered with HTML escaping (no raw innerHTML)
