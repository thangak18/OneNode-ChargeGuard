# ChargeGuard — preparation report

**Updated:** 19 October 2026, ICT / UTC+7. **Team:** OneNode (solo). **Judged build window:** 17–31 October 2026. This document preserves timestamped preparation and connection-verification history. **The latest Datadog implementation and current Atlas TLS blocker are recorded at the end of this document; earlier “not implemented” and connection-failure statements describe previous snapshots.**

## Completed tasks and repository audit

- Read README, all 12 existing documents, the offline inspector, `.gitignore` and placeholder `.env.example`. Working tree was initially clean at `86f9a49`. Existing plans and proposed NestJS/TypeScript → MongoDB → Next.js/Datadog stack preserved.
- Verified GitHub repository is **private** and Issues #1–#8 remain open. #1 concerns dataset/license; #2 concerns Datadog trial, not Atlas.
- Downloaded five complete static session gzip CSVs, pinned source commit and recorded private hashes/URLs. Inspected all **20,228 rows** without installing dependencies.
- Fixed the offline inspector's unnamed CSV time-column handling, local manifest exclusion, trace separation, timestamp anomalies, energy decreases and unreadable-file exit status. No network, runtime ingestion or simulation added to the utility.
- Updated dataset analysis/dictionary/provenance, Atlas instructions and five-collection schema design. Reconciled collection names to requested `chargers`/`meta.chargerId` in architecture and schema; this does not add a new service or change the planned stack.
- Reviewed official MongoDB Free limits and version-specific time-series references. Added volume estimates for observed 4-second source spacing alongside the planned 60-second demo cadence. No collection/index commands executed.
- Checked actual Atlas sign-in UI and local connection prerequisites. Documented the blocker instead of claiming provisioning or connectivity.

## Dataset findings and source evidence

[Official ACN portal](https://ev.caltech.edu/dataset.html): JSON web export and registered-token API; official API JSON was not downloaded or inspected. API field descriptions remain documentation-derived.

[Static source pinned commit](https://github.com/tongxin-li/ACN-Data-Static/tree/abb7cf15cc7108913e965d4375cc7270d532b65f): first five `.csv.gz` paths returned in `time series data/caltech/California_Garage_01` (excluding `.DS_Store`), convenience sample with one EVSE filename prefix. Not representative of other chargers/sites. Public raw-file downloads succeeded; no API token bypass or bulk clone.

**Local path:** `/Volumes/Thang/OneNode-ChargeGuard/data/raw/acn/`. Files `sample_01.csv.gz` … `sample_05.csv.gz`, **5 sessions / 20,228 records / 122,354 compressed bytes**. Ignored `manifest.local.json` stores immutable URLs, original paths, SHA-256 and counts; `quality.local.json` and `inspection.local.txt` contain local findings. The manifest is not a session.

| Actual column | Observed result |
| --- | --- |
| Unnamed first column (`""`) | 20,228 ISO 8601 timestamp strings with explicit `+00:00`; no missing/invalid timestamps |
| `Charging Current (A)` | 20,228 finite numeric strings, 0–30.8 A; no negatives/missing values |
| `Actual Pilot (A)` | Entirely empty: 20,228 missing values |
| `Voltage (V)` | Entirely empty: 20,228 missing values |
| `Charging State` | Populated strings: READY, ADAPTIVE, NOT CHARGING, IDLE, UNPLUGGED |
| `Energy Delivered (kWh)` | 20,228 finite numeric strings; 0–11.5212047222; decreases/reset observed |
| `Power (kW)` | Entirely empty: 20,228 missing values |

Median adjacent spacing **4 seconds** in each file, overall range **1–69 seconds**, **132 gaps >10 seconds**. No duplicate timestamps, backward steps or duplicate rows within each file. Gaps alone do not prove lost records. Energy decreases 1/1/1/1/2 times across samples; all final rows are 0, so final-row energy is **not** a valid session-total estimate. No corrections or imputation were applied. Exported state and energy semantics/measurement lineage remain unverified; source current is described as measured by the dataset. Headers alone do not establish measured voltage or power. Faults, temperature, connectivity events and operator responses need explicitly labeled future simulation; power needs disclosed derivation assumptions or omission.

Full per-file findings and limitations: [analysis](DATASET_ANALYSIS.md), [dictionary](DATA_DICTIONARY.md), [provenance](DATA_PROVENANCE.md). The static root/README have no standalone license grant; permission for demo reuse/redistribution remains unresolved. Keep raw files local, cite Lee/Li/Low (ACM e-Energy 2019), and clarify rights before sharing traces.

## MongoDB Atlas configuration and connection results — verification follow-up

**Test date:** 18 October 2026, approximately 14:17 ICT (UTC+7). The initial preparation's login failure and absent `.env` are historical and superseded by this follow-up. The owner reported creating `ChargeGuardCluster`; this task independently confirmed its existence in authenticated Atlas UI. No cloud resources or application collections were created by this task.

**Method:** official MongoDB Node.js driver **7.7.0**, Node.js **v25.2.1**. Driver installed in a temporary directory outside the repository, without lifecycle scripts or repository dependency changes. Parsed local `.env` with Node's `util.parseEnv`, without executing shell content or logging values. The URI contains a database-password placeholder. An alternate database key resolves to `chargeguard`; `MONGODB_DATABASE` from `.env.example` is absent. The diagnostic explicitly selected `client.db('chargeguard')`, so the alternate key did not cause the connection failure.

| Check | Verified result |
| --- | --- |
| Atlas authenticated management UI | Available; cluster visible |
| `ChargeGuardCluster` deployment | **FREE**, AWS Singapore (`ap-southeast-1`), MongoDB **8.0.34**, 3-node replica set; UI reports 512 MB capacity, backups inactive |
| Local `.env` hygiene | Present, Git-ignored and untracked; no values printed or committed; content left unchanged |
| Local URI credentials | Password is still a recognizable placeholder; valid database authentication cannot be established with this configuration |
| SRV DNS | **PASS**, 3 cluster nodes resolved |
| TXT DNS | **PASS**, 1 record resolved |
| Node address resolution | **PASS**, all 3 nodes |
| IP access list | Atlas UI shows an **Active `/32`** rule including the current browser IP; HTTPS egress IP from this machine matches that rule. No IP addresses retained in this report; no rules changed |
| TLS with default validation | **FAIL**, all 3 nodes: `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR` / remote internal-error alert |
| Explicit IPv4 + TLS 1.2 | **FAIL**, same remote TLS alert on all 3 nodes; certificate verification remained enabled |
| Independent Python TLS probe | **FAIL**, all 3 nodes return `TLSV1_ALERT_INTERNAL_ERROR`, corroborating that the symptom is not isolated to the Node driver |
| Driver connection / ping | **FAIL before command execution**: driver connection failed at TLS; `{ping:1}` could not be sent. No `{ok:1}` result |
| Access to `chargeguard` | **BLOCKED / UNVERIFIED**; `listCollections` was planned but not reached |
| Effective authenticated permissions | **UNVERIFIED**; `connectionStatus` was planned but not reached |
| Configured database-user role (Atlas UI only) | **`atlasAdmin` on `admin`, All Resources**. This is broader than the proposed `readWrite` on `chargeguard`; no role changes made |

### Diagnosis and next actions

1. **Configuration/authentication blocker:** privately replace only the password placeholder in `.env` with the actual database user's password, percent-encoding reserved URI characters. Do not paste it into chat, terminal command arguments or GitHub. Prefer the documented `MONGODB_DATABASE=chargeguard` key for future tooling; the diagnostic already selected the correct database explicitly. The driver never reached SCRAM authentication, so no incorrect-password or successful-authentication result is claimed.
2. **DNS is working in this run.** SRV, TXT and node resolution all succeeded; changing DNS is not justified by these observations.
3. **IP access is configured for the observed current IPv4 egress.** Missing current-IP access is not supported by the evidence. HTTPS egress comparison does not prove all protocols use the same route; VPN/firewall/ISP routing and Atlas rule propagation may still require investigation. Do not open `0.0.0.0/0` or broaden rules as a workaround.
4. **Unresolved TLS blocker:** default, IPv4/TLS 1.2, Node driver and independent Python probes all receive a remote internal-error alert before database commands. This is not evidence of a specific certificate-chain failure or a proven root cause. Keep TLS and hostname/certificate validation enabled. Recheck cluster readiness and rule propagation, verify the local network permits Atlas node ports, then retry from the same authorized machine. If persistent, use Atlas connection diagnostics/support with the sanitized alert, timestamp and node count. An alternate network needs its exact current IP approved before changing access rules.
5. **Permissions remain untested over a database connection.** Atlas UI confirms a broad configured administrative role, not successful authentication or executed read/write access. A separate least-privilege `readWrite` user on `chargeguard` is recommended for future application use, subject to owner approval. After TLS and credentials are resolved, repeat `ping`, read-only `listCollections` and sanitized effective-role inspection; no probe writes or application collection creation are needed. An absent/empty `chargeguard` database before the first application write is normal.

Sources: [official driver troubleshooting](https://www.mongodb.com/docs/drivers/node/current/connect/connection-troubleshooting/), [listCollections](https://www.mongodb.com/docs/manual/reference/command/listcollections/), [connectionStatus](https://www.mongodb.com/docs/manual/reference/command/connectionstatus/). Commands requiring an authenticated connection were **not** reported as passed. Probe output omitted usernames, passwords, URIs, cluster hostnames, IPs and raw exception objects. No application data was read or written, and no application collections or indexes were created.

### Hotspot retest — 18 October 2026, 14:31 ICT

Retested on the owner's reported iPhone 5G hotspot with official MongoDB Node.js driver 7.7.0 available for a conditional ping. Earlier TLS failures above are historical; the current transport result supersedes them.

| Check | Verified result |
| --- | --- |
| SRV DNS | PASS, all 3 nodes advertise port 27017 |
| IPv4 TCP port 27017 | PASS on all 3 nodes |
| TLS handshake | PASS on all 3 nodes using TLS 1.3 |
| Certificate / hostname verification | Enabled and passed on all 3 nodes; no insecure URI options detected |
| Local credentials | Username/password fields present, but a credential placeholder remains; no populated values printed |
| MongoDB ping | NOT EXECUTED because local credentials still contain a placeholder |
| Authenticated database access | Still UNVERIFIED; transport success alone is not authentication/authorization proof |

The previous remote TLS internal-error alert was not reproduced on this connection. The network change and successful retest do not prove the exact cause of the earlier error. Current remaining blocker is local credential configuration: replace the password placeholder privately, percent-encode reserved characters, then rerun authenticated ping. No network access rules, `.env` content, TLS security settings or application collections were modified; no secrets committed.

### Configuration audit and conditional connection verification — 18 October 2026, 14:38 ICT

This is the latest verification snapshot. Earlier tests above are preserved as history.

- Inspected repository files, `.env.example`, ignore rules and local configuration without printing environment values. Repository still contains preparation documents and the offline dataset utility; no application configuration or backend has been established that depends on the alternate database key.
- Standardized the local database setting to the canonical **`MONGODB_DATABASE`** key matching `.env.example` and the requested database. Removed the superseded database-key alias. Verified in memory that the URI was unchanged. No credentials were changed, reset or displayed; `.env` remains ignored and untracked.
- URI uses Atlas SRV syntax accepted by official driver **7.7.0**, targets an Atlas hostname, and has username/password fields. TLS is enabled with certificate and hostname checks; no insecure URI options detected. The database setting matches the requested database.
- **Configuration FAIL:** the password still contains an unresolved placeholder. Nonempty credentials and parseable syntax do not establish valid authentication. Per the task instruction, stopped before any client authentication attempt.

| Step | Latest result | Evidence / limit |
| --- | --- | --- |
| DNS SRV resolution | **PASS** | 3 nodes resolved; all advertise port 27017 |
| IPv4 TCP port 27017 | **PASS** | Socket connection succeeded on all 3 nodes |
| TLS | **PASS** | TLS 1.3 handshake succeeded on all 3 nodes |
| Certificate and hostname verification | **PASS** | Enabled; all 3 verified TLS sockets authorized |
| Usable credential configuration | **FAIL** | Unresolved database-password placeholder |
| MongoDB client authentication | **BLOCKED / NOT TESTED** | Intentionally stopped at configuration validation |
| Admin database `{ping:1}` | **BLOCKED / NOT EXECUTED** | No authenticated client; no server ping response claimed |
| Read-only access to application database | **BLOCKED / NOT TESTED** | No database commands sent |
| Authenticated effective roles | **BLOCKED / NOT TESTED** | No `connectionStatus` response |

**Exact verified blocker:** local credential configuration, before authentication. This is not an observed authentication rejection or authorization failure. Current DNS/TCP/TLS pass, so no DNS changes, certificate bypass, cluster recreation or network-rule expansion are justified.

**Smallest corrective action:** privately replace the password placeholder in the existing local URI with the actual Atlas database-user password, encoding reserved characters correctly. Keep the canonical database key as now standardized. Do not send the URI/password in chat, shell arguments or issues. If the password is unavailable, handle recovery yourself in Atlas; no automatic reset is authorized.

After credentials are corrected, rerun official-driver client authentication, admin ping, read-only application-database access and sanitized `connectionStatus` role inspection. Do not create collections or use write probes. Configured `atlasAdmin` privileges were observed in the earlier authenticated Atlas UI inspection and are broader than application needs; this run did not verify effective server roles. Recommend a separate approved `readWrite` identity restricted to the application database, without changing current permissions automatically.

**Security / scope:** `.env` ignored and untracked; no secret values, usernames, populated URIs, hostnames or IP addresses in diagnostic output/report. Driver remains outside the repository. No commit, cloud permission/network change, collection/index creation, backend, telemetry ingestion or Phase A implementation performed.

**Readiness:** authenticated Atlas connection, ping and database access are **NOT VERIFIED**. Phase A readiness cannot be confirmed until these checks succeed with valid local credentials.

### Credential recheck — 18 October 2026, 14:43 ICT

The owner reported updating the connection string. Securely re-read the actual workspace file `/Volumes/Thang/OneNode-ChargeGuard/.env` and validated it with official MongoDB Node.js driver 7.7.0. No environment values were printed.

| Check | Exact result |
| --- | --- |
| Atlas SRV syntax | PASS |
| Canonical database configuration | PASS; matches the requested database |
| TLS security options | PASS; certificate and hostname verification remain enabled |
| Populated usable credentials | FAIL; password is still a recognized unresolved database-password placeholder |
| Duplicate URI definitions | None detected |
| Authentication | NOT EXECUTED; stopped at credential validation |
| Admin `{ping:1}` | NOT EXECUTED; no server response claimed |
| Read-only database access | NOT EXECUTED / UNVERIFIED |
| Effective authenticated roles | NOT EXECUTED / UNVERIFIED |

This is a verified **local configuration blocker**, not a server authentication rejection, permission failure or newly observed network failure. Network connectivity was not retested in this credential-gated run; the most recent DNS/TCP/TLS evidence remains the successful 14:38 ICT test above.

**Next action:** privately edit the workspace `.env` at the exact path above and replace the database-password placeholder with the actual password, correctly URI-encoding reserved characters. Verify the intended file was saved. Do not paste credentials into chat or command arguments. No automatic credential reset or account permission changes performed. After the file is corrected, retry authentication, admin ping and read-only database access. Phase A readiness is still unconfirmed.

The `.env` content was not modified in this recheck. It remains ignored/untracked; no secrets were printed or committed. No collections, indexes or application code were created.

### Exact-file recheck — 18 October 2026, 14:47 ICT

Securely re-read `/Volumes/Thang/OneNode-ChargeGuard/.env`. The password no longer matches a placeholder. However, another recognized unresolved connection placeholder remains at **`/Volumes/Thang/OneNode-ChargeGuard/.env:1`**. Only its location is disclosed; no line content or environment value is included.

| Check | Latest result |
| --- | --- |
| Password placeholder check | PASS; none detected in the password |
| Complete usable connection configuration | FAIL; unresolved connection placeholder at the location above |
| Database selection | Requested database is specified in the URI path; canonical database key is currently absent |
| TLS verification configuration | Enabled; no certificate/hostname bypass |
| MongoDB authentication | BLOCKED / NOT EXECUTED; stopped before sending credentials to an unresolved destination |
| Admin `{ping:1}` | BLOCKED / NOT EXECUTED |
| Read-only database access | BLOCKED / NOT EXECUTED |
| Effective roles | UNVERIFIED; no authenticated server response |

This supersedes the prior password-placeholder diagnosis: the remaining error is still **local connection configuration**, not an observed server authentication or authorization error. No DNS/TCP/TLS retest was sent to the unresolved destination; successful previous hotspot checks apply to the real cluster, not this incomplete URI.

**Next action:** privately correct the remaining connection placeholder at the exact file/line above using the connection details for the existing Atlas cluster, save the file, then retry verification. Do not share the line contents or credentials. No need to recreate the cluster, broaden network access, reset the password or modify cloud permissions based on this result. The canonical database key can be restored to match `.env.example`; the target database is already present in the URI path.

Only this report changed. Local `.env` was read without printing its contents and was not modified or committed. No application collections, indexes or code were created. Phase A readiness remains unverified pending successful authentication, admin ping and database access.

### Successful authenticated verification — 18 October 2026, 15:01 ICT

**Latest result: PASS.** This snapshot supersedes all earlier MongoDB credential/connection blockers above; earlier observations remain preserved as history.

Securely reread exactly `/Volumes/Thang/OneNode-ChargeGuard/.env` using Node's `util.parseEnv`, without logging environment values. Used the official MongoDB Node.js driver **7.7.0** installed outside the repository. The current URI is accepted Atlas SRV configuration, credentials are populated with no unresolved MongoDB placeholders, and the canonical database setting matches the requested database. Certificate and hostname verification remained enabled. No local credential edits or cloud settings changes were made in this run.

| Check | Actual server-backed result |
| --- | --- |
| MongoDB URI / canonical database configuration | **PASS** |
| Unresolved MongoDB placeholders | **PASS**, none detected |
| Authenticated MongoDB client connection | **PASS**, client connection completed successfully |
| TLS-protected connection | **PASS**, authenticated commands succeeded with TLS and certificate/hostname validation enabled |
| Admin database `{ping:1}` | **PASS**, server returned **`ok: 1`** |
| `chargeguard` collection enumeration | **PASS**, `listCollections` succeeded; **0 collections** |
| Read-only `chargeguard` access | **PASS**, `find` on the planned `stations` namespace succeeded with **`ok: 1`**, **0 documents returned** |
| Authenticated effective roles | **PASS**, `connectionStatus` succeeded and reports **1 authenticated user** with **`atlasAdmin`**; scoped `readWrite` role is not assigned |
| Writes / collection or index creation | **NONE** |

The read probe used a constant-false filter, projected only the identifier, and requested one single batch. It verified read authorization without retrieving application records. A read against an absent namespace does not create it. Collection enumeration returned zero, so these checks do not imply application collections exist or that a previously empty logical database was materialized.

**Permissions:** the authenticated account has effective **`atlasAdmin`**, broader than required for the future application. Recommend a separate database user with `readWrite` restricted to the application database, subject to owner approval. No credential reset, role change, network-rule change or cloud provisioning performed. Runtime application writes have not been tested; this verification was deliberately read-only apart from harmless administrative diagnostic commands.

**Remaining MongoDB connection errors: NONE observed in this run.** DNS/network/TLS are sufficient for this successful authenticated connection; no separate network workaround was needed. Prior credential placeholders and TLS failures are historical and no longer current blockers.

**Readiness:** MongoDB connectivity, admin ping, read authorization and effective-role inspection are verified. The MongoDB connection prerequisite for **Phase A: NestJS Backend + MongoDB Time Series Collections + Telemetry Ingestion** is ready. Phase A was **not implemented**. Dataset usage permissions and Datadog verification remain separate preparation items; choosing a scoped runtime identity remains a security follow-up.

**Security:** `.env` remains ignored/untracked. No usernames, passwords, environment values, populated connection strings, cluster hostnames, IPs or raw error objects were displayed or added to this report. No secrets were committed. Only this documentation was updated.

## Security and verification

- Repository privacy checked through authenticated GitHub CLI; no visibility change.
- `git check-ignore` confirms `.env`, `.env.production` and raw sample paths excluded. No raw dataset or populated `.env` tracked. `.env.example` and `.gitignore` already meet preparation needs and remain unchanged.
- Repository changes contain only preparation documentation and standalone research code. The connection follow-up installed the official driver in a temporary directory outside the repository; no repository dependencies, credentials, personal identifiers, runtime backend, replay/fault simulator, UI or observability integration added.
- Ran inspector over all five files successfully; local output in ignored `inspection.local.txt`. Focused checks passed for unnamed time column, refusal to assign a timezone to naive dates, separation of JSON traces, exclusion of private manifests, and nonzero exit for corrupt gzip input. `git diff --check` passed; reviewed preparation diffs and scanned changed files for credential URI, token and private-key patterns without matches. All five raw-file hashes match the private manifest and raw paths are ignored/untracked.
- AI assisted this follow-up's research, script corrections and documents; no generated measurement is presented as observed data. Earlier 14 October preparation history remains in Git.

## GitHub preparation updates

Posted factual progress to [Issue #1](https://github.com/thangak18/OneNode-ChargeGuard/issues/1#issuecomment-6245506862) and [Issue #2](https://github.com/thangak18/OneNode-ChargeGuard/issues/2#issuecomment-6245507062). Neither issue was closed: dataset permission and Datadog activation remain incomplete. Only aggregate findings and sanitized blockers were posted, not source sessions or credentials.

## Exact remaining owner actions and blockers

1. **MongoDB configuration and connection checks complete** as of 15:01 ICT. No credential correction or network workaround is currently needed. Keep `.env` local, ignored and untracked.
2. DNS/network/TLS connectivity supported successful authenticated commands in the latest run. No network access rule changes are required by the observed result.
3. The 15:01 ICT session verified the older account's broad `atlasAdmin` privileges. The later 15:42 ICT verification below establishes that the newly configured `chargeguard_dev` identity has a single scoped `chargeguard_rw` role and only `chargeguard` database privileges; this security follow-up is complete.
4. Await the owner's next instruction before Phase A. This task did not create application collections/indexes or implement backend/ingestion logic.
5. Clarify dataset reuse/redistribution permission and exported state/energy semantics with the source maintainer or explicit official terms. Until resolved, keep the five downloaded traces local and do not bundle them into public fixtures/services.
6. Verify Datadog trial activation, site and coverage through 31 October. The existing monitoring plan is documentation only; account/trial status remains **UNVERIFIED**. No email or organizer message sent on the owner's behalf.

## Readiness for official 17 October phase — assessed 18 October

| Criterion | Status |
| --- | --- |
| Architecture, five-collection schema, source/synthetic boundaries documented | Ready as design |
| Five real local sessions inspected and quality limitations documented | Complete |
| Private repository and ignored raw samples/credentials | Verified |
| Dataset reuse/redistribution permission | Pending |
| Atlas Free cluster and region | Verified in authenticated UI |
| DNS, TCP 27017 and verified TLS via iPhone hotspot | Passed on all 3 nodes at 14:38 ICT |
| Authenticated MongoDB connectivity, admin ping and `chargeguard` read access | PASS, verified at 15:01 ICT |
| Effective database permissions | Latest check at 15:42 ICT: `chargeguard_dev` has only custom `chargeguard_rw` role; effective privileges scoped to `chargeguard`. Earlier `atlasAdmin` result was for the old identity at 15:01 ICT. |
| Datadog account/trial verification | Pending |
| Core application implementation in this task | None |

**MongoDB prerequisite for Phase A: READY as of 18 October, 15:42 ICT.** Authentication, admin ping, read/write access and scoped application-user privileges are verified; no connection errors remain in the latest test. No Phase A code or application collections were implemented. Overall preparation still has independent dataset-rights and Datadog verification items. This does not retroactively claim readiness on 17 October.

### Least-privilege application-user verification — 18 October 2026, 15:42 ICT

**Latest verified outcome: ALL PASS.** This check supersedes the earlier 15:01 ICT result for the former administrative database identity. The app's intended `chargeguard_dev` identity is now verified. All preceding observations are retained as historical context.

Method: securely read the exact local `/Volumes/Thang/OneNode-ChargeGuard/.env` with Node.js `util.parseEnv` and connected using the official MongoDB Node.js driver **7.7.0** installed outside the repository. Validation and diagnostics did not print credential or connection-string values. Driver TLS verification was kept enabled. No Atlas account, role, network rule or repository dependency was changed.

| Check | Verified result | Evidence |
| --- | --- | --- |
| `MONGODB_URI` Atlas SRV format, required credentials | **PASS** | Validated locally without printing URI or values |
| `MONGODB_DATABASE=chargeguard` | **PASS** | Canonical database variable matches intended database |
| Unresolved credential placeholders / insecure TLS options | **PASS** | None detected |
| Authentication | **PASS** | MongoDB driver connected; `connectionStatus` confirmed the expected user `chargeguard_dev` |
| Admin ping | **PASS** | `db.adminCommand({ ping: 1 })` returned `ok: 1` |
| Database read | **PASS** | `chargeguard` collection enumeration and read-only `findOne` completed |
| Authenticated roles | **PASS** | Exactly one assigned role: custom `chargeguard_rw` |
| Database permission scope | **PASS** | `connectionStatus` with `showPrivileges: true` returned 2 privilege entries, both confined to `chargeguard` |
| Prohibited administrator roles | **PASS** | Neither `atlasAdmin` nor `readWriteAnyDatabase` assigned; no other high-privilege role observed |
| Insert | **PASS** | Insert acknowledged in a unique temporary verification collection |
| Find | **PASS** | Found the inserted temporary document |
| Update | **PASS** | Exactly one temporary document updated |
| Delete | **PASS** | Exactly one temporary document deleted |
| Temporary collection cleanup | **PASS** | Dropped only the collection generated for this test; verified it no longer exists |
| `.env` security | **PASS** | `git check-ignore` confirms ignored; `git ls-files` confirms untracked |

Test used one random unique collection named specifically for permission verification and accessed only its own test document. No pre-existing application data was changed; no application collection or index was created. The temporary collection was dropped after testing, and its absence was checked. No secrets were logged, committed or included in this report.

**MongoDB connection status: PASS.** Authentication, ping, read, write and least-privilege permission checks all succeeded; no remaining MongoDB connection errors observed. **Ready to begin Phase A: NestJS Backend, MongoDB Time Series Collections, and Telemetry Ingestion**, subject to the owner's next instruction. Phase A has not been implemented. Dataset usage permissions and Datadog trial verification remain independent project follow-ups.

## Phase A implementation and Atlas end-to-end verification — 18 October 2026

**Current status: Phase A backend implemented and verified.** This section supersedes historical statements above that the repository is preparation-only. Implementation occurred within the judged development window. See [README](../README.md), [architecture](ARCHITECTURE.md), and [build plan](BUILD_PLAN.md) for runnable procedures and phase boundaries.

### Implemented components

- NestJS 11/TypeScript API in `apps/api`, with validated Atlas SRV configuration, a required private ingestion key, startup MongoDB ping, graceful shutdown, structured sanitized errors, URI API versioning and Swagger.
- Six collections: `stations`, `chargers`, `telemetry` (MongoDB time-series with BSON Date `ts` and station/charger `meta`), `incidents`, `incident_actions`, and technical `ingestion_receipts`. Schema initialization is repeatable and installs regular and time-series-compatible indexes. The time-series and receipt retention windows are each seven days.
- Protected single/batch telemetry writes: strict Zod validation, allowed measurement ranges, timezone-aware source/replay timestamps, asset pairing checks, per-event receipt and fingerprint-based idempotency, and cautious crash recovery for `PENDING` receipts.
- Bounded API aggregations: history, per-charger latest, average current over time buckets, charging-state event counts, recent telemetry activity and station summaries. Virtual asset status is a configuration field; telemetry activity is only evidence of recent messages.
- Streaming local ACN gzip CSV adapter, bounded downsampling and deterministic event IDs. Historical `sourceEventAt`, transformation assumptions and field-level provenance are preserved. Missing power/voltage/temperature are never invented, and source energy decreases are flagged. Local replay defaults to dry-run; no original ACN source rows were sent to Atlas.

### Actual verification results

| Verification | Outcome | Evidence |
| --- | --- | --- |
| TypeScript static validation | **PASS** | `npm --prefix apps/api run typecheck` |
| Production compilation | **PASS** | `npm --prefix apps/api run build` |
| Unit tests | **PASS: 9 / 9** | Config, schema, provenance, deterministic ACN replay |
| Integration tests | **PASS: 8 / 8** | Disposable MongoDB fixture; collections, HTTP auth/validation, missing sensor fields, idempotency and `PENDING` reconciliation, aggregations, database errors and readiness |
| Local real-source adapter dry-run | **PASS** | 15 bounded downsampled readings validated from one locally held `.csv.gz`; no Atlas writes |
| Atlas collection creation, first run | **PASS** | `stations` already present from earlier narrow diagnosis; created `chargers`, `incidents`, `incident_actions`, `ingestion_receipts` and `telemetry` time-series, then installed indexes |
| Atlas virtual seeding | **PASS** | One virtual station plus five virtual charger references; existing records preserved |
| Actual Atlas authenticated HTTP smoke | **PASS** | Live/ready, single synthetic ingestion, idempotent retry, history, current aggregation, Swagger JSON |
| Atlas initialization repeatability | **PASS** | Second `db:init`: `CREATED: (none; already initialized)`; all indexes verified |
| Real Atlas admin ping | **PASS** | Official Node.js MongoDB driver, server returned `ok: 1` |
| Real Atlas least privilege | **PASS** | `chargeguard_rw` sole assigned role; effective privileges limited to `chargeguard`; no `atlasAdmin` or `readWriteAnyDatabase` |
| Real Atlas schema and indexes | **PASS** | All six expected collections, telemetry type `timeseries`, all required named indexes |
| Real Atlas virtual assets | **PASS** | `demo-station-01` exists; five virtual chargers associated with it |

The actual Atlas checks ran using a supported Node.js **24 LTS** runtime. The Mac's current Node 25 default is outside the project's declared supported range; developers should select Node 24. Node 24 on the current iPhone hotspot encountered DNS SRV `EBADRESP` with the system resolver, but explicit process-local DNS servers `1.1.1.1,8.8.8.8` resolved the issue. TLS and hostname/certificate validation remained enabled, and no Atlas network rules or account permissions were changed. The successful repeatability and schema audit used this process-local override and a throwaway in-process test ingestion key; no secret values were printed.

The HTTP Atlas smoke test inserted exactly **one explicitly synthetic** telemetry reading on `demo-charger-01`, with eventId `phase-a-atlas-smoke-20261018` and source demo event timestamp 2026-10-18T08:30:00Z. The smoke reading remains in Atlas under the seven-day telemetry TTL. The test also issued an identical retry to confirm idempotency; it did not create a second telemetry reading. It did not upload any raw ACN records. No pre-existing application records or other collections were deleted.

### Security and limitations for Phase B handoff

- Root `.env` and `data/raw/acn/` remain ignored and untracked; populated connection strings, passwords and private ingestion keys are never reported or committed. The runtime requires `INGEST_API_KEY` outside `NODE_ENV=test`; protected ingestion rejects a missing or invalid key. Read-only analytics currently have no authentication and should remain local/trusted until authorization controls are added.
- Receipt-based idempotency handles ordinary same-payload retries within receipt retention. It does **not** imply a globally exactly-once transactional guarantee: a crash between receipt/telemetry writes may leave a `PENDING` receipt, and ambiguous failed writes require reconciliation or manual operator action. Batch writes are sequential and can partially succeed. Events replayed with changed start time or mapping have changed fingerprints and can conflict with the same event ID.
- The Atlas Free tier, demonstration retention policy and bounded queries are intended for a hackathon-scale prototype, not continuous production ingest. Time-series indexes are non-unique and enforced receipt identity is on a regular collection.
- The five ACN samples have known gaps/resetting energy, missing pilot/voltage/power and no temperature. The application derives `chargingState` from `currentA > 0.5 A`, explicitly marked as an assumption. Source sessions must not be represented as five distinct physical connectors.
- **Outstanding:** clarify ACN source reuse/redistribution permission before executing or sharing replay payloads, and verify Datadog trial/site coverage before Phase B. Actual Datadog instrumentation, Next.js dashboard, incident operator workflows and failure-scenario demonstration are not Phase A deliverables and remain unimplemented.

**Handoff:** The implemented Phase A backend is ready for Phase B development, with documented dataset-permission and Datadog activation dependencies. This is verified backend readiness; it does not claim the full hackathon MVP is complete.

## Datadog integration verification — 19 October 2026, ICT

**Current result: application metrics and JSON logs observed in Datadog US1.** Phase A code exists and automated verification now passes **14 unit tests, 9 integration tests, typecheck and production build on Node 24 LTS**. Added bounded DogStatsD metrics, safe framework/application JSON logs, HTTP rejection/latency middleware, new-event and duplicate instrumentation, a macOS Agent file integration installer, and an opt-in synthetic smoke command. Details and metric names: [Datadog implementation report](DATADOG_PREPARATION.md#implemented-integration-and-verified-us1-results--19-october-2026).

Actual US1 Metrics Summary showed the ingestion success/failure, current, operational-status, simulated-fault, accepted/duplicate families plus five generated latency histogram series. Current metric details confirmed service/env and bounded demo/provenance tags. US1 Log Explorer showed **23 parsed ChargeGuard records**, including a synthetic fault at **09:12:49.008 ICT** with env dev and warning status. These were real HTTP application operations with synthetic input and a **disposable local MongoDB**, not uploaded ACN measurements. Two successful local smoke runs each used three new synthetic events, one duplicate retry, one missing-key rejection and one invalid-current rejection. Fixture data was cleaned up locally.

**New Atlas blocker, not a backend regression:** the attempted Atlas-backed smoke could not reach readiness. DNS SRV and TCP 27017 pass on all three nodes; verified TLS on every node returns `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`, causing driver server-selection failure before authentication. No authenticated ping or Atlas writes succeeded in this run, and the earlier 18 Oct success does not establish present connectivity. No MongoDB account, network rule or TLS verification setting was changed. Privately verify the existing exact authorized egress IP, cluster readiness and network path, then retry the approved connection and Atlas smoke. No automatic credential reset or broad IP rule is warranted by this evidence.

The existing Agent site is US1, and the authenticated account displayed 14 trial days remaining. The owner ran the reviewed local sudo installer because privileged conf.d writes/restart were unavailable to this session. The first repository-log attempt was blocked by macOS removable-volume privacy (`operation not permitted`); changing the application file destination to `/usr/local/var/log/chargeguard/api.jsonl` resolved collection without weakening OS protections. The Agent tails only the new ChargeGuard file integration. No API key was copied into the application or printed. A missing local ingestion key was generated privately; nonsecret DogStatsD/log options were added to the ignored local .env.

Security: .env, raw ACN and local logs stay out of Git. The logger allowlists event names/fields, omits raw secrets/errors/payloads and rotates its file at 5 MiB with one backup. Event/session IDs and arbitrary station/charger IDs are never metric tags. Paid upgrades, final dashboards and monitors were not created or enabled. Dataset reuse permissions remain unresolved independently. **Instrumentation handoff is ready; current Atlas end-to-end readiness remains blocked by transport TLS.**
