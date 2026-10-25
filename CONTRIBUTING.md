# Contributing

Contributions are welcome: bug fixes, layout and readability improvements, accessibility, and new telemetry sources that use official or documented feeds.

## Hard rule: no reverse engineering

Pull requests that contain sniffed, decompiled, or reverse-engineered protocols are rejected. This includes captured Bluetooth traffic from the stock bike or app, decompiled app code, guessed private packet formats, and pairing workarounds.

Telemetry may only come from official E-Ride exports or documented open APIs. If you are unsure whether a source qualifies, open an issue first.

## Math

Range and efficiency math must match `VEHICLE-SPEC.md`: odometer-only distance, `mi_per_pct` from the session start, the 5% SOC calibrating gate, and Wh/mi from pack Wh divided by projected full-pack miles. A PR that changes the math must update `VEHICLE-SPEC.md` in the same change and explain why. The Turkey Bay sample seed should still produce about 27.0 mi full-pack and 133 Wh/mi.

## Keep it static

The app is plain HTML, CSS, and vanilla JavaScript served as static files. No backend, no accounts, no build step, and no tracking. Data stays on the rider's phone.

## Pull requests

- Keep changes focused and describe what you tested (ideally on a phone in landscape).
- Keep the ride face high contrast with large digits; settings stay off the ride face.
