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
