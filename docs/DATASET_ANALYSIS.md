# ACN-Data research and feasibility — 2026-10-14

**Phase:** research only. **Session files downloaded/inspected in this workspace:** 0. A local attempt to probe the external resources was blocked by the connected execution tool's safety review; network availability itself was **not** established. No numerical measurement, column distribution or gap statistic is claimed from a local record.

## Sources and access paths

1. **Caltech official ACN-Data portal:** https://ev.caltech.edu/dataset (canonical page also reachable as https://ev.caltech.edu/dataset.html). Its published documentation describes browsing/exporting JSON in the web interface, a registered-token REST API and an `acnportal` Python client. The REST API endpoints are `https://ev.caltech.edu/api/v1/sessions/<site_id>` (session metadata) and `/api/v1/sessions/<site_id>/ts` (timeseries). Site IDs documented there are `caltech`, `jpl`, `office001`. The page requests registration for API usage and cautions to use the expensive `/ts` endpoint only when needed. Do not bypass its token requirement.
2. **Public static research export:** https://github.com/tongxin-li/ACN-Data-Static . The published README describes each time-series session as a separate **gzip-compressed CSV**, under `time series data/{site}/{EVSE}/...`. It names `Charging Current (A)` and `Actual Pilot (A)` as columns and describes an ISO-8601 timestamp in the first column. The `session data/caltech_sessions.json` file is described as empty in the current checkout, so it cannot be used as a substitute for a full session metadata dump. These are **documentation observations**, not assertions verified by opening a downloaded file.
3. Dataset static author describes it as a preliminary/static benchmark export: https://tongxin.me/datasets/ . Its repository is separate from the official live portal; do not assume identical schemas or matching timestamps.

## Field inventory (documentation-derived, pending sample validation)

| Signal | Official session API documentation | Static CSV README | Data category / ChargeGuard implication |
| --- | --- | --- | --- |
| Time | `connectionTime`, `disconnectTime`, `doneChargingTime`; timeseries `timestamps` | ISO-8601 timestamp column | Recorded time, distinguish source timestamp from replay time. |
| Current | `chargingCurrent` timeseries | `Charging Current (A)` | Observed electrical current; **per-row measurement not yet locally verified**. |
| Pilot | `pilotSignal` timeseries | `Actual Pilot (A)` | EVSE pilot limit/control signal, **not measured charge current**. |
| Energy | `kWhDelivered` session-level `float` | Not confirmed | Recorded session total, **not a per-sample energy measurement**. |
| Voltage | Not listed as a supplied field | Not confirmed | Must omit or explicitly assume/generate; never claim measured voltage. |
| Power | Not listed as a supplied field | Not confirmed | Can be **derived** only with justified voltage/phase/power-factor assumptions; do not label source-measured power. |
| Temperature | Not listed | Not confirmed | Synthetic only for overheating demonstration. |
| Fault code, connectivity, charging state | Not listed | Not confirmed | Clearly labeled synthetic or heuristic status; no hardware fault ground truth. |
| Site, station, space, session IDs | `siteID`, `stationID`, `spaceID`, `sessionID` | Suggested by directory/file naming | Treat as source identifiers, never represent them as device ownership or user identities. |
| User inputs | `userInputs` and optional `userID` | Not confirmed | Exclude from demo and raw exports; may be personal or linkable. |

Official API describes its datetime strings as **RFC 1123 in UTC/GMT**, with a separate site `timezone` field (pytz names). The portal warns of a **historic pre-2019-10-10 web-export timezone error** (7–8 hour offset); direct API and current Python interface are described as unaffected. Static README states ISO-8601; whether individual timestamps carry an explicit offset **cannot be confirmed without opening real files**. Never silently assume naïve timestamps are UTC. Sources: https://ev.caltech.edu/dataset.html and https://github.com/tongxin-li/ACN-Data-Static/blob/main/README.md .

## Actual data-quality inspection

| Requested check | Result at 2026-10-14 |
| --- | --- |
| Files/charging sessions opened | **0; BLOCKED** |
| Exact CSV/JSON keys and parsed values | **UNVERIFIED** (above inventory comes from published docs) |
| Null/empty counts | **UNVERIFIED** |
| Actual sampling interval and gaps | **UNVERIFIED** |
| Current distribution and negative values | **UNVERIFIED** |
| Timestamp offset and daylight saving behavior | **UNVERIFIED** |
| Energy consistency versus integrated current | **UNVERIFIED** (voltage assumptions required) |
| Unexpected duplicates and outliers | **UNVERIFIED** |

**Research utility:** `scripts/research/inspect_acn.py` reads downloaded `.csv`, `.csv.gz`, `.json`, `.json.gz` files offline, prints field names, inferred types, missingness, numeric min/max and timestamp spacing. Its output does not print identifying field values. A data source's date/time semantics must still be reviewed manually.

## Responsible small-sample acquisition (manual path)

1. Use https://github.com/tongxin-li/ACN-Data-Static in a browser, open `time series data/caltech/` and choose **one EVSE directory**. Pick 3–5 small `.csv.gz` session files from that directory, noting the repository commit SHA, repository path and source page link. Download via each file's **Download raw file** button. Do not bulk-clone the entire dataset for this task.
2. Place the 3–5 downloaded files in `data/raw/acn/` (this directory is ignored by Git). Files can be in subfolders. Avoid the empty session metadata file.
3. Run `python3 scripts/research/inspect_acn.py data/raw/acn --max-sessions 5` and record the field/missingness/timestamp summary. Inspect any column ambiguities locally; do **not** publish original `userID`, VIN, user inputs or identifiable full sessions.
4. Alternatively, register at https://ev.caltech.edu/dataset.html to obtain a token. Use the web export for a 3–5-session subset or API `sessions/caltech` for metadata. For current traces, obtain `/ts` through the authorized API with a tightly filtered request; the documented API returns **one session per page** for time-series requests. Keep credentials outside files and shell history.
5. Verify the license/permission statement with the maintainer or explicit source terms before any redistribution. If no explicit permission is found, keep all raw files **locally only**; publish source links, aggregate stats and schema-level findings instead.

## Decisions for implementation (after 2026-10-17)

- Use **source current readings**, if confirmed, as historical replay inputs. Preserve original event timestamps.
- Treat `pilotSignal` as the available current limit, not delivered current.
- Keep session total `kWhDelivered` distinct from per-sample values; never interpolate measured energy without labeling the method.
- Simulate temperature, fault codes, connectivity failure and operator state transitions as `SYNTHETIC` with deterministic scenarios.
- If power charts are needed, label results `DERIVED` and record voltage, phases and power-factor assumptions; otherwise chart current directly. Do not invent raw voltage measurements.
- Match 5–10 **virtual connectors** to sampled sessions at demo time, without claiming these reflect a real geographic network.

## Open questions

Actual columns/CSV compression/time offsets, file-level schema, missingness and sample cadence require downloaded-session inspection. Reuse terms and any redistribution permissions remain **UNVERIFIED**. This preparation does not authorize raw-data publication.
