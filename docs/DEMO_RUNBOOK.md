# ChargeGuard local demo runbook

ChargeGuard is a local virtual-charger demonstration. It does not actuate physical charging hardware. Keep both services bound to loopback; do not expose the web app or API to a LAN, tunnel, or public host. The BFF's local mutation boundary is not operator authentication.

## Prerequisites

- Node.js 24 LTS (the API engine range is `>=22.12 <25`) and npm.
- A private repository-root `.env` with the configured MongoDB Atlas URI, `MONGODB_DATABASE=chargeguard`, and an `INGEST_API_KEY` of at least 24 characters.
- A private `apps/web/.env.local` with `NEST_API_KEY` set to the same value as `INGEST_API_KEY`. Do not expose either value in the browser, logs, screenshots, or source control.
- Atlas network access already configured for the current environment. Do not disable TLS verification or broaden the Atlas IP allowlist to resolve connectivity issues.

## Start the services

If this is a fresh database only, initialize the schema and seed the five virtual chargers. These commands connect to MongoDB and change database state; do not rerun them against an unintended environment.

```bash
npm --prefix apps/api ci
npm --prefix apps/api run db:init
npm --prefix apps/api run db:seed
```

Start the API in one terminal:

```bash
npm --prefix apps/api run dev
```

Confirm readiness without printing configuration or credentials:

```bash
curl --fail http://127.0.0.1:3001/api/v1/health/ready
```

The expected response is `{"status":"ready","database":"connected"}`. If readiness fails, stop and resolve the database configuration/connectivity issue; do not proceed with a demo mutation.

Create `apps/web/.env.local` from `apps/web/.env.example` only if it does not already exist, then privately set `NEST_API_KEY` and, if necessary, `NEST_API_BASE_URL=http://127.0.0.1:3001`. Start the web app in another terminal:

```bash
npm --prefix apps/web ci
npm --prefix apps/web run dev
```

Open <http://127.0.0.1:3000>. The web development server and NestJS API bind to loopback.

## Read-only inspection

- `/` — operations overview and virtual fleet summary.
- `/chargers` — charger detail, telemetry provenance, and stale-data indication.
- `/incidents` — incident queue and persisted investigation timeline.
- `/demo` — synthetic incident controls.

These pages display persisted application data. Missing sensor values remain unmeasured; they are not inferred to be zero or normal. Datadog monitor IDs or historic evidence shown by the application do not prove that a monitor is currently connected or alerting.

## Optional synthetic lifecycle

**The following actions write synthetic telemetry and incident/action records to the configured database.** Confirm that the API points to the intended demo database and that these writes are approved before proceeding. They do not control physical chargers.

1. Open `/demo`, choose one of the `SIM_*` scenarios and a virtual charger, then select **Inject Synthetic Fault**.
2. Use **Acknowledge Alert** to record the investigation response.
3. Select **Send Recovery Telemetry**, then **Resolve Incident** to complete the incident lifecycle.
4. Confirm the incident and its action timeline on `/incidents`.
5. Before claiming live monitoring, independently verify the current Datadog US1 monitor state and event timestamps in Datadog. Historical alert/recovery measurements in [Datadog preparation](DATADOG_PREPARATION.md) are not a guarantee of current status.

`SIM_OVERHEAT` writes a 72 °C synthetic illustrative stimulus with explicit `SYNTHETIC` provenance; it is neither measured temperature nor a physical safety threshold. The Datadog monitor counts simulated fault events and does not test a temperature limit. Other fault scenarios write synthetic zero-current/FAULT events without a temperature value.

**Reset Baseline** is also a write operation. It affects only `demo-station-01`, its five named virtual chargers, and eligible active synthetic incidents belonging to that scope. It records `baseline_reset` audit actions and inserts five new synthetic baseline telemetry events; it does not delete telemetry, audit history, or unrelated station/charger records. The operation is safe to repeat after seven-day telemetry TTL expiration, provided the API is connected to the intended database. `db:seed` upserts charger metadata but is not itself a telemetry reset.

## Connectivity outage / offline fallback

- If Atlas is unavailable, `/api/v1/health/ready` fails and the UI should show a surfaced data-load error. Do not trigger mutations or describe a cached page as live. Restore Atlas connectivity, rerun the read-only readiness check, then use **Reset Baseline** to regenerate the five synthetic readings if TTL has expired.
- If Datadog or the local Agent is unavailable, the local UI/API and Atlas lifecycle may still run, but live metrics/log ingestion and monitor transitions are unverified. Keep the demonstration local, show the architecture and clearly dated historical captures if useful, and explicitly say the Datadog step is unavailable. Do not call an HTTP success a monitor ALERT/OK.
- For a fully offline engineering fallback, run the API integration suite: its isolated MongoDB fixture validates service behavior without touching Atlas. Present the UI/API walkthrough only when Atlas is reachable; otherwise use reviewed screenshots or a recording explicitly labeled with its original timestamp. The isolated integration tests do not prove live Atlas or Datadog operation.
- There is no local production-like persistence fallback or public demo mode. Do not point a public deployment at the local API or expose loopback services through a tunnel.

## Checks and shutdown

The automated tests use fixtures and do not require a demo lifecycle to be run against Atlas:

```bash
npm --prefix apps/api test
npm --prefix apps/api run test:integration
npm --prefix apps/api run typecheck
npm --prefix apps/api run build
npm --prefix apps/web run lint
npm --prefix apps/web test
cd apps/web
npx tsc --noEmit
npm run build
```

Stop each development server with `Ctrl+C`. Keep `.env`, `.env.local`, source datasets, logs, and generated credentials out of commits. No paid service or public deployment is part of this runbook.

## Resume the preserved Phase D incident (completed reference run)

The specific incident `demo-58a1983cae09` is now RESOLVED. Preserve it as evidence; do not try to reopen it or use Reset Baseline to erase its context. `npm --prefix apps/api run phase:d -- audit` securely rechecks it and extends the evidence audit history without changing Atlas.

During the authorized resumption, these commands used only existing protected APIs and the existing incident:

```bash
# Read-only preflight / scope and original telemetry validation:
npm --prefix apps/api run phase:d -- audit
# Only when this pinned incident is OPEN/ACKNOWLEDGED and a new signal is needed:
npm --prefix apps/api run phase:d -- pulse --execute --count 12
# Verify actual monitor ALERT before proceeding, then stop pulses:
npm --prefix apps/api run phase:d -- acknowledge --execute
npm --prefix apps/api run phase:d -- recover --execute
npm --prefix apps/api run phase:d -- resolve --execute
npm --prefix apps/api run phase:d -- audit-final
```

`pulse` is bounded to at most 30 requests at ten-second intervals, creates no incident and touches only charger 01 of the pinned run. It uses explicit SYNTHETIC provenance. Stop a running pulse helper before recovery (Ctrl+C in its terminal); run mutations serially so evidence writes do not race. These commands intentionally reject re-emission/recovery against the already RESOLVED incident. For a future rehearsal, use the existing `/demo` UI to create a new run only after the prior one is closed, and record that new ID separately; do not relabel the pinned evidence.

The lifecycle is now enforced server-side: acknowledgment precedes recovery, recovery affects only its incident's charger, and resolution requires successfully ingested recovery telemetry. A failed recovery remains RESOLVING without a completion marker; retry with the same incident ID to reuse its reserved timestamp/payload. HTTP retries preserve one logical audit action and one recovery reading. Invalid or out-of-scope identifiers are rejected. The UI hides resolution until recovery is accepted.

### Datadog observation and correlation

Open the [existing fault monitor](https://app.datadoghq.com/monitors/334137944), [dashboard](https://app.datadoghq.com/dashboard/875-kis-zg2) and [US1 logs](https://app.datadoghq.com/logs). Use current time ranges, `service:chargeguard-api env:dev`, and for this preserved run `@demo_id:58a1983cae09` (or `@incident_id:demo-58a1983cae09` after correlation instrumentation). Confirm the actual ALERT and OK timeline; the application's success copy is not that confirmation. Ingestion-error monitor 334137536 is separate and should not be claimed to alert for a fault-only scenario.

Plan for minutes of ingestion/evaluation and manual observation. Historical Phase B observer delays were about 145/197 s; the Phase D recorded detection upper bound was 166.33 s and history-based recovery approximately 8.53 s after the accepted recovery event. These are observations, not service-level guarantees. Count-window timestamps may align to intervals or differ from the client clock; preserve both source timestamps and observation timestamps. Missing event counts resolve to zero; no-data/heartbeat failure detection is not implemented.

If a one-shot pulse ages out before you investigate, its automatic OK does not close the incident. Resume with bounded, explicitly synthetic re-emissions for that same active incident, rather than creating duplicate incidents. If the Agent is unavailable, inspect its process/listener and ChargeGuard log integration; only the owner should run any required reviewed sudo restart command. Never copy its API key/auth token or disable TLS.

### Evidence and cleanup

Read [Phase D verification](PHASE_D_VERIFICATION.md) before recording. The JSON retains the original partial capture and appends the completed result. Keep same-run screenshots, actual log/monitor timestamps and direct Atlas action/readback evidence. No database records were deleted for cleanup; telemetry/receipt TTL handles retention, and the incident/actions remain auditable. Stop only helper/server processes you started. Do not delete unrelated records or run a global reset during a resumed incident. Keep raw ACN files local/ignored; the verified demo contains only synthetic input.
