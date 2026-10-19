# ChargeGuard
**Real-time EV Charging Station Monitoring & Incident Response**

**Team:** OneNode (solo) · **Event:** MUGVN Hackathon 2026 — IoT Monitoring System: Real-time Operations

> **Status (19 October 2026):** The existing Phase D incident `demo-58a1983cae09` completed its verified Atlas → Datadog ALERT → investigation → recovery → RESOLVED → monitor OK lifecycle. Node 24 checks pass: API 24 unit + 11 integration tests; web lint, two BFF policy tests, typecheck and production build. See [current verification](docs/PHASE_D_VERIFICATION.md). Video recording, final slide export and organizer form/access steps remain submission preparation. Keep the app loopback-only; the BFF is not operator authentication and rejects production mutations. Raw ACN redistribution remains unresolved.

## Problem
EV charging operators need to detect overload, device faults, and charging interruptions; investigate what happened; and respond with evidence that service has recovered.

## Proposed solution
ChargeGuard is a monitoring and incident-response prototype for EV charging stations:
1. Replay cited historical charging-session telemetry only after its reuse terms are verified; otherwise use synthetic telemetry.
2. Label and inject synthetic sensor signals and controlled failure scenarios.
3. Store and aggregate time-series data with **MongoDB**.
4. Visualize operational health and configure monitors with **Datadog**.
5. Demonstrate **Detect → Investigate → Resolve**, including an auditable incident timeline.

## Planned MVP (solo-developer scope)
- 5–10 *virtual* charging connectors (not physical chargers)
- Charging power/current and session timeline; temperature and fault codes clearly marked **synthetic**
- Station/connector dashboard with near-real-time updates
- Over-temperature (simulated) and unexpected power-loss scenarios
- A Datadog dashboard, at least one working monitor, and log-based investigation
- Recovery verification and a reproducible demo

**Non-goals for MVP:** real charger control, production integrations, a trained failure-prediction model, deployment to safety-critical equipment.

## Architecture
`Synthetic baseline or authorized local ACN replay → bounded adapter → NestJS API → MongoDB Atlas time-series + incidents → loopback Next.js dashboard/BFF`

The API includes charger views, incident lifecycle actions, and synthetic demo controls. Phase B instrumentation sends bounded DogStatsD metrics and sanitized JSON logs to the local Agent; current same-incident US1 proof is documented in the Phase D verification report. Only five virtual connectors are modeled; no physical charger data stream is connected.

See [Architecture](docs/ARCHITECTURE.md), [Project Status](docs/PROJECT_STATUS.md), [Local Demo Runbook](docs/DEMO_RUNBOOK.md), [Data Plan](docs/DATA_PLAN.md), [Build Plan](docs/BUILD_PLAN.md), [Demo Scenarios](docs/DEMO_SCENARIOS.md), and [Compliance](docs/COMPLIANCE.md).
See also the evidence-based [Submission Checklist](docs/SUBMISSION_CHECKLIST.md) for official criteria, unresolved verification gates, video/storyboard guidance, screenshot shots, and data/AI disclosures.

**Project evidence:** [Preparation and Atlas history](docs/PREPARATION_REPORT.md) · [Dataset analysis](docs/DATASET_ANALYSIS.md) · [Data dictionary](docs/DATA_DICTIONARY.md) · [Data provenance](docs/DATA_PROVENANCE.md) · [Atlas setup](docs/MONGODB_ATLAS_SETUP.md) · [MongoDB schema design](docs/MONGODB_SCHEMA_DESIGN.md) · [Datadog preparation](docs/DATADOG_PREPARATION.md). Five static sessions (20,228 source rows) were inspected locally; those raw files remain Git-ignored. The preparation report preserves earlier TLS failures; the current local API readiness result supersedes them only for the running application's connection check.

## Phase A local setup

Use **Node.js 24 LTS** (supported range `>=22.12 <25`) and npm. From the repository root:

```bash
nvm install 24
nvm use 24
npm --prefix apps/api ci
cp .env.example .env     # only if .env does not already exist; never overwrite real credentials
```

Edit the repository-root `.env` privately. Required: `MONGODB_URI` (Atlas `mongodb+srv://` with the existing scoped `chargeguard_dev` account), `MONGODB_DATABASE=chargeguard`, and a random `INGEST_API_KEY` **at least 24 characters** long. An optional `PORT` defaults to `3001`. On the previously diagnosed iPhone hotspot, SRV lookups in Node 24 returned `EBADRESP`; set `MONGODB_DNS_SERVERS=1.1.1.1,8.8.8.8` in your local process/environment only if that failure recurs. Do not disable TLS or open Atlas IP access broadly. No Datadog credentials are needed for Phase A.

```bash
npm --prefix apps/api run db:init       # repeatable: five domain/technical collections + telemetry time-series
npm --prefix apps/api run db:seed       # idempotent: one virtual station + five virtual connectors
npm --prefix apps/api run verify:atlas  # read-only checks of ping, role, schema, indexes and virtual assets
npm --prefix apps/api run dev
```

API base: `http://127.0.0.1:3001/api/v1`. Swagger: `http://127.0.0.1:3001/docs` (OpenAPI JSON: `/docs-json`). The ingestion key is sent as the `x-api-key` request header; do not put it in query strings or documentation. Read endpoints currently have no authentication: the API binds to loopback for local development. The browser BFF is also loopback-only for mutations and blocks all production mutations; this is not operator authentication. Add real authentication and authorization before any remote deployment.

### Implemented endpoints

| Method | Path (under `/api/v1`) | Purpose |
| --- | --- | --- |
| GET | `/health/live`, `/health/ready` | Process liveness and authenticated MongoDB readiness |
| POST | `/telemetry` | Validate and ingest one event, requiring `x-api-key` |
| POST | `/telemetry/batch` | Up to 100 events sequentially; partial progress on server failure |
| GET | `/telemetry/history?chargerId=...&from=...&to=...` | Bounded history, max 500 readings per request |
| GET | `/analytics/latest` | Latest reading by charger within a bounded range |
| GET | `/analytics/current-averages?chargerId=...&bucketMinutes=5` | Mean charging current by time bucket |
| GET | `/analytics/states` | Event-count distribution of derived charging states |
| GET | `/analytics/activity?windowMinutes=15` | Recent telemetry presence, not physical device health |
| GET | `/analytics/stations/:stationId/summary` | Virtual station/connector operational summary |
| GET | `/chargers`, `/chargers/:id` | Virtual charger list and detail |
| GET | `/stations` | Virtual station metadata |
| GET | `/incidents`, `/incidents/:id` | Incident queue and investigation evidence |
| POST | `/incidents/:id/acknowledge`, `/incidents/:id/resolve` | Append lifecycle actions and update incident state |
| POST | `/demo/trigger-fault`, `/demo/recover`, `/demo/reset` | Synthetic demo controls; these write telemetry and incident data |

Timestamp queries accept timezone-qualified ISO 8601 strings, with a maximum 31-day query span. Default lookback is 24 hours. Query limits and index-backed time ranges help protect the Atlas Free tier. API responses label source fields through `provenance` and use sanitized error messages.

### Reproducible replay and tests

```bash
npm --prefix apps/api run typecheck
npm --prefix apps/api run build
npm --prefix apps/api test
npm --prefix apps/api run test:integration
npm --prefix apps/api run replay:acn -- --max-events 15 --min-interval-seconds 60
```

Replay defaults to **dry-run**, reading the ignored local `data/raw/acn/sample_01.csv.gz`, validating bounded downsampled events without uploading source readings. Explicit `--execute --start-time <ISO-8601-with-timezone>` sends batches to a running local API **only after source reuse authorization is resolved**. The same session label, virtual asset, transform parameters and fixed replay start time must be retained across retries to satisfy idempotency fingerprints. All five source sessions originate from a convenience sample associated with the same source connector; mapping them to virtual assets does **not** establish five physical chargers. Current is source-measured; source state/energy are reported fields; application charging state is derived from current `>0.5 A` and disclosed. Voltage, power and temperature are omitted when unavailable; energy resets carry `ENERGY_COUNTER_DECREASE` flags.

MongoDB `telemetry` is a time-series collection with BSON `ts` and `meta.{stationId,chargerId}`; five regular collections hold assets, incidents, actions and unique `ingestion_receipts`. Both telemetry and receipts have seven-day retention. Receipt IDs and payload fingerprints prevent straightforward duplicate retries; an interrupted insert can leave a `PENDING` receipt that is reconciled from existing telemetry or requires operator review if unresolved. A batch is **not atomic**; retry the same event IDs with identical payloads. Receipts can expire, so this is a seven-day idempotency window, not permanent exactly-once delivery. This prototype is not a production billing or safety system.

## Datadog metrics and logs

Application instrumentation sends `chargeguard.*` metrics to the existing local Agent at `127.0.0.1:8125`: ingestion success/failure, request processing latency, current, one-hot reported charger status, simulated fault events and accepted/duplicate counts. Tags include `service:chargeguard-api`, `env:dev`, bounded provenance and only the five allowlisted virtual chargers. Arbitrary IDs never become metric tags.

Enable `DD_METRICS_ENABLED=true` in private `.env`; set `DD_ENV=dev` and `CHARGEGUARD_LOG_FILE=/usr/local/var/log/chargeguard/api.jsonl`. The application needs no Datadog API key. Install the narrow macOS Agent log configuration with `sudo /bin/sh scripts/observability/install-macos-agent-logs.sh`, then start the API normally. Sanitized JSON records go to stdout and the host log file; logs on the removable `/Volumes/Thang` checkout were blocked by macOS privacy controls.

**Historical verification on 19 October:** all metric families (including Agent-generated latency histogram names) and 23 application JSON logs appeared in US1. That HTTP smoke used a disposable local MongoDB database with explicitly synthetic readings after the Atlas TLS attempt in that run failed before authentication. A later local API readiness check returned `ready`; see [current project status](docs/PROJECT_STATUS.md) and the timestamped [preparation report](docs/PREPARATION_REPORT.md). To repeat the isolated smoke, use `npm --prefix apps/api run smoke:observability -- --execute --local-db`; omit `--local-db` only when intentionally retaining three synthetic test readings in Atlas. No raw ACN source data is sent by these tests.

See [Datadog configuration, metric meanings, evidence and limitations](docs/DATADOG_PREPARATION.md). Metrics/status are observations from accepted telemetry, not physical availability or guaranteed event accounting. Dashboard configuration, monitor definitions, and historical US1 evidence are documented; current Phase D alert and recovery are verified separately from historical Phase B screenshots. No paid-service activation was made.

## Dataset sources (raw sessions held locally, not uploaded)
- [ACN-Data (Caltech)](https://ev.caltech.edu/dataset)
- [ACN-Data Static](https://github.com/tongxin-li/ACN-Data-Static)

The final dataset subset, schema and usage permissions must be verified. Historic readings replayed live are **not** live measurements from real chargers. Synthetic values will carry provenance fields and be disclosed in the submission.

## Competition milestones (ICT / UTC+7)
| Date | Milestone |
|---|---|
| 14–16 Oct 2026 | Planning, architecture, dataset review, repository / issue setup |
| 17–31 Oct 2026 | Judged core implementation & Datadog trial |
| 31 Oct 2026, 23:59 | Submission deadline |
| 1–4 Nov 2026 | Preliminary evaluation (tentative) |
| 5 Nov 2026 | Top 8 announcement (tentative) |
| 8 Nov 2026 | Online final (tentative) |

## Submission checklist
- [ ] Problem statement and team details
- [ ] Architecture, MongoDB data model and Datadog observability design
- [ ] Source repo and reproducible README instructions
- [ ] Working / accessible MVP, video and presentation slides
- [ ] Detect → Investigate → Resolve incident walkthrough
- [ ] Disclosure of external datasets, reused code and AI assistance
- [ ] Judge access for private repository as instructed by organizers

## Security and transparency
Never commit credentials, connection strings, customer/production data, personal information or secrets. Keep `.env` local; use placeholders and secret management in the build phase. Distinguish measured source data, derived fields and synthetic faults in code and demo.

**Official rules:** https://mini-hackathon-sep-2026.mugvn.com/terms
