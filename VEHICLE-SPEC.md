# E-Ride Pro SR dash — vehicle-side spec

**As of:** 2026-10-23  
**Bike:** E-Ride Pro SR Special Edition  

Hard limit: **no stock BLE reverse-engineering**, decompile, sniff, or private-protocol invent. Custom UI is in scope. Live feed only via official export or documented open API later.

---

## 1) On-dash fields (v1 lock)

### Primary (always visible, huge)
| Field | Notes |
|-------|--------|
| SOC % | From rider input (dash) |
| Projected remaining mi | Live from session math |
| Wh/mi (session) | From pack Wh ÷ projected full-pack mi |

### Secondary
| Field | Notes |
|-------|--------|
| Pack voltage V | Optional; copy from official E RIDE PRO app if available |
| Motor / power | **Hide unless a clean input exists** — do not invent or show a fake gauge |
| Odo mi | **Total odometer = source of truth** for all range math |
| Trip mi | Session since power-on; **label only — never use for range math** (resets on power-off) |
| Mode | Optional typed: Sport / Race / Eco / Park |

### Alert strip (top)
- Fault banner (typed text, or empty)
- Low-SOC warn when **remaining ≤ 5 mi** or **SOC ≤ 20%**

---

## 2) Pack + formulas

**Pack assumption (editable constant):** 72V 50Ah ≈ **3600 Wh** usable for Wh/mi.

**Tracking rule:** always **total odo**. Never trip for range.

### Per update inputs
`odo_mi`, `soc_pct` (0–100), optional `pack_v`, optional `mode`, optional `fault_text`.

Session start = first checkpoint of the ride (`start_odo`, `start_soc`).

```
soc_used_pct     = start_soc - soc_pct
mi_session       = odo_mi - start_odo
mi_per_pct       = mi_session / soc_used_pct     # require soc_used_pct ≥ 5 before trusting
projected_full   = mi_per_pct * 100
remaining_mi     = mi_per_pct * soc_pct
Wh_per_mi        = 3600 / projected_full         # when projected_full > 0
```

### Display rules
- Until `soc_used_pct ≥ 5`: show **"calibrating"** for remaining + Wh/mi (still show SOC / odo).
- Prefer session-to-date `mi_per_pct` (smoother). Optional last-segment rate as small subtitle once ≥2 checkpoints after calibrate.
- Units: **mi / Wh/mi** (US). No km unless asked.
- If an implementation uses ~3.0 kWh or a different Wh/mi formula, it must align to **3600 Wh** and the formulas above.

### Sanity check only (not hard-coded)
Turkey Bay woods, hard Sport (+ some Race), Oct 23 2026: settled ~**27.0 mi** full-pack / ~**133 Wh/mi** (365 @ 19% from ~343.1 @ 100%, rider 205 lb before gear).

---

## 3) Trail UX (moto dash, not consumer app)

- Fullscreen / PWA, **landscape-first**, lock orientation if possible
- Big numbers only: SOC + remaining dominate; Wh/mi slightly smaller under remaining
- High contrast: dark bg, light glyphs; amber/red for low SOC
- **No** decorative chrome, tabs, Material/iOS nav while riding
- Glove-friendly: few large tap targets; update-at-stop = big bottom sheet (SOC stepper/num pad, odo field, optional V)
- One gear icon → park menu (settings off the ride face)
- Readable in sun; avoid thin fonts; 1–2 type sizes max on primary face
- Voice/photo: stubs OK in v1; typed at stops is enough

---

## 4) Input path (v1)

| Source | Status |
|--------|--------|
| Typed SOC % + odo at stops | **Wired** |
| Optional pack V from official app copy | Optional field |
| Photo / voice stubs | Same fields; no OCR required in v1 |
| `TelemetrySource = Manual \| OfficialExport \| OpenBLE` | **Only Manual wired** |

Checkpoint shape should match service log fields: `odo_mi`, `soc_pct`, derived `mi_session`, `soc_used_pct`, `mi_per_pct`, `projected_full_pack_mi`, `Wh_per_mi`, optional `pack_v` / `mode` / `fault_text`.

Reference session seed: Turkey Bay 2026-10-23 (start 343.1 @ 100% → 365 @ 19%).

---

## 5) Out of scope
- Sniffing / decompiling stock BLE
- Pairing cracks / private protocol dumps
- Fake motor-power gauge without a clean input
- Using trip meter for range math

## 6) Implementation checklist
- [ ] Pack Wh default = 3600
- [ ] Formulas = mi_per_pct path above (not alternate)
- [ ] Calibrating gate until soc_used ≥ 5%
- [ ] Motor power hidden unless clean input
- [ ] Odo for math; trip display-only
- [ ] Low-SOC strip (≤5 mi remaining or ≤20% SOC)
- [ ] TelemetrySource Manual only; stubs for OfficialExport / OpenBLE
