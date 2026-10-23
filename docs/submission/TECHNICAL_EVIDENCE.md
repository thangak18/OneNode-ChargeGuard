# ChargeGuard | Technical evidence and declared boundaries

**Cut-off: 23 October 2026.** Evidence below is tied to committed implementation or dated verification, not newly acquired production measurements.

## Deployment and trust boundaries

```text
Public browser / authorized GitHub OAuth operator
            │ HTTPS
       Next.js on Vercel Hobby
       ├─ Public read-only operational UI
       └─ NextAuth / server-side BFF operator claims
            │ HTTPS / signed short-lived assertion / service policy
       NestJS on Render Free (Singapore preferred)
       ├─ Bounded reads and judge-run ownership validation
       ├─ Production mutations gated OFF (HTTP 403)
       └─ MongoDB official Node.js driver over TLS
            │
       MongoDB Atlas Free / chargeguard

SEPARATE VERIFIED LOCAL OBSERVABILITY PATH (env:dev, 19 Oct):
  Local NestJS → DogStatsD 127.0.0.1:8125 + sanitized JSON file
               → local Datadog macOS Agent → Datadog US1 dashboard/monitors/logs

Cloud app-scoped Datadog HTTPS path (env:prod): implemented/dry-run only, DISABLED.
Local ACN historical reader: offline local only; NEVER deployed or uploaded.
```

## MongoDB — implemented collections and indexes

From `apps/api/src/database/initialize.ts` and approved judge provisioning:

| Collection | Kind | Purpose / verified configuration |
| --- | --- | --- |
| `stations` | regular | Virtual station metadata |
| `chargers` | regular | Charger/connector assets; unique `(stationId, connectorId)` plus station/status lookup |
| `telemetry` | **time-series** | `timeField: ts`, `metaField: meta`, `granularity: seconds`, `expireAfterSeconds: 604800` (seven days); `meta.chargerId + ts` and `meta.stationId + ts` indexes |
| `incidents` | regular | Synthetic operational incidents; status/time and charger/time indexes |
| `incident_actions` | regular | Timestamped actions for original incident; incident/time index |
| `ingestion_receipts` | regular | Fingerprint-based idempotency recovery; `createdAt` TTL seven days |
| `judge_runs` | regular | Exactly one run, owned by server-verified operator, version/cycle, history, authorized run-scoped observations (separate from `telemetry`) |
| `judge_policy` | regular | Replay/nonce/quota records when actions are separately authorized; `_id_` and `expiresAt_ttl` on `{expiresAt:1}`, expiry `0` |

Original application has **six** collections; judge provisioning adds **two** separate collections. No new database resource was created to prepare this report.

## Actual MongoDB Aggregation Pipeline implementation

`apps/api/src/analytics/analytics.service.ts` has production code for these queries, with Zod-bounded time windows (default 24 h, max 31 days), `limit <= 500`, and required `chargerId` for current averages. The actual implemented **current average by time bucket** pipeline, expressed as a faithful readable excerpt:

```js
[
  { $match: { ts: { $gte: from, $lt: to },
              'meta.chargerId': chargerId, currentA: { $type: 'number' } } },
  { $group: {
      _id: { $dateTrunc: { date: '$ts', unit: 'minute', binSize: bucketMinutes } },
      averageCurrentA: { $avg: '$currentA' },
      samples: { $sum: 1 }
  } },
  { $sort: { _id: 1 } },
  { $limit: limit },
  { $project: { _id: 0, bucket: '$_id', averageCurrentA: 1, samples: 1 } }
]
```

This is an implementation excerpt **with symbolic user-validated query values**, not a transcript of a fresh Atlas query. Additional actual pipelines: `latest` (`$sort + $group/$first + $replaceRoot`), `states` (`$group + $sum`), `activity` (`$group + $max`) and station summary (`$group` by charger + `$avg/$sum/$max`). The service has exercised these paths in earlier regression suites; **no live numeric aggregation result was fetched while assembling the submission**. A judge seeking a numeric result should use an authorized read-only current query and record its timestamp; seven-day retention means historical results can expire. Do not manufacture a result from old readings.

## Datadog observation (19 October 2026; local `env:dev` only)

- Dashboard **ChargeGuard Operations Dashboard**, ID `875-kis-zg2` in Datadog US1.
- Fault monitor `334137944`, query `sum(last_1m):sum:chargeguard.fault.simulated{service:chargeguard-api,env:dev}.as_count() >= 1`.
- Ingestion-error monitor `334137536`, same one-minute counting scheme on `chargeguard.ingestion.failure`.
- Implemented/observed metric families: `chargeguard.ingestion.success`, `chargeguard.ingestion.failure`, `chargeguard.ingestion.processing_ms` (Agent histograms), `chargeguard.telemetry.accepted`, `chargeguard.telemetry.duplicate`, `chargeguard.charger.current_a`, `chargeguard.charger.operational_status`, `chargeguard.fault.simulated`.
- Structured, sanitized JSON log types include `demo.action` and `telemetry.accepted`, with bounded incident/run/charger correlation fields. The local Agent-forwarded logs were visible in Datadog US1 Logs Explorer.
- The already-existing Phase D synthetic incident was correlated with a real **ALERT → OK** monitor transition. Recorded observer detection ≈**166.33 s** is a polling-inclusive upper bound; recovery-to-monitor-OK ≈**8.53 s** uses monitor history timestamps and is not a precisely determined detection or repair latency.
- **Caution:** Datadog's one-minute fault-event count returning OK can reflect window expiry. The independent incident action and accepted recovery telemetry are what prove the software scenario's resolution; this is not proof of physical hardware recovery.
- Cloud `env:prod` Datadog intake has **never been verified**; `DD_CLOUD_ENABLED=false`. Do not combine the local monitor history with the cloud Judge Run as one event trace.

## Production Judge rehearsal (23 October 2026; no Datadog)

The operator-authenticated cycle 1 executed exactly four state changes `BASELINE → OPEN → ACKNOWLEDGED → RESOLVING → RESOLVED` and one separately approved re-arm into **cycle 2 BASELINE revision 5**. Exactly two run-scoped SYNTHETIC observations exist from cycle 1 (`0 A / FAULT`, `8.25 A / CHARGING`), with **zero** cycle 2 observations. At shutdown, **22/22** protected Judge and legacy mutation HTTP probes returned **403**. Existing six collection fingerprints and pinned Phase D incident remained unchanged at the dated readback. This is a previous verified result; it has not been re-executed while packaging.

## Security, reliability and impact

- GitHub OAuth authenticated operator with server-verified identity, scoped signed assertions, nonces/replay controls, MongoDB-backed quotas and optimistic revision checks; negative paths previously tested with disposable DBs. Production mutation gates disabled.
- Render Free may cold-start; prior single observed slow health request ≈22.42 s. Do not guarantee a service-level uptime or add keep-alive traffic.
- MongoDB time-series TTL/ingestion receipt TTL expire after seven days. Ingestion is not a transaction across receipts and time-series; ambiguous `PENDING` receipts may need reconciliation.
- Nonce/quota updates and incident state transitions are not committed in one cross-collection transaction. Quotas have a bounded fixed-window burst risk; Datadog events lack a durable outbox. These are disclosed engineering limits.
- Operational impact is **demonstrated workflow traceability**, with no validated claim of reduced commercial outage hours, mean time to repair or electricity consumption.

## Third-party, provenance and AI disclosure

- Primary tools/frameworks: Next.js, React, NestJS, MongoDB Node.js driver/Atlas, Datadog Agent/DogStatsD, Tailwind, Recharts, Lucide, Zod, Jest and other declared `package-lock.json` dependencies. Verify the final licenses before submission.
- ACN-Data / ACN-Data-Static: five files, five matching SHA-256 hashes, 20,228 original rows → 1,246 downsampled; **one observed source connector prefix**, not five proven distinct EVSEs. Local analysis only; cloud/public visualization and redistribution permissions unconfirmed. No raw source data here.
- Faults, operational current in Judge, timing of synthetic scenario and virtual device status are simulated; source ACN values are historical and separate.
- OpenAI Codex/ChatGPT assisted code, tests, debugging and presentation/documentation; existing project checklist also records owner-reported GitHub Copilot, Google Antigravity and Kiro. Confirm final personal AI tool inventory before form submission. Core scoring-period development and any reused pre-17-Oct code should be declared truthfully.

**Source files:** `docs/PRODUCTION_JUDGE_REHEARSAL.md`, `docs/PHASE_D_VERIFICATION.md`, `docs/DATADOG_PREPARATION.md`, `docs/HISTORICAL_LOCAL_MODE.md`, `docs/DATA_PROVENANCE.md`, `apps/api/src/database/initialize.ts`, `apps/api/src/analytics/analytics.service.ts`.
