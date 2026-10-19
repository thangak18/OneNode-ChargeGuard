# Data sourcing and validation plan

## Public data candidates
1. Caltech **ACN-Data:** https://ev.caltech.edu/dataset
2. **ACN-Data Static** mirror/derivative: https://github.com/tongxin-li/ACN-Data-Static

**Action before ingestion:** inspect the exact sample format, scope, acquisition method, usage terms and field availability. Do not assert that every version has voltage, per-sample power or state without checking actual files. If only current readings are available, label any voltage/power calculation and its assumptions.

## Provenance rules
- `ACN_REPLAY`: historic source readings replayed at accelerated time.
- `DERIVED`: computed values (include formula and assumptions).
- `SYNTHETIC`: generated temperature, connectivity faults, alerts and artificial anomalies.
- Store both original event time and replay/ingestion time when possible.
- Preserve source URL, source session ID, dataset version/date, transform script version.

## Initial exploration (14–16 Oct)
- Download a small authorized subset, inspect field types and missingness.
- Decide session/connector mapping and replay cadence.
- Document schema examples based on real rows, anonymize any identifying fields.
- Confirm use and redistribution permissions; keep raw datasets outside git until verified.
- Define two seeded deterministic incident scenarios.

## Data quality risks
Missing samples, mixed time zones, nonuniform sampling, session gaps, uncertain rated capacity. Document assumptions explicitly. Synthetic faults must never be presented as observed hardware failures.

## Verified preparation follow-up — 18 October 2026

Five pinned static sessions, 20,228 rows inspected locally. Current/state/energy populated; pilot/voltage/power completely missing in these samples. Source state is separate from app status; energy resets prevent using the last row as session energy. Median timestamp spacing 4 s with gaps to 69 s. See [analysis](DATASET_ANALYSIS.md), [dictionary](DATA_DICTIONARY.md) and [provenance](DATA_PROVENANCE.md). Raw data remain local and ignored; usage permissions unresolved. No replay or simulator implemented.

## Local historical follow-up — 19 October 2026

The historical preparation/proposal statements above are preserved as dated context. The existing ACN adapter now powers an isolated opt-in local read-only UI at `/history`. Current implementation and permission findings are recorded in [Historical Local Mode](HISTORICAL_LOCAL_MODE.md). All five hashes were rechecked: 20,228 rows parsed and 1,246 readings selected at ≥60-second spacing. One exported prefix remains, with no independently confirmed physical-device identity. No historical records were sent to Atlas/Datadog; raw files/mappings remain ignored. Eight candidate prefixes were found in 229 public LIGO filename metadata entries, without downloading additional sessions.

Actual field provenance uses `provenance.fields` (MEASURED, SOURCE_REPORTED, DERIVED, SYNTHETIC) and `provenance.assumptions`, rather than the older proposed syntheticFields/derivedFields lists. Local points retain normalized original UTC `sourceEventAt` and explicitly mapped `replayAt`. Current is source-described measured; source state/energy are reported; application charging state is derived from current >0.5 A. No local voltage, power, temperature or physical fault channel is generated. The official registration restricts use to education/research; public traces, redistribution and third-party processing grants have not been established.
