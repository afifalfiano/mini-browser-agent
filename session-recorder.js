// session-recorder.js — Records agent loop steps and generates downloadable ZIP report

const SessionRecorder = (() => {
  let _session = null;

  // ── Session lifecycle ──

  function start(goal) {
    _session = {
      id: Date.now(),
      goal: goal || "Unnamed session",
      startTime: new Date(),
      endTime: null,
      steps: []
    };
    return _session;
  }

  function end() {
    if (_session) _session.endTime = new Date();
  }

  function clear() { _session = null; }

  function hasData() { return !!(_session && _session.steps.length > 0); }

  function getSession() { return _session; }

  // ── Step recording ──

  /**
   * @param {{ stepNum, action, params, result, success, errorMessage, duration }} opts
   */
  function recordStep({ stepNum, action, params, result, success, errorMessage, duration }) {
    if (!_session) return;
    // Update existing step if same stepNum
    const existing = _session.steps.find((s) => s.stepNum === stepNum);
    if (existing) {
      Object.assign(existing, { action, params, result, success, errorMessage, duration });
      return;
    }
    _session.steps.push({
      stepNum,
      action: action || "unknown",
      params: params || {},
      result: result || null,
      success: success !== false,
      errorMessage: errorMessage || null,
      duration: duration || 0,
      screenshotDataUrl: null,
      timestamp: new Date()
    });
  }

  /** Attach a screenshot data URL to a step */
  function addScreenshot(stepNum, dataUrl) {
    if (!_session) return;
    const step = _session.steps.find((s) => s.stepNum === stepNum);
    if (step) {
      step.screenshotDataUrl = dataUrl;
    } else {
      _session.steps.push({
        stepNum,
        action: "screenshot",
        params: {},
        result: null,
        success: true,
        errorMessage: null,
        duration: 0,
        screenshotDataUrl: dataUrl,
        timestamp: new Date()
      });
    }
  }

  // ── HTML Report ──

  function _esc(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function _buildHtmlReport() {
    if (!_session) return "";
    const dur = _session.endTime
      ? ((_session.endTime - _session.startTime) / 1000).toFixed(1)
      : "?";
    const success = _session.steps.filter((s) => s.success).length;
    const failed  = _session.steps.filter((s) => !s.success).length;

    const stepsHtml = _session.steps.map((s) => {
      const paramsStr = JSON.stringify(s.params, null, 2);
      const resultStr = s.result ? JSON.stringify(s.result, null, 2).slice(0, 2000) : null;
      const imgHtml = s.screenshotDataUrl
        ? `<img src="${s.screenshotDataUrl}" alt="Step ${s.stepNum}" style="max-width:100%;border-radius:6px;border:1px solid #2a2a34;margin-top:10px;" />`
        : "";
      const icon = s.success ? "✅" : "❌";
      return `
      <div class="step">
        <div class="step-hdr">
          <span class="step-n">Step ${s.stepNum}</span>
          <span class="step-ico">${icon}</span>
          <span class="step-act">${_esc(s.action)}</span>
          <span class="step-dur">${s.duration}ms</span>
        </div>
        <div class="step-body">
          <div class="sec"><div class="sec-lbl">Parameters</div><pre class="code">${_esc(paramsStr)}</pre></div>
          ${s.errorMessage ? `<div class="err">Error: ${_esc(s.errorMessage)}</div>` : ""}
          ${resultStr ? `<div class="sec"><div class="sec-lbl">Result</div><pre class="code">${_esc(resultStr)}</pre></div>` : ""}
          ${imgHtml}
        </div>
      </div>`;
    }).join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Agent Session Report</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#0c0c0f;color:#e2e2ee;font-size:14px;line-height:1.6;padding:28px}
.header{max-width:900px;margin:0 auto 28px}
h1{font-size:22px;font-weight:700;color:#fff;margin-bottom:6px}
.goal{font-size:14px;color:#888899;margin-bottom:16px;font-style:italic}
.meta{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px}
.meta-item{background:#141418;border:1px solid #2a2a34;border-radius:8px;padding:8px 14px}
.meta-label{font-size:10px;color:#888899;text-transform:uppercase;letter-spacing:.5px}
.meta-value{font-size:13px;font-weight:600;color:#e2e2ee}
.steps{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
.step{background:#141418;border:1px solid #2a2a34;border-radius:10px;overflow:hidden}
.step-hdr{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#1e1e24;border-bottom:1px solid #2a2a34}
.step-n{font-size:11px;color:#888899;font-family:monospace;min-width:48px}
.step-ico{font-size:14px}
.step-act{font-family:monospace;font-size:13px;font-weight:600;color:#6c63ff;flex:1}
.step-dur{font-family:monospace;font-size:11px;color:#22c55e}
.step-body{padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.sec-lbl{font-size:10px;font-weight:600;color:#888899;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
.code{background:#0c0c0f;border:1px solid #2a2a34;border-radius:6px;padding:8px 10px;font-family:monospace;font-size:12px;color:#a0a0b8;overflow-x:auto;white-space:pre}
.err{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);color:#f87171;border-radius:6px;padding:8px 10px;font-size:12px}
</style>
</head>
<body>
<div class="header">
  <h1>🤖 Agent Session Report</h1>
  <div class="goal">"${_esc(_session.goal)}"</div>
  <div class="meta">
    <div class="meta-item"><div class="meta-label">Session ID</div><div class="meta-value">${_session.id}</div></div>
    <div class="meta-item"><div class="meta-label">Start</div><div class="meta-value">${_session.startTime.toLocaleString()}</div></div>
    <div class="meta-item"><div class="meta-label">Duration</div><div class="meta-value">${dur}s</div></div>
    <div class="meta-item"><div class="meta-label">Steps</div><div class="meta-value">${_session.steps.length}</div></div>
    <div class="meta-item"><div class="meta-label">Success</div><div class="meta-value" style="color:#22c55e">${success}</div></div>
    ${failed > 0 ? `<div class="meta-item"><div class="meta-label">Failed</div><div class="meta-value" style="color:#ef4444">${failed}</div></div>` : ""}
  </div>
</div>
<div class="steps">${stepsHtml}</div>
</body>
</html>`;
  }

  // ── Download ZIP ──

  async function downloadZip() {
    if (!_session || _session.steps.length === 0) return;
    if (typeof ZipBuilder === "undefined") {
      console.error("[SessionRecorder] ZipBuilder not loaded");
      return;
    }

    const zip = new ZipBuilder.ZipFile();
    const dateStr = _session.startTime.toISOString().slice(0, 19).replace(/[T:]/g, "-");
    const prefix  = `session_${dateStr}`;

    // 1. HTML report
    zip.add(`${prefix}/report.html`, _buildHtmlReport(), _session.startTime);

    // 2. JSON data
    const jsonData = {
      id: _session.id,
      goal: _session.goal,
      startTime: _session.startTime.toISOString(),
      endTime: _session.endTime?.toISOString() || null,
      durationSeconds: _session.endTime
        ? ((_session.endTime - _session.startTime) / 1000).toFixed(1)
        : null,
      steps: _session.steps.map((s) => ({
        stepNum: s.stepNum,
        action: s.action,
        params: s.params,
        result: s.result,
        success: s.success,
        errorMessage: s.errorMessage,
        duration: s.duration,
        hasScreenshot: !!s.screenshotDataUrl,
        timestamp: s.timestamp?.toISOString()
      }))
    };
    zip.add(`${prefix}/data.json`, JSON.stringify(jsonData, null, 2), _session.startTime);

    // 3. Screenshots as PNG files
    for (const step of _session.steps) {
      if (!step.screenshotDataUrl) continue;
      try {
        const base64 = step.screenshotDataUrl.split(",")[1];
        if (!base64) continue;
        const binary = atob(base64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const filename = `${prefix}/screenshots/step-${String(step.stepNum).padStart(2, "0")}-${step.action}.png`;
        zip.add(filename, bytes, step.timestamp || _session.startTime);
      } catch (e) {
        console.warn("[SessionRecorder] Could not add screenshot for step", step.stepNum, e);
      }
    }

    // Trigger download
    const blob = zip.build();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `${prefix}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    console.log(`[SessionRecorder] ZIP downloaded: ${prefix}.zip`);
  }

  return { start, end, clear, hasData, getSession, recordStep, addScreenshot, downloadZip };
})();

window.SessionRecorder = SessionRecorder;
