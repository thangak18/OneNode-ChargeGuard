# Vercel deployment — restricted Stage A

Audit date: 2026-10-21 (Asia/Ho_Chi_Minh). Starting Git HEAD: `334afdb56297d8d5d1492e636a37bf49dafd88e7`.

## Verified account and architecture

The Vercel CLI authenticated as `thangak18-7126`, with the existing `thangak18-7126s-projects` workspace on **Hobby**. Both new projects are connected to the existing private `thangak18/OneNode-ChargeGuard` repository. Visibility was not changed; no paid feature was enabled.

| Project | Root | Framework / runtime | Production URL |
| --- | --- | --- | --- |
| chargeguard-api | apps/api | Official NestJS preset / Node 24.x | https://chargeguard-api.vercel.app |
| chargeguard-web | apps/web | Next.js / Node 24.x | https://chargeguard-web.vercel.app |

Both projects are configured for `sin1` near the existing Singapore Atlas cluster. Each project has its own `vercel.json`. The web install command also installs the API's production dependencies because the local historical adapter has a shared source/type dependency on Zod. It does not install or download raw ACN records.

Browser → Next.js BFF → HTTPS NestJS function → existing Atlas. This topology is deployed, but **Atlas reads are not functional**: cloud readiness and charger reads returned 503. A successful build is not database readiness.

## Status and actual smoke tests

| Stage / check | Actual result |
| --- | --- |
| DEPLOYED | Both framework builds and production aliases completed |
| HTTP REACHABLE | Web pages return 200; authenticated backend liveness returns 200 |
| DATABASE CONNECTED | FAIL: readiness returns 503, sanitized `Database unavailable` |
| READ-ONLY FUNCTIONAL | BLOCKED: BFF can reach backend liveness, but operational reads return 503 |
| INTERACTIVE DEMO VERIFIED | NO: all cloud mutations deliberately disabled |
| DATADOG VERIFIED (production) | NO: stdout only; no production intake or alert lifecycle claimed |

Deployed web `/`, `/chargers`, `/incidents`, `/demo`, `/login`: 200. `/history`: 404. `/api/historical`: 403. Fault POST through BFF: 403. `/api/auth/session` initially returned 503; after owner configuration and redeployment it returns 200 with no authenticated user in a fresh session. BFF `/api/v1/health/live`: 200; `/api/v1/chargers`: 503.

Direct backend: no read key → 401; correct read key + liveness → 200; readiness and chargers → 503; fault POST → 403; `/docs` and OpenAPI JSON → 404. CORS wildcard/credentialed cross-origin access is not enabled in production. Tests sent no accepted mutation and did not create/reset demo records.

The browser showed the restricted-preview banner, no-data cards and an explicit database-unavailable state. This is not evidence of functioning cloud operational data or a complete interactive demo. Narrow browser layout was inspected; a dedicated mobile-device run remains outstanding.

## Atlas networking gate

[Vercel's outbound-IP documentation](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address) describes dynamic egress by default, with Static IPs available to Pro/Enterprise and Secure Compute to Enterprise. The confirmed Hobby workspace cannot provide the required stable egress under the authorized free-only scope. Do not pin a transient observed function IP as a permanent solution.

The local `.env` was checked in memory: canonical database and expected least-privilege application account matched. Credentials were transferred only to encrypted project environment settings. Cloud requests fail database readiness; **TLS** is the fixed failure category observed in cloud runtime logs before a successful ping. A 503 alone does not prove an Atlas allowlist mismatch, nor successful authentication. No Atlas cloud network-access list was edited or independently re-audited during this deployment.

No `0.0.0.0/0`, TLS bypass, cluster recreation or account privilege change was made. To enable database reads, the owner must choose an approved secure egress path. Options for a later decision: explicitly approved Static IP plan/feature plus narrow Atlas allowlisting, or an approved alternative persistent backend host with stable egress while keeping Next.js on Vercel. Neither upgrade nor provider switch is authorized automatically.

## Runtime and security

- `src/main.ts` explicitly imports NestFactory for Vercel's official entrypoint detection, reuses shared bootstrap and starts exactly one listener. Local binding remains loopback; Vercel uses its managed listener.
- Local startup still validates database connectivity. Vercel opens the listener before slow database initialization; authenticated database-dependent requests invoke coalesced connection/readiness checks. Liveness remains available during database failure.
- One MongoClient per warm instance, `maxPoolSize=5`, `minPoolSize=0`, idle timeout 60 seconds, wait-queue timeout 5 seconds, connection/selection timeout 10 seconds. Multiple scaled function instances still create separate pools; there is no global connection cap.
- Persistent telemetry, receipts and incident state stay in MongoDB. No continuous simulation daemon, interval or memory-only authoritative state is added.
- Production/Vercel Stage A middleware independently requires a separate read-only service key for every GET/HEAD; all other methods return 403 before controller execution. It covers health and hides Swagger. Missing service-key configuration fails closed.
- BFF injects the read service key server-side, accepts only allowed routes, requires an HTTPS origin, rejects embedded credentials/path/query/fragment and blocks mutations in production. Upstream request timeout is 20 seconds. The local same-origin/loopback policy remains intact.
- JSON request parsing is bounded to 8 KiB. Production controls are visibly disabled. No `NEXT_PUBLIC_` secret is introduced.
- A read key is not an operator credential. Public BFF reads do not provide per-user access control or distributed rate limits. Until secure connectivity and data-scope review pass, this is a restricted shell, not a sensitive-data portal.
- Production `/history` returns 404 and historical API denies access. Upload staging excludes all raw data, env files, private evidence and learning drafts; 14 local Next tracing manifests had zero raw ACN references.

## Environment matrix

Values belong in project Environment Variables for the intended Production/Preview targets. Never paste values into documentation or browser variables.

| Project | Name | Purpose / deployment setting |
| --- | --- | --- |
| API | MONGODB_URI | Existing Atlas SRV application credentials; TLS validation required |
| API | MONGODB_DATABASE | Canonical project database |
| API | INGEST_API_KEY | Existing local write authentication configuration; cloud writes still denied |
| API | BFF_READ_API_KEY | New random server-only read credential, at least 32 characters |
| API | DD_METRICS_ENABLED | Disabled on Vercel |
| API | DD_ENV | Production tag scope |
| API | CHARGEGUARD_LOG_FILE | **Unset** on Vercel |
| Web | NEST_API_BASE_URL | Actual backend HTTPS origin |
| Web | NEST_READ_API_KEY | Same private read credential as backend |
| Web | NEST_API_KEY | Local development only; not needed to unlock cloud writes |
| Web | GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET | Owner-created GitHub OAuth App credentials; Production presence verified |
| Web | NEXTAUTH_SECRET | Owner-configured random session secret, at least 32 characters |
| Web | NEXTAUTH_URL | Canonical production web origin |
| Web | OPERATOR_GITHUB_IDS | Explicit comma-separated numeric GitHub account IDs |
| Web | CHARGEGUARD_HISTORICAL_LOCAL | Unset in production; production denial applies even if set |

Vercel provides `VERCEL`, `PORT` and production runtime environment. Node version is pinned in each package and confirmed project settings. Local `.env` is never read when running on Vercel. Do not copy the local file wholesale into cloud settings; it can contain unrelated local observability settings.

## GitHub operator login — configured; interactive verification pending

The owner selected GitHub OAuth. Stable NextAuth `4.24.15` supports the installed Next/React versions. `/api/auth/[...nextauth]` and `/login` are implemented, and return a clear unavailable response when configuration is incomplete. The owner has now added all five required OAuth variables to Production as Sensitive values; only metadata was inspected. Numeric provider-account IDs are explicitly allowlisted; empty or unknown identities are denied. JWT sessions expire after one hour. The library handles OAuth state/CSRF, HttpOnly cookies and SameSite defaults; production uses Secure cookies. Raw provider errors/tokens/profiles are not logged.

Owner steps:

1. Open GitHub Settings → Developer settings → OAuth Apps → New OAuth App.
2. Set Homepage URL to `https://chargeguard-web.vercel.app` and Authorization callback URL to `https://chargeguard-web.vercel.app/api/auth/callback/github`.
3. Enter the resulting Client ID/Secret directly in the web project's Vercel environment settings using the names above. Do not send them in chat.
4. Generate/configure the session secret securely and set the canonical origin and approved numeric operator IDs. Do not allow every GitHub account.
5. Redeploy and verify sign-in, rejected unapproved account, session expiry and sign-out.

**Signing in does not enable mutations in this release.** Stage B still requires independent backend operator authorization, durable rate limits, CSRF/origin action tests, trusted actor propagation, connectivity, and an explicitly scoped new synthetic lifecycle test. There is no mutation-unlock environment switch. Existing Phase D evidence must not be reset for this test. No login/logout or authenticated action success is claimed without the owner configuration and live verification.

## Datadog production decision

[Datadog's Vercel integration](https://docs.datadoghq.com/integrations/vercel/) uses Vercel Log Drains. [Vercel Drains](https://vercel.com/docs/drains) require Pro/Enterprise and have usage charges; they are unavailable on Hobby. No drain, paid integration, additional monitor or dashboard was created.

Local Agent UDP metrics and file forwarding are preserved. On Vercel the configuration rejects loopback DogStatsD and local log-file settings, uses sanitized JSON stdout, and emits fixed error categories without driver messages or topology hosts. Runtime stdout was observed in Vercel; it is **not** Datadog intake verification. Production uses a distinct environment scope and existing `env:dev` monitors must not be presented as cloud coverage.

An explicit HTTPS custom-metric/log transport is a possible later alternative, subject to API-key permissions, free/trial usage review, batching, request-completion flushing and intake verification. None is silently enabled here. Metric names, local tags and pinned ALERT → OK evidence remain unchanged.

## Tests and limitations

Node 24: 33 API unit tests, 12 integration tests, 5 web policy tests; API typecheck/build and web lint/typecheck/build passed. Integration uses disposable local MongoDB or stubbed database providers, not production Atlas. New tests cover production bootstrap, auth-before-database ordering, liveness during outage, read service-key enforcement, unconditional production write denial, hidden Swagger, CORS, reconnect coalescing, invalid Vercel observability sinks and operator allowlisting. Live HTTP checks separately establish the status matrix above.

`npm audit` reported five high-severity development-tool findings in the existing eslint-config-next → fast-glob/micromatch/braces chain. No forced downgrade or unrelated bulk dependency update was performed. This does not establish an exploitable runtime path; owner should resolve the toolchain advisory before broader production use.

No cloud CRUD, new incident lifecycle, production Datadog verification, physical safety validation, continuous charger feed or public ACN visualization was performed.

## Deployment, rollback and judge access

Deployment uses two Vercel projects linked to the same private monorepo with the root directories above. For CLI deployment, stage only reviewed source files and dependency lockfiles; exclude `.env*`, `data/raw`, private evidence, generated output and unreviewed learning drafts. Set runtime environment in Vercel, then deploy API first, verify restricted health/readiness, deploy Web with the real origin and verify production route denial.

Do not promote merely because build status is Ready. Require database readiness, a scoped synthetic read, mutation-denial checks, browser checks and bundle/privacy scans. Use `vercel inspect` and runtime logs with sanitized output. Vercel's official Nest preset manages the Node function; do not add legacy catch-all Express wrapper deployment hacks.

Rollback: use the project's deployment history to promote the last verified restricted deployment, or `vercel rollback <verified-deployment-url>` within the correct project. A frontend/backend rollback does not roll back database records. If no functional Atlas-connected release exists, remain in restricted mode and use the existing local synthetic demo for judges. Do not downgrade to the original unrestricted backend configuration on a public runtime.

Judges can inspect the online UI shell at the web URL, but cannot currently inspect cloud operational records or run incidents. Communicate the Atlas and OAuth blockers before judging. Use the existing local demo plus preserved Phase D evidence for the verified lifecycle. Do not expose ingest/read keys or invite judges as unrestricted repository collaborators without an access decision.


## OAuth configuration follow-up — 2026-10-21

The owner confirmed configuration. All five required variables exist in Production with Sensitive storage; no values were displayed or copied into the repository. The web project was redeployed from code commit `8e5dce55aae0bbae20e049697d6e88df1547655e` to apply them. Deployment: `https://chargeguard-fau3qv4sh-thangak18-7126s-projects.vercel.app`, aliased to the canonical web origin.

Actual live checks:

- `/api/auth/providers`: 200, GitHub available.
- Fresh `/api/auth/session`: 200, no authenticated user. This is not a successful-login claim.
- `/api/auth/csrf`: 200, token issued; both issued cookies were Secure, HttpOnly and SameSite=Lax. An authenticated session cookie has not yet been observed.
- Valid-CSRF sign-in POST returned an HTTPS GitHub authorization URL, with the canonical callback, a populated client ID, state and scope limited to `read:user`. Parameter values were withheld.
- Sign-in POST without CSRF returned a CSRF challenge rather than a GitHub authorization redirect.
- Browser reached the GitHub sign-in page naming ChargeGuard. The owner must complete login/2FA and any new-app consent directly on GitHub.
- Fault injection, recovery and reset through the production BFF still returned 403 after OAuth configuration.

Pending: real approved-account callback and session, unapproved-account rejection through the provider flow, authenticated-session expiry/logout verification, and independent backend action authorization/rate limits. OAuth configuration does not resolve the separately observed Atlas TLS blocker. No cloud incident was created, no Phase D record was reset, and no mutation protection was relaxed.
