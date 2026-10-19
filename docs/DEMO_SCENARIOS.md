# Implemented synthetic demo scenarios

## Scenario A — Simulated overheating
- Baseline: five virtual chargers receive synthetic 8.25 A current and `CHARGING` state.
- Injection: the selected virtual charger receives synthetic 0 A, `FAULT`, and `temperatureC: 72` with `SYNTHETIC` field provenance. The 72 °C value is an illustrative stimulus, not a measured value or hardware safety threshold.
- Detect: the current `fault.simulated` Datadog monitor counts fault events; it does not evaluate a temperature threshold. Verify a live alert state directly in Datadog before claiming detection.
- Investigate: inspect synthetic temperature/current/state provenance and the incident/log timeline. The UI does not provide a measured temperature or power trend.
- Resolve: recovery inserts baseline synthetic telemetry and the operator records resolution. Temperature is unmeasured in recovery readings, not reset to a measured value.

## Scenario B — Unexpected charging power loss
- Injection: synthetic connector fault and zero current during an expected charging interval.
- Detect: the existing monitor counts explicit synthetic fault events. No measured power threshold or reliable missing-telemetry detector is implemented.
- Investigate: correlate event sequence, connector status and ingestion logs; distinguish device downtime from absent data.
- Resolve: simulated reconnect/repair; show recovered power and documented closure.

## Demo evidence checklist
- Timestamped observations and alert state
- Dataset source plus visibly labeled injected faults
- Measured end-to-end alert delay from test run
- Investigation queries/log views and operator action record
- Resolution and recovery verification

All operator actions are simulated and do not control live charging infrastructure.

The demo reset is scoped to the five virtual demo chargers and the `demo-station-01` synthetic incidents. It records baseline-reset actions for active incidents and emits five new synthetic baseline readings; it does not delete database records or alter unrelated station/charger data.
