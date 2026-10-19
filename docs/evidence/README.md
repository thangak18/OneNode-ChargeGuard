# Evidence index

Preserve the distinction between time-stamped runs. No screenshot in this directory is a guarantee of current cloud status.

## Current verified Phase D resumption — incident demo-58a1983cae09

- `phase-d-e2e.json`: original Copilot partial capture retained at its original keys; `liveVerification` and `currentResult` contain the completed same-incident lifecycle and direct Atlas readback. All exported telemetry here is SYNTHETIC.
- `phase-d-fault-alert.png`: authenticated US1 monitor 334137944 actually in ALERT during controlled re-emission on the existing incident.
- `phase-d-fault-recovered.png`: the same monitor in OK, with its recorded state history.
- `phase-d-correlated-fault-log.png`: actual US1 parsed fault log with matching incident/run/station/charger and synthetic provenance context.
- `phase-d-resolved-action-log.png`: actual US1 `demo.action` / `action:resolved` for the same incident.
- `phase-d-dashboard-current.png`: existing operations dashboard at capture time; no duplicate dashboard was created.
- `phase-d-ui-incident-resolved.png`: final local incident UI with RESOLVED status and four persisted audit actions.
- `phase-d-ui-demo.png`: current local demo control screen, preserving the synthetic/non-hardware scope.

See [Phase D verification](../PHASE_D_VERIFICATION.md) for exact source, monitor-history and observer timestamps. The observation-based detection upper bound includes polling and note-taking. The timeline-based recovery figure has seconds-precision/clock-alignment limitations. Incident status and monitor status were verified separately.

## Preserved Copilot Phase D UI captures

`ui-overview-desktop.png`, `ui-chargers-desktop.png`, `ui-charger-mobile.png`, `ui-incidents-desktop.png` and `ui-demo-desktop.png` are pre-existing captures from the partial handoff. Their original bytes were preserved. They may show stale/open states and are not current Datadog evidence. In particular, `ui-demo-desktop.png` is visibly a partial capture and should not be used as complete-page presentation proof; use the newer Phase D demo capture. Mobile/viewport results reported by Copilot are historical baseline checks, not newly asserted verification by this continuation.

## Historical Phase B artifacts

`phase-b2-incident.json`, `operations-dashboard.png`, `ingestion-alert.png`, `ingestion-recovered.png`, `synthetic-fault-alert.png` and `synthetic-fault-recovered.png` belong to earlier Phase B verification. Their run IDs and times remain unchanged.

## Publishing and retention

These artifacts are committed to the existing private project for owner/judge review. Before recording or sharing publicly, review account display names/host labels and crop private account chrome; no API-key/credential screens are evidence. Never add .env files, raw ACN sessions, Agent credentials/auth tokens or source-private manifests. Keep honest timestamps and synthetic labels; do not edit monitoring states to imply a transition.
