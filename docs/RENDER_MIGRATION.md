# Render Free migration — preparation and Atlas approval gate

Date: 2026-10-21 (Asia/Ho_Chi_Minh). Starting code: `12f2e84`.

Owner-selected target: existing Next.js/GitHub OAuth on Vercel Hobby, NestJS on a Render Free Node web service in Singapore, existing Atlas Free cluster, total new paid services $0. No Atlas network entry may change before a separate approval of the actual service CIDRs.

## Prepared runtime

`config/runtime.ts` recognizes only the official `VERCEL=1` or `RENDER=true` provider flags. Hosted processes bind once on `0.0.0.0` and provider `PORT`; local development retains `127.0.0.1`. Hosted startup does not wait for an unavailable database: authenticated reads/readiness perform the existing coalesced connection checks. The database URI and least-privilege account, schemas, collections, indexes, seed behavior, URLs and original Phase D evidence are unchanged. No init/seed/fault/recovery/reset command is in a build or start hook.

Production middleware remains independently read-only, including when the Render flag is present but NODE_ENV is misconfigured. Hosted configuration requires NODE_ENV=production. All mutations return 403 before controllers. Existing API reads, readiness and diagnostics require the server-only read key; Swagger stays hidden and credentialed wildcard CORS stays disabled. The sole Render-only public GET/HEAD exception is `/healthz`, which returns only `{"status":"ok"}` without database access. POST `/healthz` is denied. Platform health does not prove database readiness.

Hosted runtimes do not read the repository `.env`, use local DogStatsD, or write macOS log paths. Sanitized JSON stdout is retained; `DD_ENV=prod` is separate from local `env:dev`. No Datadog key has been copied or cloud forwarding enabled.

## Reproducible service settings

`render.yaml` is an explicit Free-only Blueprint, validated by the official Render CLI/API before deployment. It creates no database, disk, worker, cron, paid networking or seed hook.

| Setting | Value |
| --- | --- |
| Name | chargeguard-api |
| Source | Existing private thangak18/OneNode-ChargeGuard, main |
| Root | apps/api |
| Runtime | Node 24.x; NODE_VERSION 24.22.0 |
| Plan / region | Free / Singapore |
| Build | npm ci --include=dev && npm run build && npm prune --omit=dev |
| Start | npm start |
| Platform health | /healthz |
| Automatic deployments | Off during migration and approval gate |

Server-only variables: MONGODB_URI, MONGODB_DATABASE, INGEST_API_KEY, BFF_READ_API_KEY. Nonsecret runtime configuration: NODE_ENV=production, NODE_VERSION, MONGOMS_DISABLE_POSTINSTALL=true, DD_ENV=prod, DD_METRICS_ENABLED=false. Render supplies RENDER=true and PORT. Do not copy the whole local .env: it may contain local-only settings. No CHARGEGUARD_LOG_FILE, Datadog API key, historical source file, local manifest or local ACN permission file is part of the deployment. Secrets must be sent only to the authorized Render account over its official HTTPS API and never placed in CLI arguments, Git, logs or browser code.

The existing Vercel NEST_API_BASE_URL and read credential remain unchanged until Atlas approval and successful Render readiness/reads. GitHub OAuth configuration and cookie/session code are untouched.

## Budget and platform limits

Official sources checked on 2026-10-21:

- [Render Free](https://render.com/docs/free): sleeps after 15 idle minutes, approximately one minute to wake; ephemeral files; 750 free instance hours shared per workspace each month. Build/bandwidth limits also apply. Without a payment method, exhaustion suspends service/builds rather than charging supplementary usage. No card or paid feature is added for this task.
- [Region availability](https://render.com/docs/regions): Singapore is supported; service region cannot later be changed in place.
- [Outbound networking](https://render.com/docs/outbound-ip-addresses): service may use any address in its assigned regional ranges, shared with other services. Do not substitute one transient reflected IP for the documented ranges.
- [Dedicated IPs](https://render.com/docs/dedicated-ips): paid workspace/add-on, outside this budget. Free does not provide an exclusive egress guarantee.
- [Render health checks](https://render.com/docs/health-checks): platform liveness is deliberately separate from service-key-protected MongoDB readiness.

Actual service URL, plan, source SHA, assigned outbound CIDRs and mathematical address counts must be recorded after creation. Proposed Atlas changes are additive only unless the owner explicitly chooses otherwise: retain existing entries, add only the individually approved Render ranges, never an all-address range. Sharing a range with unrelated tenants increases network trust compared with a private application's /32; TLS and database credentials are still mandatory. The approval gate must include these actual facts rather than guessed regional addresses.

## Cold-start plan — not yet a live verification

The current BFF remains at a 20-second timeout before the Atlas decision. The actual Vercel web project has Fluid Compute enabled. [Vercel documents a 300-second Hobby Fluid maximum](https://vercel.com/docs/functions/limitations), so a future 120-second route limit and an approximately 85-second read timeout can fit a normal Render wake-up plus database connection time. Confirm the effective setting during Phase 3 deployment.

Implement only after the network decision: longer budget for idempotent reads, request cancellation, sanitized warming/unavailable response with Retry-After, no HTML loading-page response misclassified as JSON data, no automatic retry for writes, and no overlapping client polls while a long read is in progress. Poll only for an actively viewed application; do not create a cron, monitor ping or hidden-tab loop to defeat idle suspension. Test with a controlled delayed fixture and an actual idle Render instance. Synthetic fixtures do not prove the real wake-up duration. No cold-start timing success is claimed at the approval gate.

Existing synthetic telemetry may be older than the UI's 24-hour default window. Do not rewrite timestamps or seed new records to make it appear live. After permission, use explicitly bounded reads and honest stale/no-data labels; keep historical ACN local and the pinned Phase D incident unchanged.

## Remaining interactive authorization work

Cloud writes stay denied until all of these are implemented/tested: backend verification of an authenticated operator identity independent of browser UI; explicit operation/resource scope; short-lived, audience-bound identity propagation; origin/CSRF checks; durable/distributed rate limits; rejection of unauthenticated telemetry and duplicate fault/reset abuse; isolation of new synthetic runs from Phase D; and no write credentials in browser JavaScript. GitHub login alone does not satisfy those requirements.

## Render-to-Datadog research — nothing enabled

[Render supports Datadog HTTPS log streaming](https://render.com/docs/log-streams). Its default is workspace-wide; Hobby cannot omit individual services. The inspected workspace already contains other Free services, so enabling a default stream could forward unrelated project logs and requires additional owner review. Do not activate it automatically.

An application-scoped HTTPS transport is an alternative for ChargeGuard-only sanitized logs and custom metrics, subject to an authorized server-side key and verified Datadog trial/ingestion limits. Preserve fixed chargeguard.* names, bounded tags, correlation fields, and env:prod separation. Direct metrics require intentional counter/timer/distribution semantics; they must not be declared equivalent to the existing Agent histogram summaries without tests. No new monitor/dashboard, log pipeline, paid add-on or API key is created here. Local macOS Agent evidence remains env:dev evidence.

## Verification and gate status

Preparation checks: 42 API unit, 13 integration and 5 web policy tests; API typecheck/build, web lint/typecheck/build passed with Node 24. Focused tests cover hosted binding, deferred database startup, Render public liveness without private data, private API service authentication, unconditional write denial, and rejection of local observability sinks on Render. Blueprint validation returned valid=true for one Free web service.

Pending live verification: actual Render service/URL, CIDRs, Atlas TLS/auth/ping/readiness, BFF switch, UI data, OAuth regression after the switch, real cold-start measurements and production Datadog intake. A Render Live label or /healthz=200 does not complete these checks.

Stop at the Atlas approval gate. Do not add, remove or replace any network entry without the owner's explicit approval of the displayed actual ranges and risk.
