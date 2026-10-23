# ChargeGuard local demo runbook

> **Current status, 23 October 2026:** Read-only cloud operation through Vercel → Render Free Singapore → Atlas was verified after the owner's explicit approval of the two shared CIDRs. Production writes remain 403; Datadog cloud and interactive demo are not verified. See [current deployment evidence and remaining gates](RENDER_MIGRATION.md). Earlier dated statements below describe historical/local stages and are superseded for cloud read-only status.

## Online read-only walkthrough

**Judge-run Phase 1 status (2026-10-23):** One owner-scoped synthetic `BASELINE` run `judge-4afc45f4427ab21f48d61c89` has been inserted in Atlas. Vercel/Render signing-secret provisioning was blocked before execution, so the authenticated `/judge` run selector cannot yet be validated in production. Do not present it as a completed interactive judge demo. `/judge` itself renders, but all lifecycle buttons remain disabled and all production POST calls remain 403. Complete the protected read-only environment setup and authenticated desktop/mobile walkthrough described in [the provisioning report](JUDGE_ONE_RUN_PROVISIONING_PLAN.md) before judge access is advertised.

1. Open https://chargeguard-web.vercel.app; allow bounded loading if Render is waking. If unavailable, wait the displayed retry interval and retry a read; do not run a keep-alive loop.
2. Overview: show five configured virtual assets and honest NO DATA/N/A when the 24-hour window is empty.
3. Chargers: inspect database-backed metadata and the unchanged source timestamps; no live physical measurements are claimed.
4. Incidents: select demo-58a1983cae09; show its four historical actions and RESOLVED state. The recorded Datadog correlation belongs to local env:dev verification.
5. Demo: explain SYNTHETIC labels and disabled controls. Do not reset baseline or trigger a new cloud incident.
6. /history is unavailable online. ACN analysis remains local-only and permission-gated; five sessions do not establish five physical chargers.
7. Operator /login supports GitHub login/logout; signing in does not authorize cloud writes. Before recording, review screenshots for credentials, identities and restricted records.

The following service-start and interactive steps apply only to the original loopback development demo.


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

## Optional private historical inspection

### Prepared authenticated judge console — future isolated workflow

After GitHub sign-in, `/judge` displays operator authorization, production read-only status and SYNTHETIC provenance. Until a separately authorized read setup and run exist, it shows no run/a 503 instead of substituting Phase D records. Once a run is legitimately present, select it and inspect stored charger, status, observed synthetic software samples and verified actor audit timeline. Fault, acknowledge, recover, resolve and reset remain disabled online with HTTP 403. Follow the [one-run approval plan](JUDGE_ONE_RUN_PROVISIONING_PLAN.md) before considering an interactive cloud test. Incident state, fault count, monitor ALERT/OK and synthetic recovery evidence are independent signals.

Use [Historical Local Mode](HISTORICAL_LOCAL_MODE.md) for the exact dry-run command and permission matrix. With Node 24 and the already-held ignored files, run `npm --prefix apps/api run historical:check`, then start the loopback web dev server with `CHARGEGUARD_HISTORICAL_LOCAL=true`. `/history` displays historical current/source state/energy and separately labels derived state and the mapped replay clock. Play/Pause/scrubbing never ingest data. No NestJS API, Atlas or Agent is required for this dedicated path.

The five sessions share one exported prefix, shown as one local EVSE alias; they are not five physical chargers. Missing sensor channels stay unavailable, and energy resets are not corrected into invented totals. Keep the view private while public-display/reuse permissions remain unconfirmed. Do not put source traces in the submission video or replay them into cloud telemetry. The existing `--execute` replay path is blocked until an owner-reviewed ignored permission record covers both third-party sinks and every selected content hash. Use SYNTHETIC operational pages for the verified public-facing incident narrative.

## Submission walkthrough selection

For a private owner inspection, follow the eight-step [historical walkthrough](HISTORICAL_LOCAL_MODE.md#private-walkthrough-checklist), including the five-session dry-run and two-clock comparison. For submission/video, use the [Vietnamese two-track storyboard](DEMO_VIDEO_STORYBOARD.md) and [presentation outline](PRESENTATION_OUTLINE.md). While source display permissions are pending, show only aggregate historical findings and the isolated architecture; no ACN plots or original rows leave the machine. Synthetic operational footage must be dated and labeled, and the preserved RESOLVED incident must not be reset for recording. Datadog originals need account/host masking and renewed privacy review before external use.

Recording, final slides, dataset permission, official judge accounts/access method, exact trial expiry and the final form remain owner actions. Review [judge access constraints](JUDGE_ACCESS_PLAN.md): the current private personal repository cannot offer read-only collaborator access. No judge invitation, public deployment or submission is part of this preparation.


## Online restricted preview — 2026-10-21

Open https://chargeguard-web.vercel.app. Explain the restricted-preview banner and synthetic operations scope. Overview, chargers, incidents, demo and login pages are HTTP-reachable. Data reads currently show database unavailability; do not narrate empty cards as successful live telemetry. Fault/acknowledge/recovery/resolve/reset controls are disabled in production. `/history` returns 404; the historical API returns 403. Use the existing local walkthrough for actual operations and preserve the pinned Phase D incident.

Before an online interactive recording, complete the secure Atlas egress decision, configure GitHub OAuth, implement/verify backend operator authorization and durable rate limiting, then agree a new synthetic test scope. Sign-in alone does not unlock writes. Do not rerun/reset the preserved incident to make the public preview appear functional. See [deployment and owner instructions](VERCEL_DEPLOYMENT.md).

## Repeatable Judge Console preparation — 23 October 2026

The latest preparation adds revision/cycle-bound requests, preserved cycle history and separately gated re-arm (`JUDGE_REARM_ENABLED`, default OFF). Fault is allowed only at BASELINE; re-arm only at RESOLVED. Earlier statements describing immediate fault from RESOLVED or empty JSON action bodies are superseded. The production run remains untouched; production write flags and cloud Datadog stay OFF. See [the current rehearsal and recording runbook](JUDGE_REPEATABLE_DEMO.md) for precise write scope, emergency handling, MongoDB aggregation and evidence limitations. Deployment/test evidence must be verified before claiming interactive or recording readiness.

### Controlled production rehearsal verified — 23 October 2026

The owner-authorized four-action lifecycle and one conditional re-arm passed actual browser → BFF → NestJS → Atlas verification. The existing run is cycle 2 BASELINE/revision 5; cycle 1 history is preserved. Production write/re-arm flags and Datadog cloud are OFF. The earlier preparation-only production status is superseded by [the verified rehearsal report](PRODUCTION_JUDGE_REHEARSAL.md). Another lifecycle or re-arm needs new owner approval.
