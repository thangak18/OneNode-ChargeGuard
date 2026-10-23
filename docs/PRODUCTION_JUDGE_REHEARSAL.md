# Controlled production Judge rehearsal — 23 October 2026

## Scope and result

Owner approved one four-action lifecycle (A), followed only after verified shutdown by one conditional re-arm (B). Both were executed on source `936bb02e650fc1b3f9bf5cc80979eebba1d7ff4b`, using the real approved Chrome GitHub session → Judge Console → Vercel BFF → Render NestJS → existing Atlas database.

Only run `judge-4afc45f4427ab21f48d61c89`, owner `github:138879141`, software asset `demo-charger-01` changed. No second lifecycle/run, no legacy/global reset, no operational/time-series telemetry writes, no Phase D reset, no ACN upload, no Datadog submission, no paid resource or network/privilege change.

Final authoritative result: **cycle 2, BASELINE, revision 5, five audit actions, two cycle-1 SYNTHETIC observations, zero cycle-2 observations**. Exactly one Judge Run remains. The six original collection fingerprints match the private pre-provision baseline; pinned Phase D incident `demo-58a1983cae09` remains unchanged and RESOLVED.

## Actual HTTP and Atlas evidence

Vercel CDN request metadata confirms exactly five successful POSTs to the scoped Judge routes in the rehearsal window. Each returned **HTTP 201**, once per action. Request metadata was reduced to timestamp/path/status; credential headers, cookies, tokens, request bodies and client metadata were not exported.

| Action | Vercel request time (UTC) | Atlas audit time (UTC) | Verified state |
| --- | --- | --- | --- |
| fault | 07:43:18.726 | 07:43:18.915 | cycle 1 OPEN, revision 1 |
| acknowledge | 07:44:09.941 | 07:44:10.173 | cycle 1 ACKNOWLEDGED, revision 2 |
| recover | 07:44:33.040 | 07:44:33.429 | cycle 1 RESOLVING, revision 3 |
| resolve | 07:44:55.235 | 07:44:55.440 | cycle 1 RESOLVED, revision 4 |
| reset (approved re-arm only) | 07:52:50.498 | 07:52:50.872 | cycle 2 BASELINE, revision 5 |

After every committed action, independent read-only Atlas inspection verified exact revision, status, cycle, ordered actor-derived audit entries, observation count and all six protected fingerprints. Audit actor was consistently `github:138879141`. Fault stored a cycle-1 software observation 0 A / FAULT; recover stored 8.25 A / CHARGING. Both are SYNTHETIC scenario values with timestamps matching their audit entries, not physical measurements.

A was closed before B: configuration disabled, deployments completed, **22/22 Judge and legacy POST checks returned 403 at 07:47:38 UTC**, owner session reported `canMutate:false`/`canRearm:false`, and authenticated detail remained RESOLVED/revision 4. Only then were the separately approved re-arm flags opened.

## Browser verification and confirmation handling

The real UI showed each recorded status, revision, allowed next action, lifecycle stepper, chart/table and audit timeline after successful readback. Active cycle 2 showed no observations and one re-arm entry. Selecting archived cycle 1 showed RESOLVED, the original four audit actions and the two-point synthetic chart, with controls disabled.

Browser focus changes interrupted confirmation automation. Fault was verified committed before proceeding, never retried. The first re-arm confirmation remained open long enough that the frontend freshness check prevented its POST; Atlas remained revision 4. After verifying no change and refreshing, one re-arm POST succeeded. CDN records confirm exactly one reset 201; no duplicate action or ambiguous final state remains. No automatic POST retries or direct Atlas edits were used.

## Shutdown and preservation

At the final shutdown, both platforms saved all three flags as false and redeployed the reviewed source:

- `JUDGE_PROD_WRITES_ENABLED=false`
- `JUDGE_ROUTES_ENABLED=false`
- `JUDGE_REARM_ENABLED=false`

`DD_CLOUD_ENABLED=false` was independently rechecked on Render. At 07:55:01 UTC, **22/22 Judge/legacy mutation requests returned 403**. Atlas readback at 07:55:06 UTC confirmed final state and preserved fingerprints. `judge_policy` retained only the approved `_id_` and `expiresAt_ttl {expiresAt:1}, expireAfterSeconds:0` indexes. Policy documents expired through the existing TTL mechanism; zero remained at that readback. Durable run audit and observations remain intact.

## Verified defect and release correction

The global production banner claimed all operator actions were disabled even during the approved activation window, and the policy helper text still described provisioning as pending. The post-rehearsal UI-only correction uses a neutral shared-API/read-only banner and session-dependent policy guidance. No authorization or lifecycle logic changed. The corrected source is committed/deployed with all mutation flags OFF; no additional production action is authorized or needed to test these labels.

Node 24.22.1 regression after the correction: **55 API unit, 24 disposable integration, 29 web, 6 HTTP BFF tests passed**; API typecheck/build and web lint/build passed. Mutating regression tests used disposable databases. Secret/raw-data review precedes commit; `.env` remains ignored.

## Readiness and limitations

The production four-action path and evidence-preserving re-arm now have actual browser/HTTP/Atlas evidence. Cycle 2 is ready as the next scenario, while the deployment remains read-only. A future recording requires separate approval to open another lifecycle; this rehearsal authorization has been consumed and does not permit a second fault or re-arm.

No Datadog production ALERT/OK cycle or physical charger recovery is claimed. Previously verified local `env:dev` Phase D monitoring remains separate from unactivated production intake. Nonce/quota and run CAS are still separate operations, fixed-window quotas have bounded boundary bursts, and delivery has no durable outbox. Production negative checks verified anonymous/service denial, wrong-run gating, blocked re-arm during A and legacy 403. Invalid signed identity/asset/assertion and race/abuse cases were covered by disposable security tests; no cloud credential extraction was used to fabricate such identities.

Private screenshots and reduced readback/request evidence are stored outside Git. See [the rehearsal/recording runbook](JUDGE_REPEATABLE_DEMO.md) for future activation and emergency shutdown steps. No screen recording was requested or performed.
