**Report generated:** 2026-11-11 23:48:04
**Adapter:** ioBroker.snapmaker-u1
**Version reviewed:** 0.0.5
**Repository:** https://github.com/Negalein/ioBroker.snapmaker-u1 (tag v0.0.5)
**Previous review:** none
**Checklist version:** ioBroker Adapter Checklist V3.5
**Skill version:** 1.14.0
**Reviewer:** Codex / automated review

## Status of Previous Review Findings

No previous review.

## Full Re-Review Results (Checklist V3.5)

#### ✅ PASS items

- [x] Documentation and README
- [x] Icon
- [x] package.json and io-package.json metadata
- [x] Object IDs and object hierarchy from source
- [x] State roles and writable button attributes
- [x] Admin UI and translation completeness
- [x] TypeScript source-code structure
- [x] State-change acknowledgement and subscription handling
- [x] Networking and HTTP timeouts
- [x] Runtime validation of configurable timeouts and intervals
- [x] Sensitive-data handling
- [x] Security and package integrity
- [x] Dynamic camera object validation
- [x] Language and naming checks
- [x] Typecheck, unit tests, package tests, build, and package dry-run

#### 🔴 ACTIONABLE FINDINGS

#### Current v0.0.5 object dump is required

- [ ] Object dump validation: The PR-attached `snapmaker-u1.0.json` contains 110 objects but no timestamps and no `printer.control.toolhead.*` or `printer.control.extrusion.*` objects. It cannot validate the v0.0.5 runtime object tree. Export a new object dump from a working v0.0.5 installation and attach it to ioBroker/ioBroker.repositories PR #7059.

#### ⚠️ OBSERVATIONS

- `npm run lint` completes without errors but reports 137 pre-existing JSDoc warnings. They do not block the tested package, but can be reduced in a future documentation-only cleanup.
- The current release workflow uses successful npm trusted publishing and GitHub Release creation instead of `ioBroker/testing-action-deploy@v1`; the existing adapter-checker warning W3017 should be reassessed after the next checker run rather than changing a proven publishing flow without validating equivalent behaviour.
- The PAXX12 toolhead command paths are covered by unit tests and remain explicitly documented as requiring physical U1/PAXX12 validation before routine use.
