# ChargeGuard — preparation report

**Updated:** 18 October 2026, ICT / UTC+7. **Team:** OneNode (solo). **Judged build window:** 17–31 October 2026. The pasted task's “today is October 14” is historical; this follow-up is dated accurately. Scope remains preparation only, with no core MVP implementation.

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

## MongoDB Atlas configuration and connection results

| Check | Verified result |
| --- | --- |
| Official Atlas browser access | Reached sign-in callback; displayed identity-provider sign-in error |
| Authenticated management UI | **BLOCKED**; no project/deployment UI reached |
| Project `OneNode-ChargeGuard`, cluster `ChargeGuardCluster` | Existing state **UNVERIFIED**; no creation attempted |
| Free/M0, AWS Singapore | Target documented; account eligibility/price must be reviewed in UI |
| Scoped DB identity / current-IP rule | **UNVERIFIED**, no permission/network changes made |
| Local `.env` | **ABSENT** |
| `atlas`, `mongosh` / default Compass application | Not found in PATH / `/Applications/MongoDB Compass.app` |
| SRV/DNS, TLS, authentication, `ping`, DB listing, effective roles | **BLOCKED / NOT EXECUTED**; no secure local connection configuration |

Sign-in message: “There was a problem signing you into your identity provider. Please contact your administrator for help.” No bypass attempted. HTTPS dataset downloads do not establish MongoDB network connectivity. No paid/free cloud resources, app collections, indexes or runtime logic created. See [Atlas manual setup and verification](MONGODB_ATLAS_SETUP.md) and [schema design](MONGODB_SCHEMA_DESIGN.md).

## Security and verification

- Repository privacy checked through authenticated GitHub CLI; no visibility change.
- `git check-ignore` confirms `.env`, `.env.production` and raw sample paths excluded. No raw dataset or populated `.env` tracked. `.env.example` and `.gitignore` already meet preparation needs and remain unchanged.
- Only documentation and standalone offline research code are included. No new dependencies, credentials, personal identifiers, runtime backend, replay/fault simulator, UI or observability integration.
- Ran inspector over all five files successfully; local output in ignored `inspection.local.txt`. Focused checks passed for unnamed time column, refusal to assign a timezone to naive dates, separation of JSON traces, exclusion of private manifests, and nonzero exit for corrupt gzip input. `git diff --check` passed; reviewed preparation diffs and scanned changed files for credential URI, token and private-key patterns without matches. All five raw-file hashes match the private manifest and raw paths are ignored/untracked.
- AI assisted this follow-up's research, script corrections and documents; no generated measurement is presented as observed data. Earlier 14 October preparation history remains in Git.

## GitHub preparation updates

Posted factual progress to [Issue #1](https://github.com/thangak18/OneNode-ChargeGuard/issues/1#issuecomment-6245506862) and [Issue #2](https://github.com/thangak18/OneNode-ChargeGuard/issues/2#issuecomment-6245507062). Neither issue was closed: dataset permission and Datadog activation remain incomplete. Only aggregate findings and sanitized blockers were posted, not source sessions or credentials.

## Exact remaining owner actions and blockers

1. **Resolve Atlas login** at [official Atlas](https://cloud.mongodb.com/), including any identity-provider/account/MFA requirements. Stop at the reviewed deployment configuration and explicitly approve cloud creation before provisioning.
2. Choose project `OneNode-ChargeGuard`, cluster `ChargeGuardCluster`, **Free/M0 only**, AWS Singapore if offered at zero cost. Decline paid upgrades/add-ons. No resource has been created by this task.
3. Approve and configure a dedicated database user with `readWrite` on **`chargeguard` only**, and a current-IP `/32` rule (not `0.0.0.0/0`). Keep passwords/URI private in local ignored `.env` or a password manager. Do not paste credentials into chat or issues.
4. Connect using official Compass or mongosh with an interactive password prompt. Run `db.adminCommand({ping:1})`, list databases visible to that user, and inspect effective roles locally. Follow commands in the setup document; report only sanitized results. An empty/uncreated `chargeguard` database before writes is normal. No application writes required for this preparation check.
5. Clarify dataset reuse/redistribution permission and exported state/energy semantics with the source maintainer or explicit official terms. Until resolved, keep the five downloaded traces local and do not bundle them into public fixtures/services.
6. Verify Datadog trial activation, site and coverage through 31 October. The existing monitoring plan is documentation only; account/trial status remains **UNVERIFIED**. No email or organizer message sent on the owner's behalf.

## Readiness for official 17 October phase — assessed 18 October

| Criterion | Status |
| --- | --- |
| Architecture, five-collection schema, source/synthetic boundaries documented | Ready as design |
| Five real local sessions inspected and quality limitations documented | Complete |
| Private repository and ignored raw samples/credentials | Verified |
| Dataset reuse/redistribution permission | Pending |
| Atlas Free configuration and authenticated MongoDB connectivity | Blocked |
| Datadog account/trial verification | Pending |
| Core application implementation in this task | None |

**Overall: NOT FULLY READY for cloud-connected integration.** Local dataset research and design preparation are complete; rights clarification, Atlas authentication/provisioning/connection and Datadog verification remain. The official start has already passed; this report does not claim those prerequisites were ready on 17 October.
