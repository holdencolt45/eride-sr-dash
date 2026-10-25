# E-Ride SR Dash

A motorcycle-style instrument cluster for the E-Ride Pro SR, built as a phone web app (PWA). Landscape, dark, large digits. It shows state of charge (SOC), projected remaining range, and session Wh/mi from odometer and SOC readings you log at stops.

This is an unofficial project. It is not affiliated with, endorsed by, or supported by E-Ride.

## Features

- Large SOC and projected remaining miles, with session Wh/mi under the range
- Smaller row for pack volts, trip, and odometer
- Top alert strip: typed warning text, or LOW SOC (SOC at or under 20%) and LOW RANGE (remaining at or under 5 mi)
- Glove-friendly stop entry: tap LOG or swipe up to enter odometer, SOC, optional volts, optional warning
- Settings behind one gear icon: pack Wh estimate, ride mode (Sport / Race / Eco / Park), NEW RIDE
- Works offline after the first load (service worker); no account, no server, data stays in the phone's `localStorage`
- Motor power is hidden unless a telemetry frame actually carries it; nothing invents a kW figure

## Install on a phone

The app needs to be served over HTTP (service workers and ES modules do not work from `file://`). To self-host from this folder:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

Put the phone on the same network and open `http://<computer-ip>:8080/`. In Safari, tap Share, then Add to Home Screen. Open SR Dash from the home screen and turn the phone sideways. On Android Chrome, use Add to Home Screen or Install app from the menu.

Offline use needs an HTTPS address. Browsers only install the offline cache (service worker) on HTTPS or localhost, so over plain `http://<computer-ip>` the home-screen icon works but the app will not load without a connection. For offline use, serve it from any HTTPS host, such as GitHub Pages, Tailscale Serve, or your own TLS server.

Log entries are stored per site address. If the address changes (for example a new IP), the phone treats it as a new site with empty data.

## The math

Constants live in `js/config.js`. The default usable pack energy is 3600 Wh (72V x 50Ah estimate). The odometer is the only distance input; the trip meter is display only and never used for range.

From the first checkpoint of the ride to the latest:

```text
soc_used_pct   = start_soc - soc
mi_session     = odo - start_odo
mi_per_pct     = mi_session / soc_used_pct
projected_full = mi_per_pct * 100
remaining_mi   = mi_per_pct * soc
Wh/mi          = 3600 / projected_full
```

Until the ride has used at least 5% SOC and the odometer has moved, range and Wh/mi read CALIBRATING. SOC and odometer still show. Pack Wh cancels out of the mile figures; it only scales Wh/mi and Wh used.

To change the pack estimate, edit `packWh` in `js/config.js`, or on the phone open the gear, set PACK Wh EST., and save.

See `VEHICLE-SPEC.md` for the full field and display specification.

## Sample data: Turkey Bay

On first launch the app seeds a sample ride (Turkey Bay, Oct 23 2026, hard Sport with some Race, rider about 205 lb before gear):

- 343.1 mi at 100% SOC, then 365 mi at 19% SOC
- 21.9 mi ridden on 81 SOC points
- Full pack about 27.0 mi; remaining at 19% about 5.1 mi
- Wh/mi = 3600 / 27.0, about 133
- SOC under 20%, so the strip reads LOW SOC

Start a NEW RIDE from settings to replace it with your own log.

## Adding a TelemetrySource

v1 uses `ManualTelemetrySource` (typed entries at stops). `js/telemetry.js` also contains stubs, `OfficialExportSource` and `OpenBleSource`, that throw on `connect()`.

To add a source:

1. Implement a class in `js/telemetry.js` with `subscribe(listener)` that registers a callback and returns an unsubscribe function.
2. Emit a `TelemetryFrame` (see `buildFrame` in the same file) to listeners whenever new data arrives. Include `powerKw` or `motorPct` only if the feed really provides them.
3. Construct your source in `js/app.js` in place of `ManualTelemetrySource`.

## No reverse engineering

This project never reverse-engineers E-Ride's Bluetooth protocol or app. It does not sniff, decompile, or guess private protocols. Live data will only come from official E-Ride exports or documented open APIs. Contributions that violate this are rejected; see `CONTRIBUTING.md`.

## License

MIT, see `LICENSE`. Barlow Condensed is licensed under the SIL Open Font License (`fonts/OFL.txt`).
