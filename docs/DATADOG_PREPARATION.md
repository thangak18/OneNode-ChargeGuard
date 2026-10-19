# Datadog observability — integration and preparation history

**Current status (19 October 2026):** application metrics and structured JSON logs verified in US1; see the implementation and evidence section below. The next section preserves the original preparation snapshot.

## Preparation snapshot — 14 October 2026

**Status: PLANNED; no authenticated Datadog session, verified trial or integration.** All below is design only. Activation timing remains an owner task to keep any time-limited trial available during 17–31 Oct. Datadog links and supported plan features should be verified in the account once provisioned: https://www.datadoghq.com/ and https://docs.datadoghq.com/ .

## Proposed minimum demo dashboard

Display 5–10 virtual chargers with simulated state and historical/replayed `currentA` (source data after field verification). Panels to add during the build window: current by charger, source-data gap count, synthetic over-temperature, active incidents by severity/status, ingestion delay, and last recovery timestamp. Display labels `ACN historical replay`, `derived` and `synthetic` prominently. Power in kW only after voltage assumptions and formula are disclosed.

## Proposed monitor and evidence

**Primary monitor:** a deliberately synthetic `chargeguard.simulated_temperature_c` metric for one virtual charger exceeds an **illustrative demo threshold** (e.g., 65°C) for a defined window. The value and threshold are not hardware-safety data. Trigger a test alert during 17–31 Oct, record event time, monitor notification time and measured delay. A secondary simulated power-loss/absence alert is optional: distinguish **zero current** from **missing samples**, not conflating them.

Recommended future metric/log names: `chargeguard.charger.current_a`, `chargeguard.simulated_temperature_c`, `chargeguard.telemetry.replay_lag_seconds`, `chargeguard.incident.open`, `chargeguard.ingestion.error`; structured log keys `service`, `environment`, `station_id`, `charger_id`, `scenario`, `incident_id`, `timestamp`, `provenance_source_type`. Avoid high-cardinality user/session identifiers in metric tags; keep only sanitized trace links in logs.

## Security and timing

Never check in Datadog API/application keys. Keep secrets in local `.env` and later in secret storage on the server. Do not submit raw ACN data or user IDs in metric/log payloads. The actual monitoring account, free-trial activation, site/region, pricing and available monitors remain **UNVERIFIED**.

Owner action by 16 Oct: check the event/organizer email and Datadog account status, ask organizer if trial activation is missing, and activate a trial only when its duration safely covers the implementation/demo window. Obtain confirmation on trial start/end and free/charged features in the Datadog UI; do not authorize paid conversion without approval.

No Datadog library installation, key deployment, metric emission or monitor configuration is included in pre-hackathon preparation.

## Implemented integration and verified US1 results — 19 October 2026

This section supersedes the historical preparation-only status above. The NestJS Phase A backend exists and passes its automated tests. Phase B application instrumentation is now implemented; final dashboards and monitors remain planned. The authenticated US1 browser session displayed **14 days left in the existing trial**; no subscription, paid upgrade, extra host, APM activation or billing-setting change was made.

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

**Remaining blocker:** restore the existing Atlas transport path while retaining certificate validation. Privately check that the current egress address is still the already authorized exact Atlas IP, cluster readiness and hotspot/VPN routing; retry TLS on the approved network. The observed remote alert alone does not establish that IP allowlisting is the root cause. No automatic password reset, permission change or network-rule expansion is justified. Once transport works, rerun the Atlas smoke command. Final dashboards/monitors are still intentionally uncreated.
