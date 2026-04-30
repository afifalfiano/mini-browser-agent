# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chrome Extension (MV3) — AI browser agent powered by MiniMax API. Embeds a side panel with chat that controls the browser (navigate, click, fill forms, screenshots, page reading, tab management, DOM inspection).

## No Build Step

Pure Chrome extension. No bundler, no transpiler, no tests.

- Edit files directly
- Reload at `chrome://extensions` → click ↺ on the extension card
- Debug sidebar: right-click inside sidebar → Inspect
- Debug background: `chrome://extensions` → click "service worker" link

## Architecture

```
background.js       → Service worker. API calls, screenshots, tab control, message routing
content.js          → Injected into every page. DOM reading, clicking, scrolling, form filling,
                      element labeling system, DOM query, JS evaluation
tools-registry.js   → ToolRegistry — plugin-based tool registration & execution system
prompt-engine.js    → PromptEngine — dynamic system prompt builder, action parser, task planner
memory.js           → Session manager + MemoryManager. Loaded before sidebar.js via script tag
sidebar.html        → Side panel entry point (loads all scripts in order)
sidebar.js          → Chat UI logic, agent loop, inspector panel, action handlers
sidebar.css         → Styles (including inspector panel, task progress, message types)
config.js           → Default API key/model config

tools/              → Individual tool modules (each registers with ToolRegistry on load)
  navigate.js       → navigate, new_tab, go_back, go_forward, reload
  interact.js       → click, fill_input, press_enter, press_key, scroll, scroll_to, hover, select_option
  read-page.js      → read_page (with modes: full/text/interactive/metadata), get_selected_text, get_url
  screenshot.js     → screenshot, save_screenshot
  dom-query.js      → query_elements, get_element_info, get_form_data, count_elements
  wait.js           → wait, wait_for_element, wait_for_navigation
  evaluate.js       → evaluate_js, extract_data
  tab-manager.js    → list_tabs, switch_tab, close_tab, done
```

## Key Concepts

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

### Element Labeling (content.js)
- Every interactive element gets a label [1], [2], [3]...
- AI references elements by label instead of fragile CSS selectors
- Labels reset on each `GET_PAGE_CONTENT` call
- `resolveElement(label, selector, text)` tries label → selector → text matching

## Message Flow

1. User types in sidebar → `sidebar.js` calls `runAgentLoop()`
2. Agent loop builds system prompt via `PromptEngine.buildSystemPrompt()` + memory
3. API call via `background.js` → MiniMax API
4. Response parsed by `PromptEngine.parseAction()` → if action found, execute via `ToolRegistry`
5. Tool sends `BROWSER_ACTION` to `background.js` → delegates to `content.js`
6. Result fed back as context → loop continues until `done` action or max steps

## Key Constants

**memory.js:**
- `MAX_FACTS = 60` — max stored memory facts
- `MAX_SESSIONS = 20` — max saved sessions
- `MAX_MSGS_PER_SESSION = 100` — max messages per session

**sidebar.js:**
- `MAX_HISTORY_TURNS = 20` — turns sent to API per request
- `MAX_AGENT_STEPS = 25` — max actions per agent loop

**background.js:**
- API timeout: 60s
- max_tokens: 4096

## Data Storage

All persistence via `chrome.storage.local`:
- `agent_sessions` — `{ [id]: Session }`
- `agent_active_session` — session id string
- `agent_memory` — `MemoryFact[]`
- `minimax_api_key` — API key
- `minimax_model` — selected model
- `agent_mode` — current PromptEngine mode
- `custom_instructions` — user's custom prompt additions

## Security

- `background.js` validates `sender.origin` on all messages
- URL navigation restricted to `http:` and `https:` only
- API key checked before use
- 60s timeout on all API calls via AbortController
- `evaluate_js` blocks dangerous patterns (fetch, XMLHttpRequest, eval, chrome.*, document.cookie)
- All AI output rendered with HTML escaping (no raw innerHTML)
