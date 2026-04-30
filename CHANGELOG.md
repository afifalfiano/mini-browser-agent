# Changelog

All notable changes to the **Mini Browser Agent** extension will be documented in this file.

## [2.2.0] - 2026-05-01
### Security
- **`evaluate_js` hardened blocklist:** Expanded blocked expression patterns from 10 to 30+, covering global object bypasses (`globalThis`, `self.`, `top.`, `parent.`, `frames[`), encoding obfuscation (`atob`, `btoa`, `\x`, `\u`), prototype pollution (`__proto__`, `.constructor`), dangerous DOM reads (`document.forms`, `document.body.innerHTML`), additional execution vectors (`setTimeout`, `setInterval`, `(0,eval)`), and Node.js globals (`require`, `process`, `module`). Added a hard 500-character length cap on all evaluated expressions.
- **Prompt injection mitigation:** Page content sent to the AI is now wrapped with explicit `[PAGE DATA — UNTRUSTED EXTERNAL CONTENT]` delimiters in the system prompt, instructing the model to treat it as raw data rather than instructions. Common injection phrases (`IGNORE INSTRUCTIONS`, `[SYSTEM]`, `FORGET INSTRUCTIONS`, `YOU ARE NOW`) are stripped from page text before it reaches the AI.
- **XSS fix — `showNavigatingIndicator`:** Replaced `innerHTML` with DOM API (`textContent`) when rendering the navigation overlay. A maliciously crafted URL could previously inject HTML into the page being visited.
- **XSS fix — `appendAssistantMsg`:** Replaced `innerHTML`-based rendering with pure DOM API (`createTextNode`, `createElement`, `appendChild`). The previous implementation had an inconsistent `replace` without the global flag that could allow HTML to escape escaping.
- **XSS fix — `updateTaskProgressUI`:** Added `_escapeHtml()` escaping to `plan.goal` and `s.text` before injecting into `innerHTML`, preventing HTML injection from AI-generated task plans.

### Changed
- **README:** Fully updated to reflect current project structure (including `tools/`, `providers/`, `lib/` directories), new agent modes, tool inspector, and expanded security section with all hardening details.
- **CHANGELOG:** Reformatted for clarity; added this entry.

---

## [2.1.0] - 2026-04-30

### Added
- **Multi-Provider AI Architecture (Phase 5):**
  - Abstracted API communication using a centralized `ProviderManager` (`providers/base.js`).
  - Added support for Google Gemini API alongside the existing MiniMax API (`providers/gemini.js`, `providers/minimax.js`).
  - Normalized API response payloads allowing seamless hot-swapping of AI providers.
- **Provider Selection UI:**
  - Sidebar settings updated to allow users to select their preferred AI provider and enter API keys for each model individually.
- **Visual Action Indicators:**
  - Added a highly visible, pulsing highlight box (overlay) around the active DOM elements being interacted with by the AI.
  - Added a global viewport "working frame" indicator (purple glowing border) to provide constant visual feedback while the agent loop is running autonomously.

### Changed
- **Version Bump:** `manifest.json` version increased to `2.1.0`.
- **Content Script Styling:** Enhanced the `showActionIndicator` method to be fully defensive against irregular DOM elements and viewport calculations.
- **Sidebar Integration:** Refactored sidebar backend communication to pass provider preferences via storage.

---

## [2.0.0] - 2026-04-30
### Added
- **DevTools Inspector Integration (Phase 4):**
  - Implemented an inspector system within the sidebar capable of auto-generating input forms based on schema structures.
  - Included an Event Timeline for debugging actions natively from the extension.
- **Session Recording & Export:**
  - Integrated `SessionRecorder` for capturing step-by-step logs, action parameters, screenshots, and execution timestamps.
  - Created a pure-JS ZIP exporter (`lib/zip-builder.js`) allowing users to download a compiled `.zip` report of their agent's active session.

### Changed
- Removed duplicate welcome messages in the sidebar UI logic.
- Optimized Action JSON parsing logic.

---

## [1.0.0] - Initial Release
### Added
- Core browser automation primitives (`click`, `fill_input`, `hover`, `scroll`, `navigate`).
- Initial sidebar interface and chat loop.
- Page text extraction and basic element labeling logic.
