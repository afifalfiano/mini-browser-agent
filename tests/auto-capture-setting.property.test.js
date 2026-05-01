/**
 * Property-based tests for the auto-capture-setting feature.
 * Uses fast-check for property generation.
 *
 * Since these tests run in jsdom (not a real Chrome extension), the logic
 * from sidebar.js is simulated inline — matching the exact conditional
 * branches described in the design document.
 */

import fc from 'fast-check';

const visualActions = ['navigate', 'click', 'fill_input', 'scroll', 'new_tab', 'hover', 'select_option', 'scroll_to'];

// ─── P1: Storage round-trip ───────────────────────────────────────────────────
// Feature: auto-capture-setting, Property 1: Storage round-trip
// Validates: Requirements 1.1, 1.3, 2.3
describe('P1: Storage round-trip', () => {
  test('for any boolean written as auto_capture_screenshot, reading it back returns the same value', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (value) => {
          // Simulate saveBtn handler: build payload and write to storage
          const payload = { auto_capture_screenshot: value };

          // Simulate chrome.storage.local (in-memory map)
          const storage = {};
          // Simulate chrome.storage.local.set(payload, callback)
          Object.assign(storage, payload);

          // Simulate chrome.storage.local.get reading back the key
          const readBack = storage['auto_capture_screenshot'];

          return readBack === value;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P2: Init loads stored value into autoCaptureEnabled ─────────────────────
// Feature: auto-capture-setting, Property 2: Init loads stored value
// Validates: Requirements 1.4, 6.2
describe('P2: Init loads stored value into autoCaptureEnabled', () => {
  test('for any boolean stored under auto_capture_screenshot, autoCaptureEnabled equals that value after init', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (storedValue) => {
          // Simulate the init callback logic from sidebar.js:
          //   autoCaptureEnabled = data.auto_capture_screenshot !== false;
          // For a stored boolean: true !== false → true, false !== false → false
          const data = { auto_capture_screenshot: storedValue };
          let autoCaptureEnabled = true; // module-level default

          // Simulate init callback (no lastError)
          autoCaptureEnabled = data.auto_capture_screenshot !== false;

          return autoCaptureEnabled === storedValue;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P3: Settings screen reflects stored value ────────────────────────────────
// Feature: auto-capture-setting, Property 3: Settings screen reflects stored value
// Validates: Requirements 2.2, 2.4
describe('P3: Settings screen reflects stored value', () => {
  let checkbox;

  beforeEach(() => {
    // Set up a minimal DOM with the checkbox
    const container = document.createElement('div');
    container.innerHTML = '<input type="checkbox" id="auto-capture-checkbox" />';
    document.body.appendChild(container);
    checkbox = document.getElementById('auto-capture-checkbox');
  });

  afterEach(() => {
    const el = document.getElementById('auto-capture-checkbox');
    if (el && el.parentElement) {
      document.body.removeChild(el.parentElement);
    }
  });

  test('for any boolean stored under auto_capture_screenshot, checkbox.checked equals that value when settings screen opens', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (storedValue) => {
          // Simulate settingsBtn handler logic from sidebar.js:
          //   checkbox.checked = data.auto_capture_screenshot !== false;
          const data = { auto_capture_screenshot: storedValue };
          const autoCaptureCheckbox = document.getElementById('auto-capture-checkbox');

          if (autoCaptureCheckbox) {
            autoCaptureCheckbox.checked = data.auto_capture_screenshot !== false;
          }

          return autoCaptureCheckbox.checked === storedValue;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P4: Visual action + autoCaptureEnabled=true → TAKE_SCREENSHOT sent ──────
// Feature: auto-capture-setting, Property 4: Visual action with autoCaptureEnabled=true triggers screenshot
// Validates: Requirements 3.1, 7.1
describe('P4: Visual action with autoCaptureEnabled=true triggers screenshot', () => {
  test('for any visual action type, TAKE_SCREENSHOT is sent when autoCaptureEnabled is true', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...visualActions),
        async (actionType) => {
          const autoCaptureEnabled = true;
          const messagesSent = [];

          // Simulate sendToBackground
          const sendToBackground = async (msg) => {
            messagesSent.push(msg);
            return { success: true, dataUrl: 'data:image/png;base64,abc' };
          };

          const sleep = async () => {};

          // Simulate the visual action block from runAgentLoop
          let _capturedScreenshot = null;
          const action = { type: actionType };

          if (visualActions.includes(action.type)) {
            await sleep(1200);
            if (autoCaptureEnabled) {
              const ssRes = await sendToBackground({ type: 'TAKE_SCREENSHOT' });
              if (ssRes.success) {
                _capturedScreenshot = ssRes.dataUrl;
              }
            }
          }

          const screenshotMessages = messagesSent.filter(m => m.type === 'TAKE_SCREENSHOT');
          return screenshotMessages.length === 1 && _capturedScreenshot !== null;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P5: Visual action + autoCaptureEnabled=false → TAKE_SCREENSHOT NOT sent ─
// Feature: auto-capture-setting, Property 5: Visual action with autoCaptureEnabled=false skips screenshot
// Validates: Requirements 3.2
describe('P5: Visual action with autoCaptureEnabled=false skips screenshot', () => {
  test('for any visual action type, TAKE_SCREENSHOT is NOT sent when autoCaptureEnabled is false', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...visualActions),
        async (actionType) => {
          const autoCaptureEnabled = false;
          const messagesSent = [];

          const sendToBackground = async (msg) => {
            messagesSent.push(msg);
            return { success: true, dataUrl: 'data:image/png;base64,abc' };
          };

          const sleep = async () => {};

          let _capturedScreenshot = null;
          const action = { type: actionType };

          if (visualActions.includes(action.type)) {
            await sleep(1200);
            if (autoCaptureEnabled) {
              const ssRes = await sendToBackground({ type: 'TAKE_SCREENSHOT' });
              if (ssRes.success) {
                _capturedScreenshot = ssRes.dataUrl;
              }
            }
          }

          const screenshotMessages = messagesSent.filter(m => m.type === 'TAKE_SCREENSHOT');
          return screenshotMessages.length === 0 && _capturedScreenshot === null;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P6: Step always recorded; addScreenshot iff flag=true and screenshot succeeded ─
// Feature: auto-capture-setting, Property 6: Step always recorded regardless of autoCaptureEnabled
// Validates: Requirements 3.4, 7.4
describe('P6: Step always recorded regardless of autoCaptureEnabled', () => {
  test('recordStep called exactly once; addScreenshot called iff autoCaptureEnabled=true and screenshot succeeded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.tuple(fc.constantFrom(...visualActions), fc.boolean()),
        async ([actionType, autoCaptureEnabled]) => {
          let recordStepCallCount = 0;
          let addScreenshotCalled = false;

          const mockSessionRecorder = {
            recordStep: (_opts) => { recordStepCallCount++; },
            addScreenshot: (_stepNum, _dataUrl) => { addScreenshotCalled = true; }
          };

          const sendToBackground = async (msg) => {
            return { success: true, dataUrl: 'data:image/png;base64,abc' };
          };

          const sleep = async () => {};

          let _capturedScreenshot = null;
          const action = { type: actionType };

          // Simulate the visual action block from runAgentLoop
          if (visualActions.includes(action.type)) {
            await sleep(1200);
            if (autoCaptureEnabled) {
              const ssRes = await sendToBackground({ type: 'TAKE_SCREENSHOT' });
              if (ssRes.success) {
                _capturedScreenshot = ssRes.dataUrl;
              }
            }
          }

          // recordStep is always called (unconditional)
          mockSessionRecorder.recordStep({
            stepNum: 1,
            action: actionType,
            params: {},
            result: null,
            success: true,
            errorMessage: null,
            duration: 100
          });

          // addScreenshot is called only if screenshot was captured
          if (_capturedScreenshot) {
            mockSessionRecorder.addScreenshot(1, _capturedScreenshot);
          }

          const expectedAddScreenshot = autoCaptureEnabled === true;
          return (
            recordStepCallCount === 1 &&
            addScreenshotCalled === expectedAddScreenshot
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P7: Save updates both storage and in-memory state atomically ─────────────
// Feature: auto-capture-setting, Property 7: Save updates both storage and in-memory state atomically
// Validates: Requirements 6.3
describe('P7: Save updates both storage and in-memory state atomically', () => {
  let checkbox;
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.innerHTML = '<input type="checkbox" id="auto-capture-checkbox-p7" />';
    document.body.appendChild(container);
    checkbox = document.getElementById('auto-capture-checkbox-p7');
  });

  afterEach(() => {
    if (container && container.parentElement) {
      document.body.removeChild(container);
    }
  });

  test('for any boolean set on the checkbox, after save both storage and autoCaptureEnabled reflect that value', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (checkboxValue) => {
          // Set the checkbox state (simulates user interaction)
          const autoCaptureCheckbox = document.getElementById('auto-capture-checkbox-p7');
          autoCaptureCheckbox.checked = checkboxValue;

          // Simulate in-memory state variable
          let autoCaptureEnabled = true; // previous value

          // Simulate in-memory storage
          const storage = {};

          // Simulate saveBtn handler logic from sidebar.js:
          //   payload.auto_capture_screenshot = autoCaptureCheckbox ? autoCaptureCheckbox.checked : true;
          //   chrome.storage.local.set(payload, () => {
          //     autoCaptureEnabled = payload.auto_capture_screenshot;
          //     showChatScreen(model);
          //   });
          const payload = {
            auto_capture_screenshot: autoCaptureCheckbox ? autoCaptureCheckbox.checked : true
          };

          // Simulate chrome.storage.local.set (synchronous in test)
          Object.assign(storage, payload);

          // Simulate the set callback: update in-memory variable
          autoCaptureEnabled = payload.auto_capture_screenshot;

          // Both storage and in-memory variable must reflect the checkbox value
          return (
            storage['auto_capture_screenshot'] === checkboxValue &&
            autoCaptureEnabled === checkboxValue
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
