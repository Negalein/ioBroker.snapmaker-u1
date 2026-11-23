# Native Spoolman integration

Enable the optional integration and configure the Spoolman base URL, e.g. `http://spoolman:7912/` without `/api/v1`. The adapter reads `GET api/v1/spool/{id}` for AFC lanes E0–E3. Assign spools in the existing Klipper/AFC UI; changes are detected on the next printer poll. No printer commands, AFC assignments or consumption writes are issued. AFC/Moonraker continues accounting consumption to avoid double counting.

## Configuration

| Setting | Default | Meaning |
| --- | --- | --- |
| Enable integration | off | Start native service |
| Base URL | empty | HTTP(S) server, no embedded credentials, query or fragment |
| Update interval | 300 seconds | Weight refresh, 5–3600 seconds; changed lane IDs bypass cache |
| Warning / empty threshold | 300 / 100 g | Strictly below threshold; empty must be less than warning |
| Weekday start / end | 7 / 22 | Monday–Friday warning hours |
| Weekend start / end | 10 / 20 | Saturday/Sunday warning hours |
| Restrict empty alarms to window | off | Critical alarms bypass window, matching supplied script |
| Telegram enabled | off | Send only while print_stats.state is printing |
| Telegram instance | telegram.0 | Installed Telegram adapter instance |
| Telegram recipient | empty | Telegram user, or configured recipients when empty |
| Legacy VIS mirror | off | Write existing VIS paths only after old script is stopped |

Window hours use the ioBroker host timezone (e.g. Europe/Vienna), range 0–24, inclusive start and exclusive end. Overnight windows are supported; equal bounds mean all day. Printer polling determines detection latency; API refresh is evaluated at the next printer poll after the interval expires.

## Native states

States are acknowledged and read-only under `snapmaker-u1.0.spoolman` (replace instance number).

| Path | Meaning |
| --- | --- |
| apiConnected | Last native update succeeded, separate from Moonraker bridge connection |
| lastError / lastUpdate | Native integration error / timestamp of last successful API fetch |
| warnzeit_aktiv / druck_laeuft | Warning window / printing flag |
| aktiv.1 … aktiv.4 | Fixed mapping T0/E0 … T3/E3 |
| aktiv.N.active / extruder / lane / spool_id | Assignment identity |
| aktiv.N.name / material / color | Filament name, material, color_hex |
| aktiv.N.initial_weight / used_weight / remaining_weight | Grams; API remaining_weight is authoritative |
| aktiv.N.status | INAKTIV, OK, WARN, LEER |
| aktiv.N.warnung / alarm | Notification submitted for this assignment; retained across restarts |

Warning and critical latches are separate. Spool changes/unload reset them; weight at or above warning threshold rearms both. Print start and window opening are evaluated each printer poll using cached weights. Failed Telegram submissions retry later; delivery depends on Telegram. A process stop between submission and latch persistence can produce a duplicate.

Missing/archived spools, unknown weights, incomplete AFC telemetry and API failures retain the previous slot snapshot, set apiConnected=false and report lastError. Unknown weights never trigger zero-weight alarms. All four lanes are validated before publication. Inspect lastUpdate for data freshness and info.connection for printer availability. No new snapshot is available while the printer is offline. HTTP requests are serialized, bounded by a timeout and cancelled on unload; newer queued snapshots supersede obsolete responses.

## VIS 1 migration and acceptance

The supplied `Spoolman_JS(1).js` identifies itself internally as v1.0.0, although the requested replacement was named V1.0.1. Its actual field names and behavior are the compatibility contract. No existing script is disabled automatically.

1. Keep the existing script active. Enable native Spoolman with Telegram **off** and legacy mirror **off**. VIS continues using the script.
2. Compare four native slots against Spoolman and `0_userdata.0.3DDrucker.Spoolman.aktiv.N`. Test IDs, mapping, weights, material, spool replacement and unload using the existing AFC UI. Test API disconnect/recovery without false alarms.
3. Test native Telegram with a dedicated recipient and isolate old script notifications to avoid duplicates. Exercise WARN, LEER, idle/printing, time windows, repeated polling, replacement, refill and adapter restart. Thresholds can be temporarily adjusted to test safely.
4. **Only after successful functional testing**, disable the old script manually, enable legacy mirror and desired native notifications, then verify all three VIS HTML widgets. Do not run both writers simultaneously.
5. Rollback: disable native Telegram and legacy mirror, restart adapter, then re-enable old script.

Mirror mode copies `warnzeit_aktiv`, `druck_laeuft` and every `aktiv.1…4` field to **0_userdata.0.3DDrucker.Spoolman**, preserving existing object definitions and VIS bindings. Enable on only one adapter instance. No SSH, SQLite executable or klipper-moonraker adapter is required for the native service.

## Development

Run npm ci, npm run check, npm run build, npm test and npm run lint. Tests use mocked HTTP and ioBroker state APIs and never send real notifications. Hardware acceptance remains outstanding until the above checklist is completed.

Reviewed against [ioBroker requirements](https://github.com/ioBroker/ioBroker.repositories) and [best practices](https://www.iobroker.com/docs/dev/bestpractices.md): adapter-core APIs, typed objects, roles and units, acknowledged changed-only writes, structured hierarchy, bounded HTTP, unload cleanup, optional compatibility writes, no direct database access. See [Spoolman API source](https://github.com/Donkie/Spoolman/blob/master/spoolman/api/v1/spool.py) and your server's /docs for API details.
