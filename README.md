# MiniMax Browser Agent

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
├── manifest.json       # Chrome Extension manifest (MV3)
├── background.js       # Service worker — API calls, tab control, screenshot
├── content.js          # Injected into every page — DOM reading, clicking, scrolling
├── memory.js           # Session manager + memory bank (loaded before sidebar.js)
├── sidebar.html        # Side panel UI
├── sidebar.js          # Side panel logic — chat, actions, session/memory integration
├── sidebar.css         # Side panel styles
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

1. Click the **MiniMax Agent** icon in the Chrome toolbar (pin it first via the puzzle piece icon)
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
```

---

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

| Measure | Detail |
|---|---|
| Content Security Policy | `script-src 'self'` — no inline scripts, no eval, no external scripts |
| URL validation | Only `http:` and `https:` URLs are allowed for navigation |
| Sender validation | Background script checks `sender.id` on all messages |
| No external CDN | Fonts and assets are system-local — no outbound requests except the API |
| Safe rendering | All AI output rendered via DOM `textContent` — no `innerHTML` |
| API timeout | 30-second abort controller on every API request |

---

## Development

### Making Changes

After editing any file, reload the extension:

1. Go to `chrome://extensions`
2. Click the **↺ refresh** icon on the MiniMax Agent card

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
