# ChargeGuard project status

**Updated:** 19 October 2026. This is a local development/demo application, not a production charger-control or safety system.

## Implemented

- **Phase A:** NestJS telemetry ingestion, bounded analytics, MongoDB time-series storage, provenance, and replay tooling.
- **Phase B:** opt-in DogStatsD instrumentation and sanitized JSON logs. Dated Datadog US1 dashboard/monitor and incident verification evidence is retained in [Datadog preparation](DATADOG_PREPARATION.md); current live account/monitor state was not rechecked during this validation.
- **Phase C:** Next.js overview, charger detail, incident queue/timeline, and demo control center; charger, station, incident, and synthetic demo endpoints.
- **Local BFF boundary:** explicit route/method allowlist, same-origin loopback-only development mutations, 8 KB body limit and schema validation, server-side API key, and mutation denial in production. This is not operator authentication; public or remote deployment is blocked.

## Validation recorded 19 October 2026

| Area | Result |
| --- | --- |
| API unit tests | 21 passed |
| API integration tests | 10 passed |
| API typecheck and build | Passed |
| Web lint and TypeScript check | Passed |
| Web BFF policy tests | 2 passed |
| Web production build | Passed |
| Browser routes `/`, `/chargers`, `/incidents`, `/demo` | HTTP 200 at 1440, 1024, 768, and 390 px; no horizontal document overflow |
| Live API readiness | `ready`, `database: connected` |
| Development BFF checks | Missing Origin: 403; invalid mutation body: 400; unsupported route: 404 |
| Direct API mutation without key | 401 |
| Production-build BFF mutation | 403, including a same-origin request |

Automated API integration tests use an isolated database fixture. Live checks during this validation were read-only; mutation probes were rejected before reaching the API, so no new incident or telemetry records were intentionally written. The readiness response confirms the running service's database connection at that time; it is not an independent audit of Atlas roles, certificates, or current account configuration. Earlier Atlas transport failures and successful verification runs remain timestamped in [the preparation report](PREPARATION_REPORT.md).

The host used Node.js 25.2.1 for these checks, while the API declares `>=22.12 <25`. The tests and builds passed, but repeat validation under Node 24 before release.

## Remaining gates and limitations

- Add real operator authentication and authorization, CSRF controls, and rate limiting before any remote deployment. Read APIs are not authenticated.
- Do not public-deploy this demo. The BFF production build blocks mutations but does not secure the unauthenticated read surface.
- Recheck current Datadog US1 connectivity, monitor state, and notification behavior before presenting live alert status. Historic incident timings are evidence from the recorded run, not an SLA.
- Resolve ACN dataset reuse/redistribution rights before replaying externally or packaging traces. Raw source data remains local and Git-ignored.
- All chargers are virtual. Historical and synthetic values are labeled; the application does not control physical equipment.
- No public deployment or hackathon submission has been made as part of this work.

See [the local demo runbook](DEMO_RUNBOOK.md) for setup and safe operator steps.
