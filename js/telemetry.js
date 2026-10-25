import { CONFIG } from "./config.js";
import { lowAlert, parseNum, rideMath } from "./math.js";
import {
  activeSession,
  effectivePackWh,
  loadState,
  newId,
  saveState,
  trimSessions,
} from "./store.js";

/**
 * Frame the cluster renders. v1 only fills this from typed checkpoints.
 * OfficialExportSource and OpenBleSource are stubs for a later official
 * export or documented open API. Do not sniff BLE or invent a bike protocol.
 *
 * @typedef {Object} TelemetryFrame
 * @property {string} bikeName
 * @property {string} sessionName
 * @property {string} mode
 * @property {number|null} socPct
 * @property {number|null} odoMi
 * @property {number|null} packVoltageV
 * @property {number|null} powerKw
 * @property {number|null} motorPct
 * @property {string} fault
 * @property {"soc"|"range"|null} lowAlert
 * @property {number|null} updatedAt
 * @property {number|null} whPerMi
 * @property {number|null} projectedRangeMi
 * @property {number|null} fullPackRangeMi
 * @property {number} tripMi
 * @property {number} riddenMi
 * @property {number|null} whUsed
 * @property {boolean} calibrating
 * @property {number} packWh
 * @property {number} pointCount
 */

/**
 * @param {object} state
 * @param {{ powerKw?: number|null, motorPct?: number|null }} [live]
 * @returns {TelemetryFrame}
 */
export function buildFrame(state, live = {}) {
  const session = activeSession(state);
  const points = session?.points ?? [];
  const packWh = effectivePackWh(state);
  const ride = rideMath(points, packWh, CONFIG.calibrateMinSocUsed);
  const last = points.at(-1) ?? null;
  let packVoltageV = null;
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].packVoltageV != null) {
      packVoltageV = points[i].packVoltageV;
      break;
    }
  }
  const socPct = last ? last.socPct : null;
  return {
    bikeName: CONFIG.bikeName,
    sessionName: session?.name ?? "",
    mode: state.mode || "",
    socPct,
    odoMi: last ? last.odoMi : null,
    packVoltageV,
    powerKw: finiteOrNull(live.powerKw),
    motorPct: finiteOrNull(live.motorPct),
    fault: String(state.fault || ""),
    lowAlert: lowAlert({
      socPct,
      remainingMi: ride.remainingMi,
      lowSocPct: CONFIG.lowSocPct,
      lowRangeMi: CONFIG.lowRangeMi,
    }),
    updatedAt: last ? last.t : null,
    whPerMi: ride.whPerMi,
    projectedRangeMi: ride.remainingMi,
    fullPackRangeMi: ride.projectedFullMi,
    tripMi: ride.miSession,
    riddenMi: ride.miSession,
    whUsed: ride.whUsed,
    calibrating: ride.calibrating,
    packWh,
    pointCount: points.length,
  };
}

/**
 * Typed odometer + SOC checkpoints stored on this phone.
 * Trip is display-only and is never accepted as an input.
 */
export class ManualTelemetrySource {
  constructor() {
    this.state = loadState();
    /** @type {Set<(frame: TelemetryFrame) => void>} */
    this.listeners = new Set();
  }

  /** @param {(frame: TelemetryFrame) => void} listener @returns {() => void} */
  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.frame());
    return () => this.listeners.delete(listener);
  }

  /** @returns {TelemetryFrame} */
  frame() {
    return buildFrame(this.state);
  }

  /**
   * @param {{ odoMi: unknown, socPct: unknown, packVoltageV: unknown, fault: unknown }} raw
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  submitLog(raw) {
    const parsed = parseLog(raw);
    if (!parsed.ok) return parsed;
    const { odoMi, socPct, packVoltageV, fault } = parsed.value;
    const session = activeSession(this.state);
    const points = session.points;
    const last = points.at(-1);
    if (last && last.odoMi === odoMi && last.socPct === socPct) {
      if (packVoltageV != null) last.packVoltageV = packVoltageV;
      last.t = Date.now();
    } else {
      points.push({ t: Date.now(), odoMi, socPct, packVoltageV });
    }
    this.state.fault = fault;
    return this.persist();
  }

  /**
   * @param {{ packWh: unknown, mode: unknown }} raw
   * @returns {{ ok: true } | { ok: false, error: string }}
   */
  saveSettings(raw) {
    const packText = String(raw.packWh ?? "").trim();
    const packWh = packText === "" ? CONFIG.packWh : parseNum(packText);
    if (packWh == null || packWh < 100 || packWh > 20000) return { ok: false, error: "BAD PACK Wh" };
    const mode = CONFIG.modes.includes(raw.mode) ? raw.mode : "";
    this.state.packWhOverride = packWh === CONFIG.packWh ? null : packWh;
    this.state.mode = mode;
    return this.persist();
  }

  /** Archive the open ride and start a blank one. Prior rides stay stored. */
  newSession() {
    const session = {
      id: newId(),
      name: "Ride",
      startedAt: Date.now(),
      points: [],
    };
    this.state.sessions.push(session);
    this.state.activeSessionId = session.id;
    this.state.fault = "";
    trimSessions(this.state);
    return this.persist();
  }

  persist() {
    try {
      saveState(this.state);
    } catch {
      return { ok: false, error: "NOT SAVED" };
    }
    this.emit();
    return { ok: true };
  }

  emit() {
    const frame = this.frame();
    for (const listener of this.listeners) listener(frame);
  }
}

/** Stub. Wire this when an official export or file drop exists. */
export class OfficialExportSource {
  constructor() {
    this.listeners = new Set();
    this.latest = emptyLiveFrame();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.latest);
    return () => this.listeners.delete(listener);
  }

  frame() {
    return this.latest;
  }

  connect() {
    throw new Error("OfficialExportSource.connect is not implemented in v1");
  }
}

/**
 * Stub for a future documented open feed.
 * Not a place to sniff, decompile, or guess the stock radio protocol.
 */
export class OpenBleSource {
  constructor() {
    this.listeners = new Set();
    this.latest = emptyLiveFrame();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.latest);
    return () => this.listeners.delete(listener);
  }

  frame() {
    return this.latest;
  }

  connect() {
    throw new Error("OpenBleSource.connect is not implemented in v1");
  }
}

/** @param {unknown} value */
function finiteOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseLog(raw) {
  const odoMi = parseNum(raw.odoMi);
  const socPct = parseNum(raw.socPct);
  const voltsText = String(raw.packVoltageV ?? "").trim();
  const packVoltageV = voltsText === "" ? null : parseNum(voltsText);
  const fault = String(raw.fault ?? "").trim().slice(0, 64);

  if (odoMi == null || odoMi < 0 || odoMi > 1_000_000) return { ok: false, error: "NEED ODO" };
  if (socPct == null || socPct < 0 || socPct > 100) return { ok: false, error: "SOC 0–100" };
  if (packVoltageV != null && (packVoltageV < 0 || packVoltageV > 200)) {
    return { ok: false, error: "BAD VOLTAGE" };
  }
  return { ok: true, value: { odoMi, socPct, packVoltageV, fault } };
}

function emptyLiveFrame() {
  return {
    bikeName: CONFIG.bikeName,
    sessionName: "",
    mode: "",
    socPct: null,
    odoMi: null,
    packVoltageV: null,
    powerKw: null,
    motorPct: null,
    fault: "",
    lowAlert: null,
    updatedAt: null,
    whPerMi: null,
    projectedRangeMi: null,
    fullPackRangeMi: null,
    tripMi: 0,
    riddenMi: 0,
    whUsed: null,
    calibrating: true,
    packWh: CONFIG.packWh,
    pointCount: 0,
  };
}
