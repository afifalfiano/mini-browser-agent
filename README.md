# Mini Browser Agent

A Chrome extension that embeds an AI-powered sidebar to control your browser — navigate pages, click elements, fill forms, take screenshots, and chat with full memory across sessions.

---

## Features

- **AI Chat Sidebar** — talk to MiniMax AI directly inside Chrome via the side panel
- **Browser Control** — AI can navigate URLs, click elements, fill inputs, scroll, and open new tabs
- **Page Reader** — reads and summarizes the active page content
- **Screenshot** — captures the visible tab and displays it in chat
- **Text Highlight** — select any text on a page and instantly ask the AI about it
- **Conversation Sessions** — multiple named chat sessions, each persisted across browser restarts
- **Memory Context** — AI remembers facts about you across sessions (name, preferences, habits)
- **Secure by default** — CSP enforced, URL validation, sender origin checks, no external CDN

---

## Project Structure

```
├── manifest.json           # Chrome Extension manifest (MV3)
├── background.js           # Service worker — API calls, tab control, screenshot
├── content.js              # Injected into every page — DOM reading, clicking, scrolling
├── memory.js               # Session manager + memory bank (loaded before sidebar.js)
├── sidebar.html            # Side panel UI
├── sidebar.js              # Side panel logic — chat, agent loop, inspector
├── sidebar.css             # Side panel styles
├── prompt-engine.js        # System prompt builder, action parser, mode manager
├── tools-registry.js       # Central tool registry & event bus
├── tools/
│   ├── navigate.js         # navigate, new_tab, go_back, go_forward, reload
│   ├── interact.js         # click, fill_input, hover, scroll, scroll_to, select_option
│   ├── read-page.js        # read_page, get_url
│   ├── screenshot.js       # screenshot, download_screenshot
│   ├── dom-query.js        # query_elements, get_element_info, get_form_data, count_elements
│   ├── evaluate.js         # evaluate_js (sandboxed), extract_data
│   ├── wait.js             # wait_for_element, wait_for_navigation, sleep
│   └── tab-manager.js      # list_tabs, switch_tab, close_tab
├── providers/
│   ├── base.js             # ProviderManager — abstract API layer
│   └── minimax.js          # MiniMax API implementation
├── session-recorder.js     # Step-by-step session logger + ZIP exporter
├── lib/
│   └── zip-builder.js      # Pure-JS ZIP builder (no external deps)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Getting Started

### Prerequisites

- Google Chrome (version 114 or later — required for Side Panel API)
- A [MiniMax API key](https://www.minimaxi.chat)

### Load the Extension Locally

You don't need to publish to the Chrome Web Store to use this. Load it directly from your local folder:

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the project folder (the one containing `manifest.json`)
5. The extension will appear in your toolbar

### Configure the API Key

1. Click the **Mini Agent** icon in the Chrome toolbar (pin it first via the puzzle piece icon)
2. Enter your MiniMax API key in the setup screen
3. Select your model and click **Simpan & Mulai**

---

## Usage

| Action | How |
|---|---|
| Open sidebar | Click the extension icon in the toolbar |
| Send a message | Type in the input box and press **Enter** |
| New line in input | **Shift + Enter** |
| Read active page | Click the 📖 book icon or type "ringkas halaman ini" |
| Take screenshot | Click the 🖼 image icon or type "screenshot" |
| Ask about selected text | Select any text on a page — a toast appears in the sidebar |
| New chat session | Click the **+** button in the sessions panel |
| Switch sessions | Click any session name in the sessions panel |
| View/delete memory | Click the 🧠 memory icon in the header |
| Clear current chat | Click the 🗑 trash icon |
| Open settings | Click the ⚙️ gear icon |

### AI Browser Commands

You can ask the AI in plain language:

```
"Go to github.com"
"Open youtube.com in a new tab"
"Click the Sign In button"
"Scroll down"
"Read and summarize this page"
"Take a screenshot"
"Fill in the search box with 'MiniMax AI'"
"List all open tabs"
"Extract all product names and prices from this page"
"Wait until the loading spinner disappears"
```

---

## Agent Modes

Switch modes via the dropdown in the sidebar header:

| Mode | Icon | Best For |
|---|---|---|
| **Agent** | 🤖 | Multi-step autonomous tasks (default) |
| **Reader** | 📖 | Summarizing articles and extracting info without side effects |
| **Form Filler** | 📝 | Filling and reviewing web forms step by step |
| **Researcher** | 🔬 | Cross-tab research with source citations |

---

## Tool Inspector

Click the 🔧 wrench icon in the header to open the **Tool Inspector** panel:

- View all registered tools with their parameter schemas
- Execute any tool manually from the UI
- See a live **Event Timeline** of every tool call and its result
- Run **Page Analysis** to get tool recommendations for the current page
- Export all tool definitions as a JSON schema file

## Memory System

The agent automatically extracts and stores facts about you across sessions — things like your name, preferred language, or recurring tasks. These are injected into every conversation so the AI always has context.

- Facts are stored in `chrome.storage.local` (never sent anywhere except the MiniMax API)
- You can view and delete individual facts from the memory panel (🧠 icon)
- Maximum 60 facts are stored; oldest are evicted when the cap is reached

---

## Session Management

Each conversation is a named session saved to local storage:

- Sessions persist across browser restarts and extension reloads
- Up to 20 sessions are kept; oldest is removed when the cap is reached
- Each session stores up to 100 messages
- Rename or delete sessions from the sessions panel

---

## Security

This extension is designed with a defense-in-depth approach to protect both the user and the pages they visit.

| Measure | Detail |
|---|---|
| **Content Security Policy** | `script-src 'self'` — no inline scripts, no eval, no external scripts |
| **URL validation** | Only `http:` and `https:` are allowed for navigation; `javascript:`, `data:`, `file:` are rejected |
| **Sender validation** | Background script checks `sender.id` on all runtime messages |
| **Origin check** | Messages from outside the extension origin are rejected with an error |
| **DOM-only rendering** | All AI output and UI text is built via `createTextNode` / `textContent` — no `innerHTML` with untrusted data |
| **`evaluate_js` hardened** | 30+ blocked patterns including `globalThis`, `self.`, `top.`, `atob()`, `__proto__`, prototype access, and obfuscation escapes. Hard 500-char length cap. |
| **Prompt injection mitigation** | Page content is wrapped with explicit UNTRUSTED DATA delimiters in the system prompt. Common injection phrases (`IGNORE INSTRUCTIONS`, `[SYSTEM]`, etc.) are stripped before being sent to the AI. |
| **No external CDN** | Fonts and assets are system-local — no outbound requests except the configured AI API |
| **API timeout** | 30-second abort controller on every API request |

> **Privacy Note:** Page text content, interactive elements, and screenshots are sent to the MiniMax API (or other configured provider) as part of the AI request. Do not use this extension on pages containing passwords, financial data, or other highly sensitive personal information.

---

## Development

### Making Changes

After editing any file, reload the extension:

1. Go to `chrome://extensions`
2. Click the **↺ refresh** icon on the Mini Agent card

### Debugging

**Sidebar DevTools** — right-click inside the sidebar → Inspect

**Background service worker** — go to `chrome://extensions` → click the **service worker** link under the extension

### Key Constants (memory.js)

```js
MAX_FACTS            = 60    // max stored memory facts
MAX_SESSIONS         = 20    // max saved sessions
MAX_MSGS_PER_SESSION = 100   // max messages per session
```

### Key Constants (sidebar.js)

```js
MAX_HISTORY_TURNS = 20   // turns sent to API per request (keeps last 40 messages)
```

---

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Read and interact with the current tab |
| `scripting` | Inject content scripts for DOM interaction |
| `tabs` | Query active tab, navigate, create new tabs |
| `sidePanel` | Display the chat UI as a side panel |
| `storage` | Persist API key, sessions, and memory |
| `downloads` | Save screenshots to disk |
| `host_permissions: <all_urls>` | Allow content scripts on any page |

---

## License

MIT
