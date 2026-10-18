# ACN-Data research and feasibility — updated 2026-10-18

**Scope:** preparation only; no MVP implementation. The original 14 October review acquired no samples. This follow-up downloaded and inspected **5 complete static per-session CSV gzip files (20,228 rows)**. Official API JSON has **not** been downloaded: a registered token is required.

## Sources and access paths

1. **Caltech official ACN-Data portal:** https://ev.caltech.edu/dataset (canonical page also reachable as https://ev.caltech.edu/dataset.html). Its published documentation describes browsing/exporting JSON in the web interface, a registered-token REST API and an `acnportal` Python client. The REST API endpoints are `https://ev.caltech.edu/api/v1/sessions/<site_id>` (session metadata) and `/api/v1/sessions/<site_id>/ts` (timeseries). Site IDs documented there are `caltech`, `jpl`, `office001`. The page requests registration for API usage and cautions to use the expensive `/ts` endpoint only when needed. Do not bypass its token requirement.
2. **Public static research export:** https://github.com/tongxin-li/ACN-Data-Static . The published README describes each time-series session as a separate **gzip-compressed CSV**, under `time series data/{site}/{location}/...`. The current README names current, pilot, voltage, state, energy and power columns and describes an ISO-8601 timestamp in the first column. The `session data/caltech_sessions.json` file is described as empty in the current checkout, so it cannot be used as a substitute for a full session metadata dump. The observations below now distinguish README claims from downloaded-file evidence.
3. Dataset static author describes it as a preliminary/static benchmark export: https://tongxin.me/datasets/ . Its repository is separate from the official live portal; do not assume identical schemas or matching timestamps.

## Actual static-file inspection

Source pinned to [commit abb7cf15cc7108913e965d4375cc7270d532b65f](https://github.com/tongxin-li/ACN-Data-Static/tree/abb7cf15cc7108913e965d4375cc7270d532b65f), downloaded 18 October 2026. Selection: first five `.csv.gz` paths in the GitHub Contents response for `time series data/caltech/California_Garage_01`, excluding `.DS_Store`. These filenames share the same EVSE identifier prefix; this is a convenience sample, **not representative of the whole dataset**. The API directory listing is capped at 1,000 entries; no dataset-wide file count was inferred from it.

Local files: `data/raw/acn/sample_01.csv.gz` through `sample_05.csv.gz`. Private `manifest.local.json` records immutable URLs, original paths, SHA-256, sizes and row counts. Total compressed size: **122,354 bytes**. All raw files, private inventory and local output remain ignored.

| Sample | Rows | Current range A | Median / max gap s | Gaps >10 s | Energy range kWh | Energy decreases |
| --- | ---: | --- | --- | ---: | --- | ---: |
| 01 | 2,807 | 0–30.8 | 4 / 30 | 17 | 0–7.08207083333 | 1 |
| 02 | 3,493 | 0–15.7 | 4 / 27 | 27 | 0–6.49460444444 | 1 |
| 03 | 1,078 | 0–15.9 | 4 / 10 | 0 | 0–4.09114166667 | 1 |
| 04 | 2,782 | 0–29.0 | 4 / 31 | 21 | 0–11.5212047222 | 1 |
| 05 | 10,068 | 0–10.6 | 4 / 69 | 67 | 0–2.03122944444 | 2 |

Observed header: empty first-column name (`""`), `Charging Current (A)`, `Actual Pilot (A)`, `Voltage (V)`, `Charging State`, `Energy Delivered (kWh)`, `Power (kW)`.

- First column: ISO 8601 strings with explicit `+00:00`, e.g. format `YYYY-MM-DDTHH:MM:SS+00:00`. All 20,228 timestamps parse; no duplicate timestamps, backward steps or duplicate complete rows **within each file**. Minimum adjacent gap is 1 second, median 4 seconds in every file; **132 gaps exceed 10 seconds**. Gaps are observed spacing, not proof that a known number of samples was lost. DST behavior is not established by these May samples.
- Current: all 20,228 values are finite numeric strings, no missing or negative values. Source describes this as measured charging current; historical source measurement, not a present-day physical reading.
- Pilot, voltage and power: headers exist, but **20,228/20,228 values are empty in each column**. No usable pilot limits, voltage measurements or source power can be claimed from this subset. README presence does not establish populated measurements.
- Charging state: nonempty source strings, observed labels `READY`, `ADAPTIVE`, `NOT CHARGING`, `IDLE`, `UNPLUGGED`. Retain as `sourceChargingState` if used; documentation does not establish derivation or hardware semantics of each label. These are not labeled fault ground truth or the future application's status enum.
- Energy: finite numeric strings with no missing values, but **not monotonic**. Every file ends at 0 at `UNPLUGGED`; sample 05 has an additional decrease. Preserve source energy and flag decreases; do not overwrite, repair or treat the final value (or maximum) as validated session `kWhDelivered`. Independent meter accuracy and calculation lineage are unverified. Do not infer a voltage from energy/current and label it measured.
- No temperature, fault codes, connectivity events, incident/operator actions, or session-level `kWhDelivered` JSON is supplied by these sampled CSVs. Simulation must generate these demo signals explicitly. App status is synthetic; source state strings remain separate.

Reproduce offline:

```sh
python3 scripts/research/inspect_acn.py data/raw/acn --max-sessions 5
```

The utility now recognizes an unnamed CSV time column, ignores `*.local.json` research inventories during directory scans, keeps separate nested JSON time-series clocks, reports duplicates/backward steps and energy decreases, and returns failure for unreadable files. Limits bound **files and records**, not JSON sessions; output says how many records were inspected. Defaults cover every row of these five files. It does not fetch data, ingest telemetry or simulate faults. No record-level source identifiers are printed.

## Field provenance and implementation implications

| Field | Evidence / category | Future treatment |
| --- | --- | --- |
| Current | Populated static column; source-described measurement | Historical replay with source timestamp |
| Pilot | Column present but entirely missing | Omit; future synthetic limit must be labeled |
| Voltage / power | Columns present but entirely missing | Omit or declare synthetic voltage / derived power and assumptions |
| Source state | Populated exported strings; origin semantics unverified | Keep separate from simulated app status |
| Source energy | Populated exported counter; resets/decreases observed | Preserve and quality-flag; not verified session total |
| Official API `kWhDelivered` | Documentation only, no authorized JSON inspected | Do not populate from last static energy row |
| Temperature, faults, connectivity, operator actions | Not present in sampled files | Explicitly synthetic demo signals |

For optional power, declare AC/DC, phase configuration, voltage and power factor. `V × I × PF / 1000` applies to appropriate single-phase AC; three-phase calculations differ. Current alone does not establish measured power. Do not fabricate missing measurements or interpolate across gaps without a declared method.

## Access, terms and remaining questions

Public pinned GitHub raw URLs returned real gzip CSV without authentication; no bulk clone or official token bypass was used. The official portal describes JSON web export, authenticated REST endpoints and RFC 1123 UTC API timestamps, with a separate site timezone. Its historical web-export timezone warning still warrants care; explicit offsets in these files do not independently prove historical clock correctness. See [official source](https://ev.caltech.edu/dataset.html).

The pinned static repository root has no standalone license file, and its README directs readers to official terms before redistribution. A specific license permitting demo reuse or redistribution is still **unverified**. Keep samples local; obtain permission/clarification before embedding raw traces in fixtures, public demos or third-party services. Cite Lee, Li and Low, *ACN-Data: Analysis and Applications of an Open EV Charging Dataset*, ACM e-Energy 2019. See [provenance](DATA_PROVENANCE.md).

Unresolved: source-state semantics, energy lineage/resets, wider-site coverage, valid pilot samples, permission scope, and validation against authorized official session JSON. Findings describe only these five files.
