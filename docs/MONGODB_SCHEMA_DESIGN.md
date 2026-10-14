# ChargeGuard MongoDB data design (proposal; not created)

**Preparation on 2026-10-14; implementation begins no earlier than 2026-10-17.** Atlas database `chargeguard`, AWS Free/M0 if permitted. Type names below follow MongoDB BSON conventions. Object IDs may be app-stable strings for prototype simplicity; a consistent choice must be made during implementation.

## Existing architecture and naming reconciliation

`docs/ARCHITECTURE.md` currently calls the asset collection **`connectors`**. The requested preparation specification calls it **`chargers`**. This design proposes one **`chargers`** collection with a `connectorId` per virtual EVSE; a separate `connectors` collection should **not** be silently introduced as a duplicate. Freeze the chosen name when coding starts. No existing architecture documents have been overwritten during this preparation.

## Planned collections and fields

### 1. `stations` (ordinary collection)

| Field | BSON type | Meaning |
| --- | --- | --- |
| `_id` | string | Virtual station ID. |
| `name` | string | Demo station display name. |
| `capacityKW` | double, optional | Simulated/nameplate power limit, not measured by ACN. |
| `location` | object, optional | Generic city/site label; avoid source user geolocation. |
| `createdAt`, `updatedAt` | date | Metadata audit. |

Index: default `_id`. Optional `name` index only if a demonstrated query requires it.

### 2. `chargers` (ordinary collection; equivalent to EVSE/connector assets)

| Field | BSON type | Meaning |
| --- | --- | --- |
| `_id` | string | Virtual `chargerId` and stable metadata key. |
| `stationId` | string | Parent virtual station. |
| `connectorId` | string | Stable connector label where multiple outputs are simulated. |
| `ratedPowerKW` | double, optional | **Simulation/config** limit, no claim from measured ACN data. |
| `status` | enum string | Application-managed (`AVAILABLE`, `CHARGING`, `FAULT`, `OFFLINE`), **synthetic**. |
| `statusUpdatedAt` | date | Simulated status transition timestamp. |
| `createdAt`, `updatedAt` | date | Audit. |

Indexes: `{stationId:1,connectorId:1}` unique only if cardinality and naming are validated; `{status:1}` only if station overview needs it. Status is mutable in this ordinary collection.

### 3. `telemetry` (MongoDB Time Series)

**Proposed creation parameters (documentation only; no command executed):**

```javascript
// Proposed for development period 17–31 Oct (do not execute during preparation).
db.createCollection("telemetry", {
  timeseries: { timeField: "ts", metaField: "meta", granularity: "seconds" },
  expireAfterSeconds: 604800 // illustrative 7-day demo retention; confirm final policy
});
```

| Field | BSON type | Meaning |
| --- | --- | --- |
| `ts` | date | Replay/demo event timestamp; time-series `timeField`. |
| `meta` | object `{stationId:string,chargerId:string}` | Stable identity for bucketing; time-series `metaField`. |
| `sourceEventAt` | date, optional | Source historical event timestamp (distinct from `ts`). |
| `ingestedAt` | date | Future ingestion timestamp, for measured replay latency. |
| `sessionId` | string, optional | Pseudonymous ACN session reference. Kept outside `meta` to avoid changing the bucket key per session. |
| `currentA`, `pilotA` | double/null | Source currents if observed, with provenance. |
| `voltageV`, `powerKW` | double/null | Optional; derived/synthetic with explicit assumptions. |
| `temperatureC` | double/null | Synthetic fault demo signal. |
| `chargingState`, `faultCode` | string/null | Synthetic/inferred (never claimed ACN-measured). |
| `provenance` | object | Source type (`ACN_REPLAY`, `DERIVED`, `SYNTHETIC`), source URL, optional synthetic/derived field lists, transform version. |

Indexes: typical MongoDB-created clustered/time-series metadata+time index depends on server version. Evaluate `{'meta.stationId':1,'meta.chargerId':1,ts:-1}` for time-window requests and avoid unnecessary indexes on M0. No unique index on time-series measurements. Query recent readings via filters on `meta` and bounded `ts`; avoid cross-collection `$lookup` until measured need.

Limitations (official https://www.mongodb.com/docs/manual/core/timeseries/timeseries-limitations/): time-series collections **do not support change streams, unique indexes, ordinary schema validation rules, or arbitrary updates to measurements**; writes are append-oriented. Time-series creation parameters determine grouping; transaction writes are unsupported. Do not design Datadog notifications around watching this collection via Change Streams. Incident updates and notifications belong in normal collections/events/logs. TTL cleanup is not an SLA; it may lag expiry.

### 4. `incidents` (ordinary collection)

| Field | BSON type | Meaning |
| --- | --- | --- |
| `_id` | string | Synthetic/demo incident identifier. |
| `stationId`, `chargerId` | string | Virtual asset references. |
| `scenario` | enum/string | e.g. `SIM_OVERHEAT`, `SIM_POWER_LOSS`. |
| `severity` | enum/string | `INFO`, `WARNING`, `CRITICAL` (demo policy). |
| `status` | enum/string | `OPEN`, `ACKNOWLEDGED`, `RESOLVED`. |
| `detectedAt`, `acknowledgedAt`, `resolvedAt` | date/null | Lifecycle timestamps. |
| `evidence` | array<object> | References to sanitized telemetry time windows / logged monitors. |
| `createdAt`, `updatedAt` | date | Audit. |

Indexes: `{status:1,detectedAt:-1}` for incident queue; `{chargerId:1,detectedAt:-1}` for asset history.

### 5. `incident_actions` (ordinary append-only action audit)

| Field | BSON type | Meaning |
| --- | --- | --- |
| `_id` | string | Action identifier. |
| `incidentId` | string | Parent incident. |
| `actor` | string | Generic demo identity (`DEMO_OPERATOR`, `SYSTEM`); no source user IDs. |
| `action` | enum/string | `DETECTED`, `ACKNOWLEDGED`, `SIMULATED_REPAIR`, `RESOLVED`. |
| `at` | date | Action time. |
| `evidence` | object | Sanitized metadata/time/window pointers. |

Index: `{incidentId:1,at:1}` to render ordered timelines. Incident actions may require app-level idempotency; time-series ingestion should not manage incident state.

## Proposed Aggregation Pipelines (illustrative, not executed)

**A. Per-charger 1-minute mean observed current.** Safe to compute without making voltage assumptions.

```javascript
db.telemetry.aggregate([
  {$match: {'meta.chargerId': '<virtual-id>', ts: {$gte: ISODate('<start>'), $lt: ISODate('<end>')}, currentA: {$type: 'number'}}},
  {$group: {_id: {$dateTrunc: {date: '$ts', unit: 'minute'}}, avgCurrentA: {$avg: '$currentA'}, samples: {$sum: 1}}},
  {$sort: {_id: 1}}
]);
```

**B. Station-wide current summary for latest 5 minutes.** Do not add currents and label as kW.

```javascript
db.telemetry.aggregate([
  {$match: {'meta.stationId': '<virtual-station>', ts: {$gte: ISODate('<start>'), $lt: ISODate('<end>')}, currentA: {$type: 'number'}}},
  {$group: {_id: '$meta.chargerId', meanCurrentA: {$avg: '$currentA'}, lastTime: {$max: '$ts'}, samples: {$sum: 1}}},
  {$sort: {_id: 1}}
]);
```

**C. Incident timeline with action evidence** (ordinary collections, optionally `$lookup`):

```javascript
db.incidents.aggregate([
  {$match: {_id: '<incident-id>'}},
  {$lookup: {from: 'incident_actions', localField: '_id', foreignField: 'incidentId', as: 'actions'}},
  {$project: {scenario: 1, status: 1, detectedAt: 1, actions: 1}}
]);
```

Before running these in implementation, replace ISODate placeholders with real UTC values, inspect EXPLAIN plans and confirm performance within free tier. Do not run as code during preparation.

## Capacity budget for 5–10 simulated connectors

Assume **one document per connector every 60 seconds**, while active. 5–10 connectors × 1,440 minutes/day = **7,200–14,400 docs/day**, or **50,400–100,800 docs/week**. At an illustrative **200–700 bytes/document before MongoDB compression/index overhead**, that's approximately **10–71 MB/week**, plus indexes and ordinary collections; measured actual storage must be verified on deployment. At 5-second sampling, **86,400–172,800 docs/day**, likely too much for a small Free cluster over longer periods. Prefer 60-second cadence with short, labeled fault bursts, 7-day TTL (if permitted), and a small demo dataset. Free capacity/quotas must be checked against the current Atlas UI.

## Future application access pattern

After the build window starts, a server-side TypeScript worker/API authenticates to Atlas over TLS using a scoped `readWrite` service identity. It performs bounded `telemetry` inserts, range aggregations and separate incident/action writes; the Next.js UI calls the API and never gets Atlas credentials. Datadog receives sanitized app logs/metrics via a separately managed key. No application collections, live ingestion, dashboards or monitors were created during this preparation.

## Questions for 17 Oct

Choose `chargers` versus legacy `connectors` naming; verify exact source cadence and mapping from session to virtual charger; fix dataset usage rights; confirm Atlas database role permits collection/index operations in M0; adjust indexes/TTL after profiling. No synthetic measurement is described as a real charger observation.
