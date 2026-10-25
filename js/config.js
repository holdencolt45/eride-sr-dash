/**
 * v1 dash constants. Pack energy is an estimate, not a measured capacity.
 * 72V × 50Ah ≈ 3600 Wh. Change packWh here.
 * A value saved from the gear menu overrides it until set back to this
 * number or the phone's site data is cleared.
 */
export const CONFIG = {
  bikeName: "E-RIDE PRO SR",
  /** Usable pack energy estimate, watt-hours. */
  packWh: 3600,
  /** Trust remaining miles and Wh/mi only after this much SOC has been used. */
  calibrateMinSocUsed: 5,
  /** Alert strip when SOC is at or under this percent. */
  lowSocPct: 20,
  /** Alert strip when projected remaining miles are at or under this. */
  lowRangeMi: 5,
  meterSegments: 10,
  modes: ["Sport", "Race", "Eco", "Park"],
};
