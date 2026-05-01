# Requirements Document

## Introduction

The **Auto Capture Screenshot Setting** feature adds a user-configurable toggle that controls whether the Mini Browser Agent automatically captures a screenshot after each visual action step (navigate, click, fill_input, scroll, new_tab, hover, select_option, scroll_to) and after the `done` action.

By default the setting is **enabled**, preserving the existing behavior. When the user disables it, the agent loop skips all automatic screenshot captures, reducing visual noise and improving execution speed for users who do not need step-by-step visual feedback.

The setting is persisted via `chrome.storage.local` so it survives sidebar reloads and browser restarts. It is exposed as a toggle inside the existing Settings screen (`#setup-screen`) alongside the provider, model, and API key fields.

---

## Glossary

- **Auto_Capture**: The behavior of automatically taking a screenshot after each visual action step and after the `done` action inside `runAgentLoop()`.
- **Auto_Capture_Setting**: The persisted boolean preference (`auto_capture_screenshot`) stored in `chrome.storage.local` that controls whether Auto_Capture is active.
- **Settings_Screen**: The existing `#setup-screen` panel in the sidebar where provider, model, and API key are configured.
- **Agent_Loop**: The `runAgentLoop()` function in `sidebar.js` that drives multi-step AI task execution.
- **Visual_Action**: Any action whose type is one of: `navigate`, `click`, `fill_input`, `scroll`, `new_tab`, `hover`, `select_option`, `scroll_to`.
- **Done_Action**: The `done` action type that signals task completion and currently triggers a final screenshot.
- **Capture_Toggle**: The UI control (checkbox or toggle switch) inside the Settings_Screen that lets the user change the Auto_Capture_Setting.
- **Session_Recorder**: The `SessionRecorder` module that records steps and screenshots for the downloadable ZIP report.

---

## Requirements

### Requirement 1: Persist the Auto Capture Setting

**User Story:** As a user, I want my auto capture preference to be saved automatically, so that I do not have to reconfigure it every time I open the sidebar.

#### Acceptance Criteria

1. THE Auto_Capture_Setting SHALL be stored in `chrome.storage.local` under the key `auto_capture_screenshot` as a boolean value.
2. WHEN the Auto_Capture_Setting has never been saved, THE Sidebar SHALL treat the effective value as `true` (enabled by default).
3. WHEN the user changes the Capture_Toggle, THE Sidebar SHALL immediately persist the new boolean value to `chrome.storage.local` under the key `auto_capture_screenshot`.
4. WHEN the sidebar is loaded or reloaded, THE Sidebar SHALL read the `auto_capture_screenshot` key from `chrome.storage.local` and apply the stored value before the first agent step executes.
5. IF reading from `chrome.storage.local` fails, THEN THE Sidebar SHALL fall back to `true` (enabled) and log the error to the console without disrupting the agent loop.

---

### Requirement 2: Capture Toggle in the Settings Screen

**User Story:** As a user, I want a clearly labeled toggle in the Settings screen to turn auto capture on or off, so that I can control screenshot behavior without editing any code.

#### Acceptance Criteria

1. THE Settings_Screen SHALL display a Capture_Toggle control labeled "Auto Capture Screenshots" within the existing settings form.
2. THE Capture_Toggle SHALL reflect the current persisted value of Auto_Capture_Setting when the Settings_Screen is opened.
3. WHEN the user saves settings by clicking the "Save & Start" button, THE Sidebar SHALL persist the current state of the Capture_Toggle to `chrome.storage.local` together with the other settings (provider, API key, model).
4. WHEN the user opens the Settings_Screen while already on the chat screen (via the ⚙️ button), THE Capture_Toggle SHALL display the currently persisted Auto_Capture_Setting value.
5. THE Capture_Toggle SHALL be keyboard-accessible and operable via the Space or Enter key in accordance with standard HTML interactive element behavior.

---

### Requirement 3: Conditional Screenshot After Visual Actions

**User Story:** As a user, I want the agent to skip automatic screenshots after each step when I have disabled auto capture, so that the agent runs faster and the chat is not cluttered with screenshots I do not need.

#### Acceptance Criteria

1. WHILE Auto_Capture_Setting is `true`, THE Agent_Loop SHALL capture a screenshot after every Visual_Action step, preserving the existing behavior (1200 ms delay followed by `TAKE_SCREENSHOT`).
2. WHILE Auto_Capture_Setting is `false`, THE Agent_Loop SHALL skip the screenshot capture block after every Visual_Action step and proceed directly to the next operation.
3. THE Agent_Loop SHALL read the in-memory Auto_Capture_Setting value that was loaded at sidebar startup; it SHALL NOT perform a `chrome.storage.local` read on every step to avoid added latency.
4. WHEN Auto_Capture_Setting is `false` and a Visual_Action completes successfully, THE Agent_Loop SHALL still record the step in Session_Recorder with a `null` screenshot value, so the step log remains complete.
5. WHILE Auto_Capture_Setting is `false`, THE Agent_Loop SHALL still apply the 1200 ms post-action sleep to allow the page to settle before the next step.

---

### Requirement 4: Conditional Final Screenshot on Done Action

**User Story:** As a user, I want the final screenshot at task completion to also respect my auto capture preference, so that the behavior is consistent throughout the entire agent run.

#### Acceptance Criteria

1. WHILE Auto_Capture_Setting is `true`, THE Agent_Loop SHALL capture a final screenshot after the `done` action, preserving the existing behavior (800 ms delay followed by `TAKE_SCREENSHOT`).
2. WHILE Auto_Capture_Setting is `false`, THE Agent_Loop SHALL skip the final screenshot capture after the `done` action and proceed directly to recording the step and breaking the loop.
3. WHEN Auto_Capture_Setting is `false` and the `done` action is reached, THE Agent_Loop SHALL still record the done step in Session_Recorder with a `null` screenshot value.

---

### Requirement 5: Manual Screenshot Button Is Unaffected

**User Story:** As a user, I want the manual screenshot button in the toolbar to always work regardless of the auto capture setting, so that I can still take screenshots on demand when I need them.

#### Acceptance Criteria

1. THE Sidebar SHALL always execute a screenshot when the user clicks the manual screenshot toolbar button (`#screenshot-btn`), regardless of the current Auto_Capture_Setting value.
2. THE Auto_Capture_Setting SHALL only control automatic captures triggered by the Agent_Loop; it SHALL NOT affect any manually initiated screenshot action.

---

### Requirement 6: In-Memory State Consistency

**User Story:** As a developer, I want the auto capture state to be held in a single in-memory variable that is loaded once at startup, so that the agent loop can check it cheaply on every step without storage I/O.

#### Acceptance Criteria

1. THE Sidebar SHALL maintain a module-level boolean variable (e.g., `autoCaptureEnabled`) that holds the current Auto_Capture_Setting value.
2. WHEN the sidebar initializes and reads settings from `chrome.storage.local`, THE Sidebar SHALL set `autoCaptureEnabled` to the stored value of `auto_capture_screenshot`, defaulting to `true` if the key is absent.
3. WHEN the user saves a new Capture_Toggle value via the Settings_Screen, THE Sidebar SHALL update `autoCaptureEnabled` in memory at the same time as persisting to `chrome.storage.local`, so the new value takes effect immediately for any subsequent agent run.
4. THE Agent_Loop SHALL reference `autoCaptureEnabled` directly (synchronous boolean check) without any asynchronous storage read during step execution.

---

### Requirement 7: No Disruption to Existing Functionality

**User Story:** As a developer, I want the auto capture feature to be integrated without altering any existing behavior when the setting is enabled, so that current users experience no regression.

#### Acceptance Criteria

1. WHEN Auto_Capture_Setting is `true`, THE Agent_Loop SHALL behave identically to the pre-feature implementation for all Visual_Action steps and the `done` action.
2. THE introduction of the Capture_Toggle SHALL NOT alter the layout or behavior of any existing Settings_Screen field (provider, model, API key, Save button).
3. IF the `auto_capture_screenshot` key is absent from `chrome.storage.local` (e.g., existing users who have never seen the new setting), THEN THE Sidebar SHALL default to `true` so that existing users experience no change in behavior.
4. THE Auto_Capture_Setting SHALL have no effect on the Session_Recorder step log structure; all steps SHALL continue to be recorded regardless of the setting value.
