# Implementation Tasks — Auto Capture Screenshot Setting

## Tasks

- [x] 1. Add autoCaptureEnabled state variable to sidebar.js
  - Add `let autoCaptureEnabled = true;` in the `// ── State ──` block alongside the existing state variables
  - _Requirements: 6.1_

- [x] 2. Read auto_capture_screenshot from storage at init
  - Add `"auto_capture_screenshot"` to the key list in the existing `chrome.storage.local.get` init block
  - Inside the callback, set `autoCaptureEnabled = data.auto_capture_screenshot !== false;` (handles absent key → true, true → true, false → false)
  - Keep the existing `if (chrome.runtime.lastError)` guard; `autoCaptureEnabled` stays `true` on error
  - _Requirements: 1.2, 1.4, 1.5, 6.2_

- [x] 3. Add checkbox row to sidebar.html settings form
  - Insert a new `<div class="input-group input-group--inline">` block between the model select group and the Save button
  - Include `<label for="auto-capture-checkbox">Auto Capture Screenshots</label>` and `<input type="checkbox" id="auto-capture-checkbox" checked />`
  - _Requirements: 2.1, 2.5_

- [x] 4. Add CSS for the inline checkbox row to sidebar.css
  - Add `.input-group--inline` rule: `flex-direction: row; align-items: center; justify-content: space-between;`
  - Add `.input-group--inline input[type="checkbox"]` rule: `width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0;`
  - _Requirements: 2.1_

- [x] 5. Persist checkbox state in saveBtn handler
  - In the `saveBtn` click handler, read `document.getElementById("auto-capture-checkbox")`
  - Add `payload.auto_capture_screenshot = autoCaptureCheckbox ? autoCaptureCheckbox.checked : true;` to the payload before `chrome.storage.local.set`
  - Inside the `chrome.storage.local.set` callback (before `showChatScreen`), set `autoCaptureEnabled = payload.auto_capture_screenshot;`
  - _Requirements: 1.1, 1.3, 2.3, 6.3_

- [x] 6. Populate checkbox in settingsBtn handler
  - Add `"auto_capture_screenshot"` to the key list in the `settingsBtn` handler's `chrome.storage.local.get` call
  - Inside the callback, find `#auto-capture-checkbox` and set `checkbox.checked = data.auto_capture_screenshot !== false;`
  - _Requirements: 2.2, 2.4_

- [x] 7. Wrap visual action screenshot block with autoCaptureEnabled guard
  - In `runAgentLoop`, locate the visual action screenshot block (after `await sleep(1200)`)
  - Keep `await sleep(1200)` outside the guard (unconditional)
  - Wrap the `sendToBackground({ type: "TAKE_SCREENSHOT" })` call and `appendScreenshot` / `_capturedScreenshot` assignment inside `if (autoCaptureEnabled) { ... }`
  - `_capturedScreenshot` is already initialized to `null` before the block, so `SessionRecorder.addScreenshot` is naturally skipped when capture is disabled
  - _Requirements: 3.1, 3.2, 3.4, 3.5, 7.1_

- [x] 8. Wrap done action screenshot block with autoCaptureEnabled guard
  - In `runAgentLoop`, locate the done action screenshot block (after `await sleep(800)`)
  - Keep `await sleep(800)` outside the guard (unconditional)
  - Wrap the `try { const ssRes = await sendToBackground(...) ... } catch` block inside `if (autoCaptureEnabled) { ... }`
  - `_finalScreenshot` is already initialized to `null`, so `SessionRecorder.addScreenshot` is naturally skipped when capture is disabled
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 9. Write unit tests for edge cases and specific scenarios
  - Test file: `tests/auto-capture-setting.unit.test.js`
  - Cover: default value (absent key → true), storage read failure → true + console.error, done action flag=true → screenshot sent, done action flag=false → screenshot skipped + recordStep still called, manual screenshot button unaffected by flag, sleep(1200) still called when flag=false, existing settings fields still present in DOM
  - _Requirements: 1.2, 1.5, 4.1, 4.2, 4.3, 5.1, 3.5, 7.2_

- [x] 10. Write property-based tests
  - Test file: `tests/auto-capture-setting.property.test.js`
  - Use fast-check; minimum 100 iterations per property
  - Tag each test with `// Feature: auto-capture-setting, Property N: <property text>`
  - Implement all 7 properties from the design document:
    - P1: Storage round-trip (`fc.boolean()`)
    - P2: Init loads stored value (`fc.boolean()`)
    - P3: Settings screen reflects stored value (`fc.boolean()`)
    - P4: Visual action + flag=true → TAKE_SCREENSHOT sent (`fc.constantFrom(...visualActions)`)
    - P5: Visual action + flag=false → TAKE_SCREENSHOT not sent (`fc.constantFrom(...visualActions)`)
    - P6: Step always recorded; addScreenshot iff flag=true and screenshot succeeded (`fc.tuple(fc.constantFrom(...visualActions), fc.boolean())`)
    - P7: Save updates both storage and autoCaptureEnabled (`fc.boolean()`)
  - _Requirements: 1.1, 1.3, 1.4, 2.2, 2.3, 2.4, 3.1, 3.2, 3.4, 6.2, 6.3, 7.1, 7.4_
