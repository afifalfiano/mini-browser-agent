# Changelog

All notable changes to the **MiniMax Browser Agent** extension will be documented in this file.

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
