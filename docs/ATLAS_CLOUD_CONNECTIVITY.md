# Atlas connectivity investigation — Vercel Hobby

Date: 2026-10-21 (Asia/Ho_Chi_Minh). Baseline commit: `354a942166c197e6f711794ad3a41de5b9833008`.

**Outcome: unresolved. Cloud MongoDB reads still fail.** This investigation establishes the failure stage and a network-policy incompatibility; it does not claim an authenticated cloud connection or a proven Atlas server-side rejection reason.

## Verified facts

| Layer | Actual result |
| --- | --- |
| Cloud configuration | Canonical database and expected application user; complete URI equals the local configuration when compared privately in memory; no TLS bypass found |
| Vercel environment | Hobby workspace, Node 24.x, Singapore `sin1`; diagnostic runtime v24.21.0 |
| DNS SRV | PASS, 3 Atlas nodes |
| DNS TXT | PASS, 1 record; record contents withheld |
| Node IPv4 resolution | PASS for all 3 nodes |
| TCP 27017 | PASS for all 3 nodes |
| Default TLS, minimum TLS 1.2 | FAIL for all 3 nodes: `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR` |
| TLS restricted to 1.2 | Same failure on all 3 nodes; this was a probe, not a driver setting change |
| Peer certificate available | No certificate available through the probe API at failure time; `secureConnect` was never reached |
| Authentication / ping / database read | Not reached by the layered diagnostic, because verified TLS did not succeed |
| Atlas UI Network Access | 3 Active IPv4 `/32` rules, no all-address rule; current browser IP explicitly reported absent |
| Function HTTPS egress comparison | Observed function egress matched none of the 3 privately inspected rules |
| Cloud runtime logs | Sanitized `tls` failures in `sin1`, Node 24.x, independently consistent with transport probes |

No connection strings, database usernames/passwords, private addresses, DNS targets, certificate bytes, subjects, SANs or fingerprints are in the published evidence. The project-provided application account name is checked in memory only. Raw runtime logs and decrypted environment values are not committed.

The existing ChargeGuardCluster remains visible as an AWS Singapore, three-node replica set, version 8.0.34. The UI says **FREE Monitoring is Paused** and will resume on a connection. That is a monitoring notice, not evidence that the database cluster itself was paused. No resume, rebuild or cluster edit was attempted.

## Failure stage versus root cause

The verified failure is the **TLS handshake, before a secure connection and MongoDB authentication**. Successful TCP proves only that a TCP listener accepts the connection; it does not prove Atlas network authorization or certificate validation. The absence of an inspectable certificate does not establish an expired certificate, a bad CA or a hostname mismatch, and is not a packet-level assertion about everything sent on the wire.

The leading explanation is **Atlas Network Access excluding Vercel's outbound traffic**. Evidence: Atlas currently authorizes only three exact addresses, while an HTTPS egress observation from the function matches none; all three database nodes then reject the TLS handshake. [Atlas documents that clients must originate from an authorized address/range](https://www.mongodb.com/docs/atlas/troubleshoot-connection/).

**Causality limit:** the egress observation uses a fixed HTTPS IP-reflection service. Its address stays in memory and only the allowlist-match boolean is returned. This does not independently prove which NAT address a particular MongoDB TCP socket used. No Atlas server-side deny log, packet trace or controlled allowlist-change test was available. Therefore the exact reason for the peer's internal TLS alert remains unproven; the network-policy mismatch is verified and strongly consistent with the observed failure. A wrong password or database privilege problem has not been demonstrated because authentication is not reached.

The local Mac's default resolver separately returned `EBADRESP` before transport tests. A **process-only** alternate resolver test passed SRV/TXT and TCP, then reproduced the same TLS failures. No OS DNS settings or `.env` values were changed. Local live connectivity is therefore also blocked today; earlier verified Phase D evidence is preserved historical evidence, not a claim that the current local connection works.

## Why there is no justified code-only connection fix here

[Vercel documents dynamic egress by default](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address). [Static IPs require Pro/Enterprise](https://vercel.com/docs/networking/static-ips), with the documented Pro add-on priced at $100/month per project plus regional Private Data Transfer, in addition to the plan. No paid feature was enabled.

The confirmed Hobby workspace has no documented stable-egress feature compatible with the current exact-IP policy. Pinning one transient observed function address cannot provide a durable fix across scaling, cold starts or routing changes. [Atlas Free does not support private endpoints or network peering](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), so private networking is not a free replacement for this existing M0 cluster.

No speculative CA bundle, cipher/version override, credential reset, privilege expansion or cluster recreation was applied. Both tested TLS configurations fail; forcing TLS 1.2 in the application has no supporting evidence. Both probes explicitly require at least TLS 1.2, so the `TLSV1` substring in the OpenSSL error name is not evidence of a negotiated TLS 1.0 connection. The MongoDB driver, TLS verification and pooling configuration are unchanged.

## Secure alternatives requiring owner approval

Keep the frontend and its verified GitHub OAuth on Vercel in each backend-hosting alternative. Do not migrate any ACN files.

| Option | Cost basis checked on 2026-10-21 | Allowlist model | Tradeoffs and prerequisites |
| --- | --- | --- | --- |
| Keep current Vercel Hobby | Existing free plan | No durable narrow egress available | Safely retain restricted preview; no working Atlas operational reads under present constraints |
| Render Free backend | [Free web-service compute with usage limits](https://render.com/docs/free) | [Service-specific, shared regional outbound CIDR ranges](https://render.com/docs/outbound-ip-addresses) | Requires owner approval of a provider/account and the actual ranges, which are broader than a single application's `/32`; sleeps after 15 idle minutes and wakes in about a minute; existing BFF timeout/error handling must be adapted and tested before a judge demo |
| Existing fixed-egress VM or small VPS | Existing approved capacity, or [DigitalOcean 1 GiB VM listed at $6/month](https://www.digitalocean.com/pricing/droplets), before taxes/other resources | VM's stable outbound IPv4, ideally one approved `/32` | Requires owner approval/account/budget if new, OS patching, TLS ingress, firewall and deployment operations; memory sizing and Datadog Agent overhead need validation. An optional reserved IP requires explicit outbound-routing configuration; assignment alone must not be assumed to change egress |
| OCI Always Free VM | [Always Free-eligible resources, conditional on capacity/account eligibility](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm) | Explicit VM egress address and narrowly approved Atlas entry | New account/region/capacity availability and idle-instance reclamation can delay or disrupt a time-limited demo; not guaranteed immediately available |
| Vercel Pro + Static IPs | [Pro/Enterprise plus $100/month/project and transfer](https://vercel.com/docs/networking/static-ips) | Shared static regional pair, explicitly approved in Atlas | Preserves current hosting but is outside free-only authorization and disproportionately costly for this hackathon use |

Recommendation: for a strict zero-compute-cost demo, assess Render Free **only if the owner accepts the service's actual shared CIDR ranges and cold-start limitations**. If exact `/32` isolation and reliable always-on operation matter more, prefer an already-approved fixed-egress VM; a small paid VPS is a separately approved low-cost alternative. OCI is conditional, not a guaranteed free capacity promise. No provider migration, purchase, new account or network expansion was performed.

Before any migration: agree the actual provider, budget and network ranges; review environment/secret transfer; adapt bind address and provider health-check semantics without weakening read authentication; preserve read-only middleware; use HTTPS for the BFF origin; deploy restricted first; verify readiness and real synthetic charger reads; then check browser rendering. Datadog cloud ingestion and independent backend operator authorization/rate limiting remain separate work.

## Implementation and diagnostic safety

- `src/database/atlas-diagnostics.ts`: bounded read-only SRV/TXT/A/AAAA, TCP, certificate-verifying TLS/default and TLS-1.2 probes; fixed error-code allowlist; Atlas DNS names and port 27017 only; at most three nodes. No caller-controlled destination.
- `src/health/atlas-diagnostics.controller.ts`: direct-backend GET only, behind the existing production service-key middleware, opt-in flag and an expiry no more than 30 minutes away; disabled by default. Per-instance coalescing and a 60-second result cache bound duplicate work; cached results cannot bypass expiry. Cache is diagnostic convenience, not authoritative application state.
- Shared bootstrap skips the usual database-readiness prerequisite only for this one authenticated diagnostic route, so a failed connection can be investigated. All production writes stay denied before controllers.
- Next.js BFF does not allow this route. Raw data and service credentials do not reach the browser.
- The optional allowlist snapshot was read from Atlas UI, stored briefly in a private local temporary file and an encrypted diagnostic-only Vercel variable, and used only for comparison. It did not update Atlas.
- `ATLAS_DIAGNOSTICS_ENABLED`, `ATLAS_DIAGNOSTICS_UNTIL` and `ATLAS_DIAGNOSTIC_ALLOWED_CIDRS` were removed after the investigation; a diagnostic-disabled backend was redeployed. Canonical direct endpoint with a valid service key returns 404, without a key returns 401; BFF route returns 404. Earlier immutable diagnostic deployments retain their original automatic expiry and still require the service key until expiry.
- Authentication/ping/read probes run only after all sampled default-TLS probes succeed; that gate did not pass. No application collections or documents were created, updated or deleted.

To reproduce during a separately authorized diagnostic window: set `ATLAS_DIAGNOSTICS_ENABLED` to true and `ATLAS_DIAGNOSTICS_UNTIL` to an ISO UTC instant within the next 30 minutes in the API project, redeploy, and GET `/api/v1/health/atlas-diagnostics` directly with the private `x-chargeguard-read-key` header. The optional encrypted `ATLAS_DIAGNOSTIC_ALLOWED_CIDRS` is a snapshot from the Atlas UI, not a request to modify network rules. Do not put a key in a URL or shell argument. Remove all three variables and redeploy when finished. There is no public BFF access to this endpoint.

## Actual endpoint results

| Request | Result |
| --- | --- |
| Direct API liveness without read service key | 401 |
| Direct API liveness with read service key | 200 |
| Direct API readiness with read service key | 503 |
| Direct API chargers with read service key | 503 |
| Next.js BFF liveness | 200 |
| Next.js BFF readiness / chargers | 503 / 503; no successful charger array |
| Direct fault POST, including a supplied read service key | 403 |
| Direct Swagger | 404 |
| Diagnostic after cleanup, valid key / no key / BFF | 404 / 401 / 404 |

No successful cloud read, browser data rendering, cloud incident lifecycle or production Datadog verification is claimed.

## Tests, evidence and owner actions

Node 24 regression checks: 38 API unit tests, 12 integration tests, 5 web policy tests; API typecheck/build and web lint/typecheck pass. Integration uses disposable MongoDB/stubs, not Atlas production records. Focused tests cover diagnostic host/port restrictions, error redaction, CIDR matching, default-disabled/expired/overlong enablement, service authentication before database access, and public-BFF exclusion. Native TLS was separately tested in the actual function; unit tests do not impersonate a successful cloud handshake.

[Sanitized machine-readable evidence](evidence/atlas-cloud-connectivity-diagnosis.json) records both local resolver runs, the function transport results, private configuration-equality booleans, Atlas UI rule counts, endpoint results and safety boundaries. Phase D evidence bytes match commit `354a942`; no ACN source records or credentials were uploaded/committed.

Owner action: choose whether to retain the restricted Hobby preview or explicitly approve a specific alternative with its budget and network policy. If restoring the local demo is also desired, Atlas currently reports the Mac's IP absent; adding only its current `/32` would require a separate, explicit approval and would not solve Vercel's dynamic egress. No such entry was added here. Do not paste passwords, Atlas URIs, API keys or certificate material into chat.

## Validation correction

An additional command-timeout bound was initially pushed in `fd2e038` before its new typecheck had completed. MongoDB driver 7 rejects `maxTimeMS` in `RunCommandOptions`. The follow-up uses the driver's supported `timeoutMS` option for admin commands, retains the socket timeout, and reruns the full listed checks before pushing the correction. No Git history was rewritten. The diagnostic-disabled deployment remained the canonical backend while the failed build was corrected.
