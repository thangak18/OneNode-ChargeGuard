# Demo scenario designs (not implemented)

## Scenario A — Simulated overheating
- Baseline: historical ACN electrical telemetry replay.
- Injection: synthetic temperature exceeds a *demo-configured* threshold (not a certified hardware safety threshold).
- Detect: Datadog metric/log monitor fires; log links to connector, event and incident.
- Investigate: chart temperature against power/current, inspect event provenance, compare timeline.
- Resolve: operator records a **simulated pause** and resets synthetic temperature; verify readings return within threshold and close incident.

## Scenario B — Unexpected charging power loss
- Injection: synthetic connector failure or zero delivered current during an expected charging interval.
- Detect: missing/low power condition persists for configured window.
- Investigate: correlate event sequence, connector status and ingestion logs; distinguish device downtime from absent data.
- Resolve: simulated reconnect/repair; show recovered power and documented closure.

## Demo evidence checklist
- Timestamped observations and alert state
- Dataset source plus visibly labeled injected faults
- Measured end-to-end alert delay from test run
- Investigation queries/log views and operator action record
- Resolution and recovery verification

All operator actions are simulated and do not control live charging infrastructure.
