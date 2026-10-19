# Datadog observability — integration and preparation history

**Status note (19 October 2026):** The implementation and verification records below include timestamped evidence from Datadog US1 and MongoDB Atlas. They describe the state observed during those runs; live Datadog account, monitor, and notification state was not rechecked during the latest local UI validation. The next section preserves the original preparation snapshot.

## Preparation snapshot — 14 October 2026

**Status: PLANNED; no authenticated Datadog session, verified trial or integration.** All below is design only. Activation timing remains an owner task to keep any time-limited trial available during 17–31 Oct. Datadog links and supported plan features should be verified in the account once provisioned: https://www.datadoghq.com/ and https://docs.datadoghq.com/ .

## Historical dashboard proposal — superseded by implementation

Display 5–10 virtual chargers with simulated state and historical/replayed `currentA` (source data after field verification). Panels to add during the build window: current by charger, source-data gap count, synthetic over-temperature, active incidents by severity/status, ingestion delay, and last recovery timestamp. Display labels `ACN historical replay`, `derived` and `synthetic` prominently. Power in kW only after voltage assumptions and formula are disclosed.

## Historical monitor proposal — not implemented

This proposal predates the Phase B instrumentation and is preserved only as design history. The implementation does **not** emit `chargeguard.simulated_temperature_c` and no monitor evaluates a temperature threshold. The actual bounded metric set and deployed monitor queries are documented in the implementation section below; those monitors count ingestion errors and synthetic fault events.

The earlier idea was to test an illustrative synthetic temperature threshold, while keeping zero-current observations distinct from missing samples. Do not cite this proposal as implemented behavior.

Recommended future metric/log names in that original proposal were not all implemented. Refer to the implementation metric table later in this document for the actual metric names, types and semantics.

## Security and timing

Never check in Datadog API/application keys. Keep secrets in local `.env` and later in secret storage on the server. Do not submit raw ACN data or user IDs in metric/log payloads. The actual monitoring account, free-trial activation, site/region, pricing and available monitors remain **UNVERIFIED**.

Owner action by 16 Oct: check the event/organizer email and Datadog account status, ask organizer if trial activation is missing, and activate a trial only when its duration safely covers the implementation/demo window. Obtain confirmation on trial start/end and free/charged features in the Datadog UI; do not authorize paid conversion without approval.

No Datadog library installation, key deployment, metric emission or monitor configuration is included in pre-hackathon preparation.

## Implemented integration and verified US1 results — 19 October 2026

This section supersedes the historical preparation-only status above. The NestJS Phase A backend and Phase B application instrumentation are implemented. The dashboard configuration, monitor definitions, and dated US1 verification evidence are recorded below. The authenticated US1 browser session displayed **14 days left in the existing trial** at the time; no subscription, paid upgrade, extra host, APM activation or billing-setting change was made.

### Application configuration

Select Node 24 LTS and install the locked backend dependencies. In the private root `.env`, keep the existing MongoDB settings and a private `INGEST_API_KEY` of at least 24 characters. The local key was missing during the audit and was generated privately; its value was never printed. Add:

```dotenv
DD_METRICS_ENABLED=true
DD_AGENT_HOST=127.0.0.1
DD_DOGSTATSD_PORT=8125
DD_ENV=dev
CHARGEGUARD_LOG_FILE=/usr/local/var/log/chargeguard/api.jsonl
```

Metrics are opt-in (`false` by default); the destination is constrained to loopback, with UDP 8125 default. `DD_ENV` is limited to `dev`, `test`, `staging` or `prod`. The application sends DogStatsD datagrams through Node's UDP socket and **does not read or need the Agent's Datadog API key**. The Agent retains its existing US1 credentials and sends onward using its normal secure transport. The application uses the documented [DogStatsD datagram protocol](https://docs.datadoghq.com/extend/dogstatsd/datagram_shell/).

### Metrics and semantics

Every metric includes `service:chargeguard-api` and `env:dev` (or the configured bounded environment).

| Metric | DogStatsD type | Meaning |
| --- | --- | --- |
| `chargeguard.ingestion.success` | count | Successful ingestion HTTP responses, including successful retries; a batch is one request |
| `chargeguard.ingestion.failure` | count | Failed ingestion HTTP responses, including missing key, invalid schema and database errors |
| `chargeguard.ingestion.processing_ms` | timer | Middleware-to-response latency in milliseconds, including asset/receipt/database work; also records rejected requests |
| `chargeguard.telemetry.accepted` | count | Newly acknowledged persisted telemetry events, one per accepted event in a batch |
| `chargeguard.telemetry.duplicate` | count | Successfully recognized duplicate event retries |
| `chargeguard.charger.current_a` | gauge | Last accepted current observation in amperes, tagged by provenance source/origin |
| `chargeguard.charger.operational_status` | gauge | One-hot set of six reported application states; processing each reading sets the current state to 1 and the other five to 0 |
| `chargeguard.fault.simulated` | count | New accepted events with an explicitly SYNTHETIC fault state or faultCode; one increment even if both occur |

The Agent expands the latency timer into histogram series. Actual US1 names observed: `.avg`, `.count`, `.max`, `.median` and `.95percentile` under `chargeguard.ingestion.processing_ms`. These use milliseconds. See [Datadog metric types](https://docs.datadoghq.com/metrics/types/). Counters are received as interval rates; use `.as_count()` in count queries. Histogram percentiles are Agent-local summaries and should not be treated as globally aggregated latency percentiles.

Request tags are bounded `mode:single|batch`, `status_class:2xx|4xx|5xx`, plus latency `outcome:success|failure`. Measurement source/origin is limited by the telemetry schema. Only the fixed pair `demo-station-01` / one of `demo-charger-01` through `demo-charger-05` receives ID tags. All other identifiers collapse to `asset_scope:other`; arbitrary incoming IDs, timestamps, event/session IDs, source URLs and fault codes never become metric tags. Gauge collisions are possible in that aggregate `other` category, so it is unsuitable for per-device interpretation outside the five-connector demo. Even with bounded tags, these metrics consume the account's existing custom-metric allocation; no paid plan was enabled.

Operational status is the state carried by the last processed reading, not physical availability, a heartbeat or an automatic stale/offline detector. A historical late-arriving reading can replace the gauge; use the MongoDB bounded latest aggregation for authoritative event-time ordering. No current/state/fault measurement is emitted again for a duplicate. UDP and process crashes can lose metrics; monitoring counters are not authoritative accounting. An ambiguous receipt recovery can also prevent a new-event metric despite a stored reading.

### Structured JSON logs and macOS Agent forwarding

`ObservabilityService` writes one-line JSON to stdout and, when configured, to the absolute log path above. Logs include timestamp, service, env, event name, numeric status/duration and allowlisted mode/outcome/provenance fields. The framework logger maps fixed operational messages and intentionally omits arbitrary Nest messages, exception strings and stack traces. Request bodies, headers, API keys, connection strings, raw dataset rows and user/session IDs are not serialized. This prioritizes safe operational event logs; deeper debugging requires sanitized local investigation. The log file rotates at 5 MiB with one backup; ensure file/directory permissions let the app write and the Agent read. JSON fields are allowlisted, so this host log file is readable to the Agent without containing secrets.

Run the prepared narrow installer once from Terminal:

```bash
sudo /bin/sh scripts/observability/install-macos-agent-logs.sh
```

It creates `/usr/local/var/log/chargeguard`, installs `config/datadog/chargeguard.conf.yaml` semantics into `/opt/datadog-agent/etc/conf.d/chargeguard.d/conf.yaml`, enables `logs_enabled`, preserves a private pre-change Agent configuration backup, and restarts `system/com.datadoghq.agent`. It neither prints nor modifies API keys, intake site, network policy or billing. The owner completed these privileged steps during verification because this execution session cannot use passwordless sudo.

The first attempt to read an ignored log file under the repository on `/Volumes/Thang` failed with macOS **operation not permitted** in the Agent tailer. Moving the application log destination to the standard host log directory resolved the error. No Full Disk Access or security bypass was enabled. Do not change the path back to the removable-volume checkout.

To undo ChargeGuard collection, remove only its `conf.d/chargeguard.d/conf.yaml` integration and restart the Agent. If restoring the original `datadog.yaml` from its local private backup, first ensure that it does not overwrite unrelated later Agent configuration. Never copy this backup into Git because it contains Agent credentials.

### Verification evidence (19 Oct, approximately 09:09–09:16 ICT)

- Typecheck/build passed with Node 24 LTS. **14 unit tests and 9 integration tests passed**, including a bound UDP receiver (actual DogStatsD packet types/tags), redaction/allowlist checks, bounded assets, distinguishing reported faults from synthetic faults, and HTTP guard/schema/database failure instrumentation.
- Real Atlas-backed application smoke was attempted but stopped before HTTP readiness or writes: SRV DNS resolved three nodes and TCP 27017 succeeded for all three, while all three verified TLS attempts received `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`. Authentication was **not reached** in this run. The 18 October successful Atlas checks remain historical evidence and do not prove current connectivity.
- To verify the observability path independently, the actual NestJS modules were exercised over HTTP using a **disposable local MongoDB 8.0.16** and the official MongoDB driver. Two successful smoke runs each used three explicitly synthetic events (current, simulated fault, recovery), one identical retry and two intentional failures (401 without key, 400 invalid current). No raw ACN data or existing Atlas records were modified by this verification. The local fixture database was cleaned up afterward.
- The authenticated **Datadog US1 Metrics Summary** displayed all requested application families: success, failure, current, operational status, simulated fault, accepted/duplicate counts and all five latency histogram names. The summary showed 13 `chargeguard.*` names: 12 application series names plus the owner's earlier `chargeguard.setup_check`.
- Current metric details showed `service:chargeguard-api`, `env:dev`, `source:synthetic`, `origin:synthetic`, `station_id:demo-station-01` and `charger_id:demo-charger-01`. The application does not tag account/host identifiers; the Agent adds its normal host context.
- **US1 Log Explorer displayed 23 ChargeGuard log records from the host log file**, including `ingestion.request`, `telemetry.accepted`, `framework.log` and `fault.simulated`. The inspected fault record was timestamped `2026-10-19T02:12:49.008Z` (09:12:49.008 ICT), with parsed `env=dev`, `source=synthetic`, `status=warning`, `asset_scope=demo`, service `chargeguard-api` and Agent source `nodejs`.

Repeat the opt-in synthetic HTTP smoke (with Node 24 active):

```bash
# Independent end-to-end app → Agent → US1 verification, using a disposable local DB:
npm --prefix apps/api run smoke:observability -- --execute --local-db
# After restoring Atlas connectivity, verify using the actual configured Atlas database:
npm --prefix apps/api run smoke:observability -- --execute
```

The Atlas variant retains three labeled synthetic samples under the telemetry TTL; run only when that write is intended. The local variant uses a test database only and never changes Atlas data. Socket-send success alone is not proof of Datadog intake: inspect the real [US1 Metrics Summary](https://app.datadoghq.com/metric/summary) and [US1 Log Explorer](https://app.datadoghq.com/logs), filtering for service `chargeguard-api` and env `dev` in the current time range.

### Phase B.2 Operations Dashboard & Monitors Verification (19 Oct, 09:24–09:45 ICT)

Phase B.2 dashboard and monitor verification is **COMPLETE**.

#### 1. Operations Dashboard
- **Artifact:** `config/datadog/chargeguard-operations.dashboard.json`
- **Widgets (11 total):**
  1. Informational Note: Virtual chargers; synthetic faults/replay; no physical safety thresholds.
  2. Ingestion requests: success / failure (counts).
  3. Ingestion failure rate (%) — formula: `100 * failure / (success + failure)`.
  4. Ingestion processing latency (ms, Agent summaries: avg, 95percentile).
  5. Charging current (A) by virtual charger / provenance.
  6–10. Virtual chargers 01 through 05: observed operational state (one-hot gauge series).
  11. Explicit synthetic fault events (counts).
- **Design hygiene:** Uses only implemented metrics under `chargeguard.*`, tags `service:chargeguard-api`, `env:dev`, bounded charger IDs (`demo-charger-01` … `05`), and empty notification list (`notify_list: []`).
- **Evidence Screenshot:** `docs/evidence/operations-dashboard.png`

#### 2. Datadog Monitors in US1
Two demo monitors were created and verified in Datadog US1:
1. **Ingestion Errors Monitor** (`config/datadog/monitors/ingestion-errors.json`):
   - **Monitor ID in US1:** `334137536`
   - **Query:** `sum(last_1m):sum:chargeguard.ingestion.failure{service:chargeguard-api,env:dev}.as_count() >= 1`
   - **Threshold:** Critical >= 1 count in 1-minute evaluation window.
   - **No-data policy:** Default (no spurious alerts on missing data; heartbeat monitor intentionally omitted).
2. **Synthetic Fault Events Monitor** (`config/datadog/monitors/synthetic-faults.json`):
   - **Monitor ID in US1:** `334137944`
   - **Query:** `sum(last_1m):sum:chargeguard.fault.simulated{service:chargeguard-api,env:dev}.as_count() >= 1`
   - **Threshold:** Critical >= 1 count in 1-minute evaluation window.

#### 3. End-to-End Incident Verification Run (`c8d1586804b5`)
An authenticated end-to-end incident test was executed using `npm --prefix apps/api run demo:incident -- --execute` connected to the actual MongoDB Atlas cluster:
- **Incident Run ID:** `c8d1586804b5`
- **Baseline Start:** `2026-10-19T02:29:36.847Z` (09:29:36 ICT) — 5 virtual chargers emitting normal charging telemetry (8.25 A, state CHARGING). Initial monitor states verified `OK` (`334137536` & `334137944` at 02:29:56.419Z).
- **Fault Injected:** `2026-10-19T02:29:56.472Z` (09:29:56 ICT) — charger `demo-charger-01` injected with synthetic fault (`currentA = 0`, `chargingState = 'FAULT'`, `faultCode = 'SIMULATED_DEMO_FAULT'`) plus controlled validation failure (`currentA = -1`).
- **Alert Triggered (DETECT):** Observed at `2026-10-19T02:32:21.943Z` (09:32:21 ICT). Both monitors `334137536` and `334137944` transitioned to **ALERT**.
  - Measured detection latency: ~145 seconds (accounting for 1m rolling evaluation window + UI evaluation cadence).
  - Evidence Screenshots: `docs/evidence/ingestion-alert.png`, `docs/evidence/synthetic-fault-alert.png`.
- **Operator Response (INVESTIGATE):**
  - `2026-10-19T02:32:22.024Z`: Simulated operator investigated Atlas telemetry (`demo-charger-01`, state FAULT, current 0 A).
  - Structured logs recorded `demo.action` event with `demo_id=c8d1586804b5`, `action=investigate`.
- **Recovery Requested:** `2026-10-19T02:32:39.318Z` — Fault injection halted, valid charging telemetry restored (8.25 A, CHARGING). Incident marked `RESOLVING`.
- **Alert Cleared (RESOLVE):** Observed at `2026-10-19T02:35:56.974Z` (09:35:56 ICT). Both monitors returned to **OK**.
  - Measured recovery latency: ~197 seconds after recovery requested (allowing the 1-minute count window to clear).
  - Evidence Screenshots: `docs/evidence/ingestion-recovered.png`, `docs/evidence/synthetic-fault-recovered.png`.
- **Incident Closed:** `2026-10-19T02:35:57.069Z` — Incident marked `RESOLVED` in MongoDB Atlas.
- **Atlas Data Verification (02:36:59Z):**
  - Incident record `demo-c8d1586804b5`: status `RESOLVED`, synthetic `true`.
  - 6 audit actions recorded in `incident_actions`: `baseline`, `fault_injected`, `investigate`, `recovery_requested`, `resolved`, `investigate`.
  - 335 time-series telemetry readings recorded.
- **Machine-readable evidence:** Saved in `docs/evidence/phase-b2-incident.json`.

#### 4. Atlas Transport & Authentication Status
Real Atlas connectivity is **FULLY RESTORED AND VERIFIED**:
- DNS SRV: PASS (3 nodes)
- TCP 27017: PASS (all 3 nodes)
- TLS Handshake: PASS with strict certificate verification (`PASS_CERT_VERIFIED` on all 3 nodes)
- Authenticated ping: PASS
- Scoped application user `chargeguard_dev` / `chargeguard_rw`: PASS
- Database reads and time-series writes: PASS

All Phase B requirements are satisfied. Ready to proceed to Phase C (Operations UI).

## Current Phase D proof — resumed original incident

The earlier Phase D access/Agent blocker is superseded by the completed 19 October resumption. The Agent process, UDP 8125 listener and actual US1 intake were verified. Existing monitor `334137944` retained its one-minute sum, critical >=1, evaluation delay 0, no full-window requirement, Evaluate-as-0 missing-data behavior and no recipients. No monitor or notification configuration was changed.

Original incident `demo-58a1983cae09` already had a history ALERT at 12:23:44 ICT, approximately 49 seconds after its initial synthetic input; its 12:24:44 automatic OK was merely count expiry. Twelve controlled re-emissions on that same charger enabled a current verified sequence: ALERT history at 13:47:44; acknowledgment at 13:50:34.941; accepted one-charger recovery at 13:50:35.474; API resolution at 13:50:36.213; monitor OK history at 13:50:44. Observer-confirmed detection upper bound was 166.33 s; reported-history recovery was approximately 8.53 s. The alert timeline predates the first re-emitted source timestamp by 2.684 s, so exact internal detection latency cannot be established (possible aggregation alignment or clock skew).

US1 search `service:chargeguard-api env:dev @demo_id:58a1983cae09` returned original injection, new fault/current ingestion and all lifecycle action logs with validated incident context. Resolved log timestamp: 06:50:36.305Z. See [complete evidence](PHASE_D_VERIFICATION.md), [machine-readable record](evidence/phase-d-e2e.json), [same-run Alert](evidence/phase-d-fault-alert.png), [OK](evidence/phase-d-fault-recovered.png) and [correlated fault log](evidence/phase-d-correlated-fault-log.png). Phase B screenshots remain historical.

The account banner displayed 14 trial days left; no exact expiry or final-round coverage guarantee was established. Archive these dated observations and obtain any organizer extension confirmation before the tentative November final. No paid conversion, recipients, dashboards or duplicate monitors were added during Phase D.
