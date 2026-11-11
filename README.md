![Logo](admin/snapmaker-u1.png)

# ioBroker.snapmaker-u1

[![NPM version](https://img.shields.io/npm/v/iobroker.snapmaker-u1.svg)](https://www.npmjs.com/package/iobroker.snapmaker-u1)
[![Tests](https://github.com/Negalein/ioBroker.snapmaker-u1/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/Negalein/ioBroker.snapmaker-u1/actions/workflows/test-and-release.yml)

An ioBroker adapter for monitoring a [Snapmaker U1](https://www.snapmaker.com/) through its local Moonraker service, with top-cover fan control, AFC/Spoolman metadata, camera discovery, print-preview URLs and guarded PAXX12 motion/print controls.

> This is an early development version. The v0.0.3 control points are deliberately restricted to an explicitly selected **PAXX12** firmware mode. They do not claim compatibility with the original Snapmaker firmware, which has not been validated. Use motion controls only while attending a clear, safe printer.

## Current functionality

### Cameras and print preview

In the settings, open **Discover and select cameras** (German: **Kameras suchen und auswählen**) to retrieve enabled cameras from Moonraker and save a multiple selection. Save the printer host first and keep the adapter running for discovery. No network scan is performed.

Selected cameras are published under `cameras.<Moonraker UID>` with name, enabled flag, stream URL, snapshot URL, service, rotation and mirror settings. The adapter reads camera configuration only; it does not open continuous video streams or claim that a camera is reachable. WebRTC requires a compatible viewer. Historical camera objects remain after deselection but are no longer refreshed.

`printer.job.previewUrl` contains the largest embedded thumbnail of the current G-code file. It is cleared when no file is selected or preview is disabled. Camera/thumbnail failures are logged at debug level and do not mark the printer disconnected. Camera URLs must be reachable from the browser displaying them. Camera discovery, settings and data points have been tested in an installed ioBroker instance with PAXX12. A configured camera entry is not proof of a reachable stream.

Top-cover fan control: write a numeric percentage (0–100, `ack=false`) to `printer.cover.circulation.speed` or `printer.cover.exhaust.speed`. Commands are serialized and acknowledged from a subsequent printer status query. Both fans were live-tested with a five-percentage-point change and restored. Firmware automation may subsequently change fan speeds. Invalid values are rejected.

Enable **Spoolman integration** to read AFC lane material, filament name, color, spool ID, loaded flag and raw status for lanes 0–3, plus the current AFC lane and error flag. Moonraker's Spoolman connection status and active spool ID are exposed under `printer.spoolman`. These values are read through Moonraker; the separate Spoolman URL is reserved for future inventory queries. No spool assignments or consumption reports are written by this adapter.

Read-only status polling has been verified on PAXX12 `2.0.0-paxx12-24`:

- `printer.job`: state, filename, elapsed print duration (seconds), filament used (mm), progress (percent), and paused flag.
- `printer.tools.active`: active extruder name.
- `printer.tools.tool0` through `tool3`: actual temperature, target temperature, and tool status.
- `printer.bed`: actual and target temperature.
- `printer.chamber.temperature`: chamber temperature.

The monitoring states are read-only. The two fan speed states and the guarded PAXX12 control states described below are writable. Missing or invalid values are skipped. The owner has tested version 0.0.2 in ioBroker, including live printer data, cameras, AFC/Spoolman metadata and reconnection after power-off. Original firmware compatibility remains unverified.

- Connects locally to Moonraker at a configurable host and port (default: `7125`).
- Publishes `info.connection`, printer hostname, Klipper software version, status, and the last successful update. The existing state ID `printer.info.firmware` is retained.
- Supports the original firmware and PAXX12 as selectable configuration modes; protocol-specific features will follow after validation against real devices.
- Reads AFC and Spoolman metadata through Moonraker. Direct Spoolman inventory access is not implemented.

### Motion and print control (PAXX12 only)

Set **Firmware mode** to **PAXX12 firmware** to enable the control states. `auto` and `original` modes deliberately reject every Home, Jog, Pause, Resume and Cancel request. This avoids claiming support for the original firmware before it has been physically verified.

Each new motion/print control request first fetches a fresh Moonraker status and passes one central safety check. The adapter sends only fixed, internally generated Klipper commands; it does not expose a free-form G-code state.

- Home commands use `G28` or `G28 X`, `G28 Y`, `G28 Z` and are allowed only when `print_stats.state` is `standby`, `complete` or `cancelled`.
- Jog commands are limited to **0.1–25 mm** at **1–100 mm/s**. They require an idle printer, a homed target axis, finite current coordinates, and Moonraker-reported `axis_minimum`/`axis_maximum` values that contain the target. The generated script saves and restores the Klipper G-code state.
- `Pause` is permitted only while printing; `Resume` only while paused; and `Cancel` only while printing or paused.
- Commands are serialized, buttons reset to `false` after handling, and rejected/failed requests are published in `printer.control.lastError`.

The control commands and their safety rules are unit-tested, but the new motion and job-control paths still need validation on a physical PAXX12-equipped U1 before relying on them in everyday operation. Tool changes, toolhead parking, heaters and extrusion are intentionally out of scope for this version.

## Configuration

| Setting                      | Description                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Moonraker host or IP address | Hostname or local IP address of the printer. Do not include `http://` or a path.    |
| Moonraker port               | Moonraker HTTP port; `7125` by default.                                             |
| Firmware mode                | Auto detect, original firmware, or PAXX12.                                          |
| Request timeout              | Maximum duration of one Moonraker request, in seconds.                              |
| Polling interval             | Time between health checks, in seconds.                                             |
| Spoolman integration         | Enables AFC lane and Spoolman status queries through Moonraker.                     |
| Spoolman host and port       | Reserved for future direct inventory queries; currently not used for communication. |
| Discover and select cameras  | Reads enabled Moonraker camera entries and saves the selected cameras.              |
| Print preview                | Enables the current G-code thumbnail URL.                                           |

## States

| State                                                                                                 | Type           | Meaning                                                                                                   |
| ----------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `info.connection`                                                                                     | boolean        | Whether the latest Moonraker health check succeeded.                                                      |
| `printer.info.hostname`                                                                               | string         | Hostname reported by Moonraker.                                                                           |
| `printer.info.firmware`                                                                               | string         | Klipper software version returned by Moonraker's printer info endpoint.                                   |
| `printer.info.status`                                                                                 | string         | Printer state message reported by Moonraker.                                                              |
| `printer.info.lastUpdate`                                                                             | number         | Timestamp of the last successful query.                                                                   |
| `printer.motion.position.x`, `.y`, `.z`                                                               | number         | Current toolhead coordinates reported by Moonraker, in mm.                                                |
| `printer.control.home.all`, `.x`, `.y`, `.z`                                                          | boolean button | Write `true` to home all axes or the selected axis. Resets to `false`.                                    |
| `printer.control.jog.step`                                                                            | number         | Jog distance in mm (0.1–25).                                                                              |
| `printer.control.jog.speed`                                                                           | number         | Jog speed in mm/s (1–100).                                                                                |
| `printer.control.jog.xPositive`, `.xNegative`, `.yPositive`, `.yNegative`, `.zPositive`, `.zNegative` | boolean button | Write `true` to move by the configured step and speed. Resets to `false`.                                 |
| `printer.control.job.pause`, `.resume`, `.cancel`                                                     | boolean button | Write `true` to control the current print when its current state permits it. Resets to `false`.           |
| `printer.control.safety.enabled`                                                                      | boolean        | `true` only when PAXX12 mode was explicitly selected.                                                     |
| `printer.control.safety.homingAllowed`, `.joggingAllowed`, `.jobControlAllowed`                       | boolean        | Current availability hints from the last Moonraker status. Every request is checked again before sending. |
| `printer.control.safety.reason`                                                                       | string         | Reason why control is unavailable or a reminder that individual requests are rechecked.                   |
| `printer.control.lastCommand` / `printer.control.lastError`                                           | string         | Last accepted control state ID / latest rejected or failed request reason.                                |

## Development

Requires Node.js 22.19.0 or newer and ioBroker Admin 7.6.20 or newer. CI covers Node.js 22, 24 and 26.

```bash
npm install
npm run check
npm test
npm run lint
npm run build
```

The repository was generated with the official [`@iobroker/create-adapter`](https://github.com/ioBroker/create-adapter) tooling and uses TypeScript, JSON Config, adapter tests, and GitHub Actions.

## Roadmap

1. Validate the new PAXX12 motion and print-control commands on a physical Snapmaker U1 and document the tested firmware release.
2. Validate Moonraker payloads and capabilities on a physical U1 running original firmware before enabling any control for it.
3. Extend automated tests for print, material and media data.
4. Validate shutdown and restart in compact mode.
5. Add direct Spoolman inventory access if required.

## Disclaimer

Snapmaker and U1 are trademarks of their respective owners. This is an independent community project and is not affiliated with or endorsed by Snapmaker.

## Changelog

### 0.0.3 (2026-11-10)

- (Negalein) Add guarded PAXX12 Home, jog, position and print-control data points.

### 0.0.2 (2026-11-02)

- (Negalein) Enable trusted publishing through GitHub Actions after successful checks.

### 0.0.1 (2026-11-01)

- (Negalein) Created the initial adapter scaffold.

## License

Copyright (c) 2026 Negalein <negalein@gmail.com>

Licensed under the [MIT License](LICENSE).
