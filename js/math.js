/**
 * Session math from total odometer checkpoints. Trip is never an input.
 *
 *   soc_used_pct   = start_soc - soc
 *   mi_session     = odo - start_odo
 *   mi_per_pct     = mi_session / soc_used_pct
 *   projected_full = mi_per_pct * 100
 *   remaining_mi   = mi_per_pct * soc
 *   Wh/mi          = pack_Wh / projected_full
 *
 * Session-to-date (first checkpoint to latest), not a per-segment mix.
 * Remaining and Wh/mi stay "calibrating" until soc_used_pct >= 5 and miles
 * have increased. Pack Wh scales Wh/mi and Wh used. It cancels out of miles.
 */

/**
 * @param {unknown} value
 * @returns {number|null}
 */
export function parseNum(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value ?? "").trim().replace(/\s/g, "");
  if (!s) return null;
  if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  s = s.replace(/[^\d.-]/g, "");
  if (!s || s === "-" || s === "." || s === "-.") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {{ odoMi: number, socPct: number }[]} points
 * @param {number} packWh
 * @param {number} [minSocUsed]
 */
export function rideMath(points, packWh, minSocUsed = 5) {
  const first = points[0] ?? null;
  const last = points.at(-1) ?? null;
  const socUsedPct = first && last ? first.socPct - last.socPct : 0;
  const miRaw = first && last ? last.odoMi - first.odoMi : 0;
  const miSession = miRaw > 0 ? miRaw : 0;
  const calibrated = points.length >= 2 && socUsedPct >= minSocUsed && miSession > 0 && packWh > 0;
  if (!calibrated) {
    return {
      socUsedPct,
      miSession,
      miPerPct: null,
      projectedFullMi: null,
      remainingMi: null,
      whPerMi: null,
      whUsed: null,
      calibrating: true,
    };
  }
  const miPerPct = miSession / socUsedPct;
  const projectedFullMi = miPerPct * 100;
  const remainingMi = miPerPct * last.socPct;
  const whPerMi = projectedFullMi > 0 ? packWh / projectedFullMi : null;
  const whUsed = (socUsedPct * packWh) / 100;
  return {
    socUsedPct,
    miSession,
    miPerPct,
    projectedFullMi,
    remainingMi,
    whPerMi,
    whUsed,
    calibrating: false,
  };
}

/**
 * @param {{ socPct: number|null, remainingMi: number|null, lowSocPct: number, lowRangeMi: number }} input
 * @returns {"soc"|"range"|null}
 */
export function lowAlert(input) {
  const { socPct, remainingMi, lowSocPct, lowRangeMi } = input;
  if (socPct != null && Number.isFinite(socPct) && socPct <= lowSocPct) return "soc";
  if (remainingMi != null && Number.isFinite(remainingMi) && remainingMi <= lowRangeMi) return "range";
  return null;
}

/** @param {number|null|undefined} n @param {number} digits */
export function formatNumber(n, digits) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

/** @param {number|null|undefined} n */
export function formatSoc(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** @param {number|null|undefined} n */
export function formatWh(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/** Nearest whole Wh/mi. Miles use the unrounded mi/pct. */
export function formatWhPerMi(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(n));
}

/** @param {number|null|undefined} socPct @param {number} [segments] */
export function meterCount(socPct, segments = 10) {
  if (socPct == null || !Number.isFinite(socPct) || socPct <= 0) return 0;
  const count = Math.round((socPct / 100) * segments);
  return Math.max(1, Math.min(segments, count));
}

/** @param {number|null|undefined} socPct */
export function socTone(socPct) {
  if (socPct == null || !Number.isFinite(socPct)) return "none";
  if (socPct <= 10) return "low";
  if (socPct <= 20) return "mid";
  return "high";
}

/** @param {number|null|undefined} ts */
export function formatUpdated(ts) {
  if (ts == null) return "—";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "—";
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (sameDay) return time;
  const day = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${day}, ${time}`;
}

/** @param {Date} date */
export function formatClock(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
