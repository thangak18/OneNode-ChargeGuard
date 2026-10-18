# Architecture proposal (planning; not implemented)

## Services
- **Telemetry Replay / Fault Simulator:** replays historical charger readings with explicit event-time versus ingestion-time; injects labeled synthetic sensor/fault events.
- **TypeScript API/Worker (proposed NestJS):** validates telemetry, writes data, issues incident actions, emits Datadog logs/metrics.
- **MongoDB Atlas:** time-series telemetry plus ordinary collections for stations, chargers, incidents, incident_actions. Use Aggregation Pipeline for rolling power and station summaries.
- **Next.js UI:** station overview, connector detail, incident timeline; refresh via WebSocket or SSE if practical.
- **Datadog:** monitoring dashboard, metric/log monitor, correlated investigation logs; APM as stretch.

## Data model (draft)
```text
stations(_id, name, capacityKW, location?)
chargers(_id, stationId, connectorId, ratedPowerKW, status)
telemetry(ts, meta:{stationId,chargerId}, voltageV?, currentA?, powerKW?, temperatureC?, chargingState?, sourceChargingState?, sourceEnergyKWh?, provenance:{sourceType, sourceUrl?, syntheticFields?, derivedFields?}, ingestedAt)
incidents(_id, chargerId, scenario, severity, detectedAt, acknowledgedAt?, resolvedAt?, status, evidence)
incident_actions(_id, incidentId, actor, action, at, evidence)
```
Time-series options: `timeField: ts`, `metaField: meta`, appropriate granularity. Validate indexes and collection constraints during implementation; use regular collections for mutable incident state. Do not assume Change Streams can be used on time-series collections; design events via ordinary collections, logs or application notifications as needed.

## Demonstration flow
1. Replay normal historical session measurements.
2. Inject explicitly synthetic overheat or power-loss fault.
3. Observe Datadog monitor trigger (latency measured during test).
4. Investigate application logs and MongoDB aggregation evidence.
5. Simulate an operator response (not real charger actuation).
6. Verify recovery via fresh telemetry and close incident with evidence.

## Success criteria
Ingest 5–10 virtual connectors; achieve reproducible alerts for two faults; show one full Detect → Investigate → Resolve narrative with timestamps and traceable evidence. Do not claim physical device safety or real-time production guarantees.

Preparation audit 2026-10-18: collection naming aligned to `chargers` and `meta.chargerId` in the requested schema design. Services and stack unchanged. Static samples contain usable current, exported state and resetting energy; pilot/voltage/power are entirely missing. See [dataset analysis](DATASET_ANALYSIS.md) before selecting future transforms.
