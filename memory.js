// memory.js — Persistent memory & conversation session manager
// Loaded by sidebar.html before sidebar.js

// ─────────────────────────────────────────────
//  STORAGE KEYS
// ─────────────────────────────────────────────
const STORAGE_KEY_SESSIONS  = "agent_sessions";      // { [id]: Session }
const STORAGE_KEY_ACTIVE    = "agent_active_session"; // string (session id)
const STORAGE_KEY_MEMORY    = "agent_memory";         // MemoryFact[]
const MAX_FACTS             = 60;   // cap total memory facts
const MAX_SESSIONS          = 20;   // cap total saved sessions
const MAX_MSGS_PER_SESSION  = 100;  // cap messages stored per session

// ─────────────────────────────────────────────
//  TYPES (JSDoc)
// ─────────────────────────────────────────────
/**
 * @typedef {{ id: string, role: "user"|"assistant", content: string, ts: number }} ChatMessage
 * @typedef {{ id: string, name: string, createdAt: number, updatedAt: number, messages: ChatMessage[] }} Session
 * @typedef {{ id: string, key: string, value: string, source: string, ts: number }} MemoryFact
 */

// ─────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (data) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve(data);
    });
  });
}

function storageSet(obj) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(obj, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

// ─────────────────────────────────────────────
//  SESSION MANAGER
// ─────────────────────────────────────────────
const SessionManager = {
  /** @returns {Promise<{ sessions: Record<string,Session>, activeId: string }>} */
  async load() {
    const data = await storageGet([STORAGE_KEY_SESSIONS, STORAGE_KEY_ACTIVE]);
    const sessions = data[STORAGE_KEY_SESSIONS] || {};
    let activeId   = data[STORAGE_KEY_ACTIVE]   || null;

    // Bootstrap: create a default session if none exist
    if (Object.keys(sessions).length === 0) {
      const s = SessionManager._newSession("Conversation 1");
      sessions[s.id] = s;
      activeId = s.id;
      await storageSet({ [STORAGE_KEY_SESSIONS]: sessions, [STORAGE_KEY_ACTIVE]: activeId });
    }

    // If stored activeId no longer exists, fall back to most recent
    if (!sessions[activeId]) {
      activeId = Object.values(sessions)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
      await storageSet({ [STORAGE_KEY_ACTIVE]: activeId });
    }

    return { sessions, activeId };
  },

  _newSession(name) {
    const now = Date.now();
    return { id: uid(), name, createdAt: now, updatedAt: now, messages: [] };
  },

  /** Create a new session and make it active */
  async create(name) {
    const data = await storageGet([STORAGE_KEY_SESSIONS]);
    const sessions = data[STORAGE_KEY_SESSIONS] || {};

    // Enforce cap — remove oldest if needed
    const ids = Object.keys(sessions);
    if (ids.length >= MAX_SESSIONS) {
      const oldest = Object.values(sessions)
        .sort((a, b) => a.updatedAt - b.updatedAt)[0];
      delete sessions[oldest.id];
    }

    const s = SessionManager._newSession(name || `Conversation ${ids.length + 1}`);
    sessions[s.id] = s;
    await storageSet({ [STORAGE_KEY_SESSIONS]: sessions, [STORAGE_KEY_ACTIVE]: s.id });
    return s;
  },

  /** Switch active session */
  async switchTo(id) {
    await storageSet({ [STORAGE_KEY_ACTIVE]: id });
  },

  /** Rename a session */
  async rename(id, newName) {
    const data = await storageGet([STORAGE_KEY_SESSIONS]);
    const sessions = data[STORAGE_KEY_SESSIONS] || {};
    if (!sessions[id]) return;
    sessions[id].name = newName.trim().slice(0, 60) || sessions[id].name;
    await storageSet({ [STORAGE_KEY_SESSIONS]: sessions });
  },

  /** Delete a session; returns the new active id */
  async delete(id) {
    const data = await storageGet([STORAGE_KEY_SESSIONS, STORAGE_KEY_ACTIVE]);
    const sessions = data[STORAGE_KEY_SESSIONS] || {};
    delete sessions[id];

    // Always keep at least one session
    if (Object.keys(sessions).length === 0) {
      const s = SessionManager._newSession("Conversation 1");
      sessions[s.id] = s;
    }

    let activeId = data[STORAGE_KEY_ACTIVE];
    if (activeId === id || !sessions[activeId]) {
      activeId = Object.values(sessions)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
    }

    await storageSet({ [STORAGE_KEY_SESSIONS]: sessions, [STORAGE_KEY_ACTIVE]: activeId });
    return activeId;
  },

  /** Append a message to a session and persist */
  async appendMessage(sessionId, role, content) {
    const data = await storageGet([STORAGE_KEY_SESSIONS]);
    const sessions = data[STORAGE_KEY_SESSIONS] || {};
    if (!sessions[sessionId]) return;

    const msg = { id: uid(), role, content, ts: Date.now() };
    sessions[sessionId].messages.push(msg);
    sessions[sessionId].updatedAt = Date.now();

    // Cap messages per session
    if (sessions[sessionId].messages.length > MAX_MSGS_PER_SESSION) {
      sessions[sessionId].messages = sessions[sessionId].messages.slice(-MAX_MSGS_PER_SESSION);
    }

    await storageSet({ [STORAGE_KEY_SESSIONS]: sessions });
    return msg;
  },

  /** Clear all messages in a session */
  async clearMessages(sessionId) {
    const data = await storageGet([STORAGE_KEY_SESSIONS]);
    const sessions = data[STORAGE_KEY_SESSIONS] || {};
    if (!sessions[sessionId]) return;
    sessions[sessionId].messages = [];
    sessions[sessionId].updatedAt = Date.now();
    await storageSet({ [STORAGE_KEY_SESSIONS]: sessions });
  },

  /** Return messages formatted for the API (role + content only) */
  toAPIMessages(session) {
    return session.messages.map(({ role, content }) => ({ role, content }));
  }
};

// ─────────────────────────────────────────────
//  MEMORY MANAGER
// ─────────────────────────────────────────────
const MemoryManager = {
  /** @returns {Promise<MemoryFact[]>} */
  async load() {
    const data = await storageGet([STORAGE_KEY_MEMORY]);
    return data[STORAGE_KEY_MEMORY] || [];
  },

  /**
   * Upsert a fact. If a fact with the same key exists, update its value.
   * @param {string} key   — e.g. "user_name", "preferred_language"
   * @param {string} value — the fact value
   * @param {string} source — URL or "user" or "ai"
   */
  async upsert(key, value, source = "ai") {
    const facts = await MemoryManager.load();
    const k = key.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 60);
    const v = String(value).trim().slice(0, 300);
    if (!k || !v) return;

    const idx = facts.findIndex((f) => f.key === k);
    if (idx >= 0) {
      facts[idx].value  = v;
      facts[idx].source = source;
      facts[idx].ts     = Date.now();
    } else {
      // Enforce cap
      if (facts.length >= MAX_FACTS) {
        facts.sort((a, b) => a.ts - b.ts);
        facts.splice(0, facts.length - MAX_FACTS + 1);
      }
      facts.push({ id: uid(), key: k, value: v, source, ts: Date.now() });
    }

    await storageSet({ [STORAGE_KEY_MEMORY]: facts });
    return facts;
  },

  /** Delete a single fact by id */
  async deleteFact(id) {
    const facts = await MemoryManager.load();
    const updated = facts.filter((f) => f.id !== id);
    await storageSet({ [STORAGE_KEY_MEMORY]: updated });
    return updated;
  },

  /** Clear all memory */
  async clearAll() {
    await storageSet({ [STORAGE_KEY_MEMORY]: [] });
  },

  /**
   * Build a compact memory block string to inject into the system prompt.
   * @param {MemoryFact[]} facts
   * @returns {string}
   */
  toPromptBlock(facts) {
    if (!facts.length) return "";
    const lines = facts.map((f) => `- ${f.key}: ${f.value}`).join("\n");
    return `\n\n[MEMORY — things you know about this user]\n${lines}\n[END MEMORY]`;
  }
};

// Export to global scope (used by sidebar.js)
window.SessionManager = SessionManager;
window.MemoryManager  = MemoryManager;
