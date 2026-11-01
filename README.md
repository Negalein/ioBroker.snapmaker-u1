![Logo](admin/snapmaker-u1.png)

# ioBroker.snapmaker-u1

[![NPM version](https://img.shields.io/npm/v/iobroker.snapmaker-u1.svg)](https://www.npmjs.com/package/iobroker.snapmaker-u1)
[![Tests](https://github.com/Negalein/ioBroker.snapmaker-u1/actions/workflows/test-and-release.yml/badge.svg)](https://github.com/Negalein/ioBroker.snapmaker-u1/actions/workflows/test-and-release.yml)

An ioBroker adapter for monitoring a Snapmaker U1 through its local Moonraker service.

> This is an early development version. It only performs read-only Moonraker health checks and exposes basic printer information. It does not send print, motion, heater, or other control commands.

## Current functionality

- Connects locally to Moonraker at a configurable host and port (default: `7125`).
- Publishes `info.connection`, printer hostname, Moonraker version, status, and the last successful update.
- Supports the original firmware and PAXX12 as selectable configuration modes; protocol-specific features will follow after validation against real devices.
- Keeps optional Spoolman connection settings for a later, separate integration.

## Configuration

| Setting | Description |
| --- | --- |
| Moonraker host or IP address | Hostname or local IP address of the printer. Do not include `http://` or a path. |
| Moonraker port | Moonraker HTTP port; `7125` by default. |
| Firmware mode | Auto detect, original firmware, or PAXX12. |
| Request timeout | Maximum duration of one Moonraker request, in seconds. |
| Polling interval | Time between health checks, in seconds. |
| Spoolman | Optional placeholder settings for a later integration. |

## States

| State | Type | Meaning |
| --- | --- | --- |
| `info.connection` | boolean | Whether the latest Moonraker health check succeeded. |
| `printer.info.hostname` | string | Hostname reported by Moonraker. |
| `printer.info.firmware` | string | Moonraker software version. |
| `printer.info.status` | string | Printer state message reported by Moonraker. |
| `printer.info.lastUpdate` | number | Timestamp of the last successful query. |

## Development

```bash
npm install
npm run check
npm test
npm run lint
npm run build
```

The repository was generated with the official [`@iobroker/create-adapter`](https://github.com/ioBroker/create-adapter) tooling and uses TypeScript, JSON Config, adapter tests, and GitHub Actions.

## Roadmap

1. Validate the Moonraker payload and capabilities on a physical Snapmaker U1 for both supported firmware variants.
2. Add read-only print, job, and material states with documented state roles.
3. Add carefully scoped control states with correct `ack` handling.
4. Implement Spoolman synchronization after the printer-facing state model is stable.

## Disclaimer

Snapmaker and U1 are trademarks of their respective owners. This is an independent community project and is not affiliated with or endorsed by Snapmaker.

## License

MIT License. Copyright (c) 2026 Negalein.
