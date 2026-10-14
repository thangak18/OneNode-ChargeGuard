# ChargeGuard — pre-hackathon preparation status

**Report date:** 2026-10-14 (ICT / UTC+7). **Team:** OneNode (solo). **Judged build window:** **2026-10-17 through 2026-10-31**. This report is a factual snapshot, not a certification of infrastructure readiness.

## Completed preparation

- Audited `README.md` and five existing `docs/` files. Repository initially contained **only planning documents**, no production application, and the local Git working tree was clean at the start of the audit. GitHub repository visibility verified **private** and Issues #1–#8 present.
- Documented **published**, rather than locally measured, ACN field availability, JSON/web/API access and static CSV gzip description. Separated recorded current, pilot setpoint, session energy, derived power and synthetic fault signals. Linked original published resources.
- Added a standalone offline ACN inspection script; created `.gitignore` excluding credentials and `data/raw/`; added `.env.example` with placeholders only.
- Designed the five proposed MongoDB collections, time-series constraints, indexes, aggregation examples, sample-rate capacity model and scoped application database permissions. No application collections were created.
- Drafted Atlas Free manual provisioning and read-only connection verification steps, plus a Datadog monitoring/trial plan. **No cloud provisioning or actual application observability setup.**
- Disclosed AI use in the provenance and preparation documentation.

## Dataset acquisition and findings

| Source | Documentation reviewed | Actual local source files acquired | Sessions/records personally inspected |
| --- | --- | ---: | ---: |
| [Caltech ACN-Data](https://ev.caltech.edu/dataset.html) | Official published API/Fields info | **0** | **0** |
| [ACN-Data-Static](https://github.com/tongxin-li/ACN-Data-Static) | Published static repo README description | **0** | **0** |

Local target: `data/raw/acn/` (ignored; **not populated**). The connected local execution attempt to check external sources was **blocked by a safety-status determination**, before returning an HTTP result. This is **not** proof of network unavailability, API authentication failure or absence of raw data. No downloadable session data was actually inspected.

Published sources say ACN-Data has `chargingCurrent` and `pilotSignal` timeseries, session `kWhDelivered`, and RFC 1123 UTC timestamps in the official API; the static README describes per-session gzip CSV with an ISO timestamp, charging current and actual pilot. **Voltage, power, temperature and fault-state fields have not been verified as source observations.** Per-file types, observed values, nulls, intervals, duplicates and timezone offsets are **UNVERIFIED**. ACN web-export timezone bug was documented for historical exports before 2019-10-10; handle with care. Source details: [official ACN portal](https://ev.caltech.edu/dataset.html), [static export](https://github.com/tongxin-li/ACN-Data-Static), [static author](https://tongxin.me/datasets/).

Dataset-specific reuse license/redistribution permission: **UNVERIFIED**. Do not commit any source traces or user metadata. See `DATASET_ANALYSIS.md`, `DATA_DICTIONARY.md` and `DATA_PROVENANCE.md`.

## MongoDB Atlas and connection status

| Step | Result |
| --- | --- |
| Authenticated Atlas management session | **UNVERIFIED** |
| Project `OneNode-ChargeGuard` | **NOT PROVISIONED/VERIFIED** |
| M0 `ChargeGuardCluster`, AWS Singapore | **NOT PROVISIONED/VERIFIED** (Singapore eligibility to confirm in UI) |
| Scoped DB user, current-IP access rule | **NOT PROVISIONED/VERIFIED** |
| `mongosh`/Compass authenticated connection | **BLOCKED** — no confirmed cluster or secure local credentials |
| Server `ping` and database list | **NOT EXECUTED** |
| Effective read/write role on `chargeguard` | **UNVERIFIED** |

No paid resources, database collections, indexes or backend services were created. For connection verification, use Atlas UI and private credentials; only disclose **sanitized** ping/role outcomes. See `MONGODB_ATLAS_SETUP.md` and `MONGODB_SCHEMA_DESIGN.md`.

## Security and compliance

Repository remains private. `.env`, `.env.*` (except `.env.example`), credentials, certificates, Python runtime files and `data/raw/` are ignored. `.env.example` is placeholders only. This phase adds an **offline inspection utility**, no judged application code. No sensitive sample data was intentionally copied into version control. Datadog trial/activation is **UNVERIFIED**; see `DATADOG_PREPARATION.md`. AI-assisted documents and inspection tooling are disclosed.

## Outstanding issues / architecture inconsistencies

1. **Actual ACN sample:** download 3–5 legally accessible static `.csv.gz` session files and inspect sample timestamps, columns, null counts, sampling intervals and anomalous values.
2. **Dataset permissions:** confirm license and whether derivative demo/trace redistribution is allowed; keep raw files local until authorized.
3. **Atlas Free:** owner must authenticate, review configuration, explicitly approve free resource creation and create an IP-restricted DB identity.
4. **Connection check:** owner must provide secure **local** configuration and execute Compass/mongosh `ping` and role inspection.
5. **Datadog:** owner must confirm free trial activation period and site; no monitoring account status proven.
6. **Naming:** existing `ARCHITECTURE.md` uses **`connectors`**, new requested design uses **`chargers`**. Choose the collection name during build; do not create two equivalent collections by accident.
7. Source data are historical (not live). ACN current and pilot cannot alone demonstrate real overheating, voltage/power, outage root cause, or physical incident-response actions. Represent those as synthetic/inferred.

## Exact manual actions for owner (before / on 17 Oct)

1. Visit [ACN-Data-Static](https://github.com/tongxin-li/ACN-Data-Static), navigate `time series data/caltech/` → an EVSE directory → **3–5 `.csv.gz` files**, download using GitHub's raw-download control, save under `data/raw/acn/` locally and note source commit/paths; run `python3 scripts/research/inspect_acn.py data/raw/acn --max-sessions 5`. Follow the linked instructions in `DATASET_ANALYSIS.md` for official API token access instead if desired.
2. Check whether the source terms grant reuse and redistribution; if uncertain, contact the dataset maintainer and keep raw content offline. Preserve a citation to the exact GitHub commit or API source and retrieval date.
3. Sign in to [Atlas](https://cloud.mongodb.com/) → create project `OneNode-ChargeGuard` → review a **Free/M0** deployment `ChargeGuardCluster` on **AWS Singapore** if offered → grant explicit approval before creation. Add a scoped user with `readWrite` on `chargeguard`, and Network Access restricted to your **current IP**. Keep the URI/password locally in git-ignored `.env`; never send credentials here.
4. Use MongoDB Compass or `mongosh` with interactive password to connect. Run `db.adminCommand({ping:1})` and list accessible databases. Record only sanitized pass/fail and the role from Atlas UI. Note that `chargeguard` need not exist until first write in the judged build window.
5. Confirm Datadog trial activation/status and timing against 17–31 Oct; ask organizers for support if needed. Do not enable paid resources to extend the trial without approval.
6. Confirm to the organizer that pre-17 Oct preparation artifacts are allowed; preserve dated commits for later audit.

## Readiness checklist for official development start: 2026-10-17

| Criterion | Status |
| --- | --- |
| Architecture / MVP and compliance boundaries documented | **YES** |
| Git repository private and preparation-only files isolated | **YES**, subject to final diff/security inspection before commit |
| Documented data sources and source-versus-synthetic policy | **YES** |
| Verified 3–5 actual ACN sessions and allowed reuse terms | **NO** |
| MongoDB M0 provisioned and connection ping verified | **NO** |
| Datadog trial/account verified | **NO** |
| No judged core implementation before 17 Oct | **YES** |

**Overall: NOT YET FULLY READY** for data-backed, cloud-connected development on 17 Oct. The design work is prepared, but dataset verification and Atlas/Datadog owner actions are blocking integration. Core implementation must not begin before the official start, regardless of which preparations finish earlier.
