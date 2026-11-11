# Changelog

All notable changes to this project are documented here.

## 0.0.4 — 2026-11-11

### Added

- Capability-gated PAXX12 controls for U1 tools E0–E3.
- Fixed `CHANGE_TOOL LANE=E0`–`E3` and `LANE_UNLOAD LANE=E0`–`E3` commands, offered only after the matching AFC Lite macro and lane object are detected.
- Per-extruder target-temperature controls using the printer's reported Klipper limits, with a margin below `max_temp` and faulty-toolhead protection.
- Guarded manual extrusion/retraction for the active hot tool only.
- Toolhead capability, safety and AFC fault diagnostics.

### Safety

- No park command is offered: no verified U1/PAXX12 park macro was identified.
- Toolhead commands require explicit PAXX12 mode, fresh Moonraker capability data and an idle printer. Tool changes/unloads additionally require a known fault-free AFC state.
- Existing AFC monitoring and v0.0.3 Home/Jog/Pause/Resume/Cancel controls are unchanged.

### Deutsch

- Neue Steuerungen für Werkzeugwechsel, Entladen, individuelle Extruder-Solltemperaturen und manuelles Extrudieren/Retract werden nur aktiviert, wenn die jeweilige PAXX12-/AFC-Fähigkeit am Drucker erkannt wurde.
- Parken wird bewusst nicht angeboten, weil kein verifiziertes U1/PAXX12-Parkmakro vorliegt.
