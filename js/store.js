import { CONFIG } from "./config.js";
import { SEED_SESSION } from "./seed.js";

export const STORAGE_KEY = "eride-sr-dash-v1";
const MAX_SESSIONS = 30;

export function defaultState() {
  return {
    version: 1,
    packWhOverride: null,
    fault: "",
    mode: "",
    activeSessionId: SEED_SESSION.id,
    sessions: [clone(SEED_SESSION)],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.sessions) || !parsed.sessions.length) {
      return defaultState();
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

/** @param {object} state */
export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/** @param {object} state */
export function activeSession(state) {
  return state.sessions.find((session) => session.id === state.activeSessionId) || state.sessions.at(-1);
}

/** @param {object} state */
export function effectivePackWh(state) {
  const override = state.packWhOverride;
  if (override != null && Number.isFinite(override) && override > 0) return override;
  return CONFIG.packWh;
}

export function newId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `ride-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Drop the oldest archived rides first. The open ride stays. */
export function trimSessions(state) {
  while (state.sessions.length > MAX_SESSIONS) {
    const index = state.sessions.findIndex((session) => session.id !== state.activeSessionId);
    if (index < 0) break;
    state.sessions.splice(index, 1);
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
