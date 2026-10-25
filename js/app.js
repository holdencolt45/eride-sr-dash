import { formatClock, formatNumber, formatSoc, formatUpdated, formatWh, formatWhPerMi, meterCount, socTone } from "./math.js";
import { ManualTelemetrySource } from "./telemetry.js";

/**
 * v1 wires ManualTelemetrySource. OfficialExportSource and OpenBleSource
 * in telemetry.js are the later hooks. Swap the constructor when one of
 * those feeds exists. Do not add a private bike protocol.
 */
const source = new ManualTelemetrySource();

const cluster = document.querySelector("#cluster");
const logSheet = document.querySelector("#log-sheet");
const setSheet = document.querySelector("#set-sheet");
const form = document.querySelector("#log-form");
const setForm = document.querySelector("#set-form");
const els = {
  bike: document.querySelector("#bike-name"),
  session: document.querySelector("#session-name"),
  clock: document.querySelector("#clock"),
  fault: document.querySelector("#fault-strip"),
  socGauge: document.querySelector("#soc-gauge"),
  soc: document.querySelector("#soc-value"),
  meter: document.querySelector("#soc-meter"),
  rangeGauge: document.querySelector(".gauge-range"),
  range: document.querySelector("#range-value"),
  rangeUnit: document.querySelector("#range-unit"),
  full: document.querySelector("#full-pack"),
  powerGauge: document.querySelector("#power-gauge"),
  power: document.querySelector("#power-value"),
  powerUnit: document.querySelector("#power-unit"),
  ticks: document.querySelector("#power-ticks"),
  voltage: document.querySelector("#voltage-value"),
  whmi: document.querySelector("#whmi-value"),
  whmiLabel: document.querySelector("#whmi-label"),
  trip: document.querySelector("#trip-value"),
  odo: document.querySelector("#odo-value"),
  ridden: document.querySelector("#ridden-value"),
  whUsed: document.querySelector("#wh-used-value"),
  packKwh: document.querySelector("#pack-kwh"),
  updated: document.querySelector("#updated-value"),
  open: document.querySelector("#open-log"),
  close: document.querySelector("#close-log"),
  openSet: document.querySelector("#open-set"),
  closeSet: document.querySelector("#close-set"),
  newRide: document.querySelector("#new-ride"),
  error: document.querySelector("#log-error"),
  setError: document.querySelector("#set-error"),
  odoIn: document.querySelector("#odo-input"),
  socIn: document.querySelector("#soc-input"),
  voltsIn: document.querySelector("#volts-input"),
  packIn: document.querySelector("#pack-wh-input"),
  faultIn: document.querySelector("#fault-input"),
};

const meterCells = [...els.meter.querySelectorAll("i")];
const tickCells = [...els.ticks.querySelectorAll("i")];
const modeKeys = [...document.querySelectorAll("#mode-keys button")];
let armTimer = 0;
let selectedMode = "";

source.subscribe(render);
tickClock();
setInterval(tickClock, 1000);
bindViewport();
bindSwipe();
registerWorker();

els.open.addEventListener("click", () => openLog());
els.close.addEventListener("click", () => closeLog());
els.openSet.addEventListener("click", () => openSet());
els.closeSet.addEventListener("click", () => closeSet());
els.newRide.addEventListener("click", onNewRide);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = source.submitLog({
    odoMi: els.odoIn.value,
    socPct: els.socIn.value,
    packVoltageV: els.voltsIn.value,
    fault: els.faultIn.value,
  });
  if (!result.ok) {
    els.error.textContent = result.error;
    return;
  }
  closeLog();
});
setForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = source.saveSettings({ packWh: els.packIn.value, mode: selectedMode });
  if (!result.ok) {
    els.setError.textContent = result.error;
    return;
  }
  closeSet();
});
for (const key of modeKeys) {
  key.addEventListener("click", () => {
    selectedMode = selectedMode === key.dataset.mode ? "" : key.dataset.mode;
    paintModes();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (logSheet.classList.contains("is-open")) closeLog();
  else if (setSheet.classList.contains("is-open")) closeSet();
});

function render(frame) {
  els.bike.textContent = frame.bikeName;
  els.session.textContent = frame.mode
    ? `${frame.sessionName} · ${frame.mode}`
    : frame.sessionName;
  els.soc.textContent = formatSoc(frame.socPct);
  els.socGauge.dataset.tone = socTone(frame.socPct);
  const lit = meterCount(frame.socPct, meterCells.length);
  meterCells.forEach((cell, index) => cell.classList.toggle("on", index < lit));

  els.rangeGauge.classList.toggle("is-calibrating", frame.calibrating);
  if (frame.calibrating) {
    els.range.textContent = "—";
    els.rangeUnit.textContent = "";
    els.whmi.textContent = "CALIBRATING";
    els.whmiLabel.textContent = "";
    els.full.textContent = "";
  } else {
    els.range.textContent = formatNumber(frame.projectedRangeMi, 1);
    els.rangeUnit.textContent = "MI";
    els.whmi.textContent = formatWhPerMi(frame.whPerMi);
    els.whmiLabel.textContent = "WH/MI";
    els.full.textContent = frame.fullPackRangeMi == null
      ? ""
      : `FULL ${formatNumber(frame.fullPackRangeMi, 1)} MI`;
  }

  const hasPower = frame.powerKw != null || frame.motorPct != null;
  els.powerGauge.hidden = !hasPower;
  cluster.classList.toggle("has-power", hasPower);
  if (hasPower) {
    const power = formatPower(frame);
    els.power.textContent = power.text;
    els.powerUnit.textContent = power.unit;
    tickCells.forEach((cell, index) => cell.classList.toggle("on", index < power.tickCount));
  }

  els.voltage.textContent = formatNumber(frame.packVoltageV, 1);
  els.trip.textContent = formatNumber(frame.tripMi, 1);
  els.odo.textContent = formatNumber(frame.odoMi, 1);
  els.ridden.textContent = formatNumber(frame.riddenMi, 1);
  els.whUsed.textContent = formatWh(frame.whUsed);
  els.packKwh.textContent = (frame.packWh / 1000).toFixed(1);
  els.updated.textContent = formatUpdated(frame.updatedAt);
  paintAlert(frame);
}

function paintAlert(frame) {
  els.fault.classList.remove("is-set", "is-low");
  if (frame.fault) {
    els.fault.textContent = frame.fault;
    els.fault.classList.add("is-set");
    return;
  }
  if (frame.lowAlert === "soc") {
    els.fault.textContent = "LOW SOC";
    els.fault.classList.add("is-set", "is-low");
    return;
  }
  if (frame.lowAlert === "range") {
    els.fault.textContent = "LOW RANGE";
    els.fault.classList.add("is-set", "is-low");
    return;
  }
  els.fault.textContent = "";
}

function formatPower(frame) {
  const ticks = tickCells.length || 10;
  if (frame.powerKw != null) {
    return { text: frame.powerKw.toFixed(1), unit: "kW", tickCount: 0 };
  }
  const pct = Math.min(100, Math.max(0, frame.motorPct));
  return {
    text: String(Math.round(pct)),
    unit: "%",
    tickCount: Math.round((pct / 100) * ticks),
  };
}

function openLog() {
  closeSet(false);
  fillLog(source.frame());
  els.error.textContent = "";
  showSheet(logSheet, els.odoIn);
}

function closeLog() {
  hideSheet(logSheet);
  els.open.focus();
}

function openSet() {
  closeLogQuiet();
  const frame = source.frame();
  els.packIn.value = String(frame.packWh);
  selectedMode = frame.mode || "";
  paintModes();
  els.setError.textContent = "";
  disarmNewRide();
  showSheet(setSheet, els.packIn);
}

function closeSet(focusGear = true) {
  hideSheet(setSheet);
  disarmNewRide();
  if (focusGear) els.openSet.focus();
}

function closeLogQuiet() {
  hideSheet(logSheet);
}

function showSheet(sheet, focus) {
  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  sheet.removeAttribute("inert");
  cluster.setAttribute("inert", "");
  cluster.setAttribute("aria-hidden", "true");
  focus.focus();
}

function hideSheet(sheet) {
  sheet.classList.remove("is-open");
  sheet.setAttribute("aria-hidden", "true");
  sheet.setAttribute("inert", "");
  if (!logSheet.classList.contains("is-open") && !setSheet.classList.contains("is-open")) {
    cluster.removeAttribute("inert");
    cluster.removeAttribute("aria-hidden");
  }
}

function fillLog(frame) {
  els.odoIn.value = frame.odoMi == null ? "" : String(frame.odoMi);
  els.socIn.value = frame.socPct == null ? "" : String(frame.socPct);
  els.voltsIn.value = frame.packVoltageV == null ? "" : String(frame.packVoltageV);
  els.faultIn.value = frame.fault || "";
}

function paintModes() {
  for (const key of modeKeys) key.classList.toggle("is-on", key.dataset.mode === selectedMode);
}

function onNewRide() {
  if (!els.newRide.classList.contains("is-armed")) {
    els.newRide.classList.add("is-armed");
    els.newRide.textContent = "CONFIRM";
    armTimer = window.setTimeout(disarmNewRide, 4000);
    return;
  }
  const result = source.newSession();
  disarmNewRide();
  if (!result.ok) {
    els.setError.textContent = result.error;
    return;
  }
  els.setError.textContent = "";
}

function disarmNewRide() {
  window.clearTimeout(armTimer);
  els.newRide.classList.remove("is-armed");
  els.newRide.textContent = "NEW RIDE";
}

function tickClock() {
  els.clock.textContent = formatClock(new Date());
  els.clock.dateTime = new Date().toISOString();
}

function bindViewport() {
  const vv = window.visualViewport;
  if (!vv) return;
  const apply = () => {
    document.documentElement.style.setProperty("--vv-height", `${vv.height}px`);
    document.documentElement.style.setProperty("--vv-top", `${vv.offsetTop}px`);
  };
  vv.addEventListener("resize", apply);
  vv.addEventListener("scroll", apply);
  apply();
}

function bindSwipe() {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  cluster.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    tracking = true;
    startX = event.clientX;
    startY = event.clientY;
  });
  cluster.addEventListener("pointerup", (event) => {
    if (!tracking) return;
    tracking = false;
    const dy = event.clientY - startY;
    const dx = event.clientX - startX;
    if (dy < -56 && Math.abs(dy) > Math.abs(dx) * 1.2) openLog();
  });
  cluster.addEventListener("pointercancel", () => {
    tracking = false;
  });

  for (const sheet of [logSheet, setSheet]) {
    sheet.addEventListener("pointerdown", (event) => {
      if (event.target.closest("input, button")) return;
      tracking = true;
      startX = event.clientX;
      startY = event.clientY;
    });
    sheet.addEventListener("pointerup", (event) => {
      if (!tracking || !sheet.classList.contains("is-open")) return;
      tracking = false;
      const dy = event.clientY - startY;
      const dx = event.clientX - startX;
      if (dy > 56 && Math.abs(dy) > Math.abs(dx) * 1.2) {
        if (sheet === logSheet) closeLog();
        else closeSet();
      }
    });
  }
}

function registerWorker() {
  if (!("serviceWorker" in navigator)) return;
  const register = () => navigator.serviceWorker.register("./sw.js").catch(() => {});
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register);
}
