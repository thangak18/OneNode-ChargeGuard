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

1. Open `/demo`, choose one of the `SIM_*` scenarios and a virtual charger, then select **Trigger Synthetic Fault**.
2. Use **Acknowledge Alert** to record the investigation response.
3. Select **Send Recovery Telemetry**, then **Resolve Incident** to complete the incident lifecycle.
4. Confirm the incident and its action timeline on `/incidents`.
5. Before claiming live monitoring, independently verify the current Datadog US1 monitor state and event timestamps in Datadog. Historical alert/recovery measurements in [Datadog preparation](DATADOG_PREPARATION.md) are not a guarantee of current status.

**Reset Baseline** is also a write operation. It emits baseline telemetry; it does not delete the audit history. Avoid repeated triggers for an already-active incident unless testing idempotency intentionally.

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

Stop each development server with `Ctrl+C`. Keep `.env`, `.env.local`, source datasets, logs, and generated credentials out of commits.
