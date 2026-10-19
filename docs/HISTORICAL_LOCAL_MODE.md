# Local historical analysis — 19 October 2026

## Verified scope and observations

This mode reads the five existing ignored ACN gzip CSVs through the existing `LocalAcnCsvAdapter`. It is separate from NestJS ingestion, MongoDB, DogStatsD, application log forwarding and synthetic incident controls. No historical row was uploaded to Atlas/Datadog in this task. No raw data, original source-session mapping, trace screenshots or numerical time-series arrays are committed.

Pinned export revision: `abb7cf15cc7108913e965d4375cc7270d532b65f`. All five compressed-file SHA-256 hashes, byte counts, exact headers and source-row counts matched `data/raw/acn/manifest.local.json`. The private audit is `data/raw/acn/audit-current.local.json`.

| Local alias | Parsed source rows | Selected at ≥60 source seconds | Hash check |
| --- | ---: | ---: | --- |
| sample_01 | 2,807 | 172 | MATCH |
| sample_02 | 3,493 | 215 | MATCH |
| sample_03 | 1,078 | 68 | MATCH |
| sample_04 | 2,782 | 172 | MATCH |
| sample_05 | 10,068 | 619 | MATCH |
| Total | 20,228 | 1,246 | 5 / 5 MATCH |

The seven exact CSV headers remain: unnamed timestamp column, `Charging Current (A)`, `Actual Pilot (A)`, `Voltage (V)`, `Charging State`, `Energy Delivered (kWh)`, `Power (kW)`. Current is source-described measured historical current. Exported state/energy are SOURCE_REPORTED with unverified computation lineage. Pilot, voltage and power are empty in every inspected row. Temperature and physical fault records are absent. No missing channel is manufactured or calculated as power in this view.

All timestamps have explicit timezone information. No duplicates or backward timestamps were found within a session. All source timestamps fit JavaScript millisecond precision (zero sub-millisecond timestamps); UTC normalization preserves their instants. Median spacing is four seconds, with 132 gaps over ten seconds and maximum gap 69 seconds. Energy decreases occur 1/1/1/1/2 times (six total). Downsampling can omit a terminal row, so selected last energy is never presented as a validated session total. Quality flags retain decreases detected between selected observations, but do not imply every source reset becomes a selected endpoint.

The five source names share **one exported identifier prefix**. The UI uses `local-evse-01`, never five synthetic connector aliases. Physical device identity has not been independently verified against authorized official session metadata. Do not equate this filename inference with independent physical-EVSE verification.

## Local execution

Use Node 24. Raw samples and their private manifest must already exist at `data/raw/acn/`; they are not included in Git. From the repository root:

```bash
npm --prefix apps/api run historical:check
npm --prefix apps/api run replay:acn -- \
  --file data/raw/acn/sample_01.csv.gz \
  --file data/raw/acn/sample_02.csv.gz \
  --file data/raw/acn/sample_03.csv.gz \
  --file data/raw/acn/sample_04.csv.gz \
  --file data/raw/acn/sample_05.csv.gz \
  --max-events 1000 --min-interval-seconds 60 \
  --start-time 2026-10-19T00:00:00Z
CHARGEGUARD_HISTORICAL_LOCAL=true NEXT_TELEMETRY_DISABLED=1 npm --prefix apps/web run dev
```

The replay command above is **dry-run**, without `--execute`. It validated all 1,246 selected readings through the telemetry schema. The local helper parsed all 20,228 source rows. Neither command requires MongoDB credentials or contacts a cloud sink.

Open `http://127.0.0.1:3000/history`. The page has three explicit provenance descriptions: ACN_REPLAY for historical current, DERIVED for the application current-threshold heuristic, and a separate link to SYNTHETIC incident controls. Source state remains distinct from the derived application state. Use the session selector, Play/Pause and scrubber to inspect the local trace. There is no upload/export/fault button in this mode.

Original recording instants remain in `sourceEventAt` and on the chart X axis. `replayAt` maps source elapsed time to a fixed **demonstration** anchor, `2026-10-19T00:00:00Z`, compressed by the selected source-seconds/replay-second ratio. It is not the recording date or live hardware time. The client timer may slow in background tabs; it is a demonstration cursor, not a production pacing guarantee. Re-reading the same selection/parameters produces identical IDs and payloads, with no persistence or duplicate writes. Different clock speeds preserve event identities and original times while changing the explicitly mapped replay clock.

## Isolation and failure behavior

`GET /api/historical` requires opt-in, loopback Host/URL, compatible same-origin fetch headers and `NODE_ENV=development`. Production always denies the route, even with the flag enabled. It accepts only five aliases and bounded speed; paths/URLs cannot be supplied. Responses are private/no-store, unsupported methods return 405, and errors omit source identifiers and paths. A changed hash, missing file, malformed inventory or parser error fails closed. Next's output-file tracing excludes `data/raw`, so raw records are not deployment assets. The existing `/api/v1` BFF and synthetic lifecycle are unchanged.

The server imports only the pure local adapter/reader. It does not instantiate NestJS, load database keys, call telemetry ingestion or use the observability service. UI controls modify browser state or make the dedicated local GET request. Existing synthetic operational pages may independently poll Atlas when opened; historical rows never flow through those routes.

The local viewer is an engineering inspection tool, not a public-data license. Avoid external screen-sharing, screenshots containing source traces, exported arrays and cloud recording until the corresponding permission is confirmed. Tests use small generated CSV fixtures, explicitly identified as synthetic test inputs.

## Permissions audit

Sources checked on 19 October 2026:

- [Official dataset portal](https://ev.caltech.edu/dataset.html): researcher access, registered-token API, `stationID` as EVSE identifier and a historical web-export timezone warning. Explicit offsets alone do not independently prove historical clock correctness; this implementation does not apply an unsubstantiated offset correction.
- [Official registration](https://ev.caltech.edu/register): educational/research-purpose restriction. Registration is required for API use; no account was created or terms accepted automatically.
- [Pinned static README](https://github.com/tongxin-li/ACN-Data-Static/blob/abb7cf15cc7108913e965d4375cc7270d532b65f/README.md): no standalone license grant, refers users to official terms before redistribution. A public root metadata check found no standalone license/copying file at that revision.

| Intended use | Current permission finding | Required before expanding use |
| --- | --- | --- |
| Private local educational/research inspection of already held samples | Fits the stated research intent, but the exact static-export grant and the owner's registration basis are not independently established | Owner records the applicable access/research basis and follows source terms; current task authorizes local engineering work, not intellectual-property rights |
| Local read-only visualization | Private engineering mode implemented; not an authorization for public presentation | Keep on loopback; clarify any restrictions on displaying identifiable source traces |
| Atlas processing/storage | NOT CONFIRMED | Obtain explicit scope covering managed third-party processing, retention, allowed fields and relevant dataset copies |
| Datadog metrics/log processing | NOT CONFIRMED, including source-derived measurements | Obtain scope covering this provider and derived numerical signals; keep trace/user/session data out of logs |
| Public plots, video/screen-share, screenshots, hosted visualizations | NOT CONFIRMED | Clarify display/derivative-work scope, attribution and privacy requirements before publishing |
| Raw redistribution, Git fixtures, downloadable traces | NOT CONFIRMED | Obtain a source-owner grant covering redistribution and licensing conditions; public download alone is insufficient |

These are engineering release gates, not a legal determination or a newly granted license. Citation to Lee, Li and Low, ACM e-Energy 2019, is required as requested by the source but does not itself grant redistribution.

## Additional genuinely different EVSEs

Only public GitHub directory **metadata**, not new source CSV contents, was fetched. At the pinned revision, `time series data/caltech/LIGO_01` returned **229 CSV names with eight distinct pre-timestamp identifier prefixes**, below the 1,000-entry API listing cap. This is a candidate pool for broader coverage, not a claim of eight independently validated physical devices. Existing local samples still represent one prefix and no additional sessions were downloaded.

A lawful acquisition plan is to confirm source terms and research eligibility, obtain any required API registration/token through the owner, request limited session metadata filtered by distinct official `stationID`, and fetch only explicitly authorized time series. Validate stationID-to-filename mapping and document new hashes/selection criteria before adding samples. Do not use generated IDs or sessions from one prefix to inflate physical coverage. Do not bypass API registration or bulk-fetch `/ts`.

## Enabling an authorized Atlas replay later

1. Obtain and document the source owner's grant/clarification for both Atlas and Datadog processing. Resolve public-display/redistribution separately.
2. Privately create ignored `data/raw/acn/cloud-permission.local.json` only after owner review. It must record `status: OWNER_CONFIRMED`, the pinned `revision`, nonempty `evidenceReference`, `allowedUses` containing `atlas-processing` and `datadog-processing`, and a `sha256` array covering each selected file.
3. This record is an owner attestation, not automatic legal verification. No valid approval record was created in this task. The CLI rejects `--execute` before reading DB/API configuration or sending requests if the record/scopes/content hashes are missing.
4. Review minimization/provenance, explicitly approved virtual mapping, stable fixed start time and the replay's future-time validation/pacing limits. Begin with one source session: the existing CLI restarts its mapped anchor per file, so multi-file execution can overlay sessions on one virtual asset. A sequential schedule needs documented offsets/mapping and idempotency review. Re-test a small dry-run first. Different start times with the same event IDs conflict with existing ingestion fingerprints.
5. Then, only in the authorized environment, start the protected API and intentionally use `--execute --start-time <fixed-ISO-time>`. Verify source labels and bounded metric tags, and retain the scope/permission evidence privately. Never run this step merely to demonstrate the new local viewer.

The original Phase D evidence/incident, synthetic monitor queries and ALERT/OK observations remain unchanged. No new live Datadog incident is claimed by local historical tests.

## Current verification results

Node 24: **29 API unit tests and 11 API integration tests PASS**, API typecheck/build PASS; web lint/typecheck/build and **4 BFF/local-policy tests PASS**. Fixture tests cover deterministic/content-addressed identities, separate clocks, missing sensors, zero energy, counter decreases, malformed/duplicate headers, corrupt gzip, invalid skipped rows, hash changes, traversal/speed rejection, cloud-permission scope and zero fetch calls in the local reader.

Live loopback checks: valid historical read 200 with private/no-store headers, invalid aliases/path/query 400, external Origin 403 and POST 405. A local production-server test returned **403 even with CHARGEGUARD_HISTORICAL_LOCAL=true**. Twelve output tracing manifests contained zero raw source-file entries. Browser QA inspected only boolean/aggregate results: chart rendered, all three provenance descriptions present, source/replay clocks labeled, Play/Pause advanced the local cursor, session switching reset it, and no desktop document overflow. No trace screenshot or raw chart data was exported by QA.

The original Phase D evidence file is byte-for-byte unchanged. A read-only check still found incident demo-58a1983cae09 RESOLVED with four actions. No cloud replay or new monitor cycle was attempted. These are local/regression checks, not a new claim of live Datadog alert delivery.
