# Dataset provenance, permitted use and privacy — updated 2026-10-19

## Source inventory

| Source | Publisher | Format described | Acquisition status | License / redistribution evidence |
| --- | --- | --- | --- | --- |
| https://ev.caltech.edu/dataset.html | ACN-Data, Caltech with PowerFlex | JSON via web UI or authenticated REST/Python API | Website documented; **no locally downloaded sessions** | **Specific reuse/license grant not verified.** Registration requested for API. |
| https://github.com/tongxin-li/ACN-Data-Static | Tongxin Li, static ACN export | Per-session `.csv.gz`, plus session-level export | 5 pinned session files locally downloaded and inspected | **No explicit redistribution grant verified.** Public repository visibility alone does not grant unrestricted redistribution. |

The ACN-Data site explains that data is collected for researchers and says API usage requires registration/token. Respect requests to avoid heavy `/ts` calls. The site reports a historic pre-2019-10-10 web-interface timestamp-offset bug; original timestamps should be inspected, preserved and corrected only with demonstrable source evidence. Do not claim an explicit Creative Commons or MIT license without seeing it in the relevant dataset terms.

## Acquisition record — 2026-10-18

Static commit: `abb7cf15cc7108913e965d4375cc7270d532b65f`. Five files, 20,228 rows, 122,354 compressed bytes. Selected the first five gzip CSV paths returned for `time series data/caltech/California_Garage_01` (convenience sample from one EVSE prefix). Downloaded via public HTTPS raw URLs pinned to that commit. No credentials or login bypass used. Root directory listing contains README and two data directories, no standalone license file; the pinned README states no standalone license and asks users to refer to official terms before redistribution. A citation request is not a redistribution license.

Local copies: `data/raw/acn/sample_01.csv.gz` … `sample_05.csv.gz`. Ignored `manifest.local.json` includes exact original paths/immutable URLs, individual SHA-256 hashes, byte sizes and row counts; `quality.local.json` holds local aggregate audit output. No complete raw records or session identifiers are published in repository documents. No official API JSON acquired.

The populated static current is described as measured by the source. Exported state and energy are **observed source fields with unverified computation lineage**, not automatically certified independent measurements. Energy resets/decreases are retained. Empty pilot/voltage/power columns are not measurements. Future derived power or simulated faults must have field-level provenance.

## Record-level traceability

For each authorized local session file, separately record: immutable source URL, repository commit SHA or API retrieval date, relative source path, local SHA-256 hash, original session ID (private local mapping only), sample count, original timestamp format/timezone, conversion/transform version, and data selection criteria. The local inventory containing identifying raw references belongs under `data/raw/acn/` and must remain untracked.

Suggested field-level audit categories:

- `ACN_REPLAY`: actual historical measurements and source session totals (never call them currently live).
- `DERIVED`: numerical results from source readings with explicit formula, assumptions and units.
- `SYNTHETIC`: generated temperatures, simulated charging states, fault codes, interruptions and operator responses.

Exclude source `userID`, `userInputs`, user-requested departure times and any directly identifying personal data from public demo/logs. ChargeGuard will replay offline sample data to **virtual** connectors after 2026-10-17; no live charger control is planned.

## Redistribution decision

**Pending written or explicitly published permission:** only store unmodified source samples locally in ignored `data/raw/acn/`. Do not commit, publish in Releases, put in demo fixtures or upload raw traces to third-party services. The README and source links may be cited. Store aggregated non-identifying results in project documentation after they are actually computed.

## AI assistance

Dataset research notes, dictionary proposal, safety conditions and offline inspection script were drafted with AI assistance on 2026-10-14; no generated sensor measurement is represented as observed ACN data. Later application work must separately disclose AI assistance and differentiate development-window commits.

AI-assisted follow-up on 2026-10-18: actual sample acquisition, offline quality inspection, inspector repair and documentation updates. No generated sensor values or core application logic added.

## Local historical follow-up — 19 October 2026

The historical preparation/proposal statements above are preserved as dated context. The existing ACN adapter now powers an isolated opt-in local read-only UI at `/history`. Current implementation and permission findings are recorded in [Historical Local Mode](HISTORICAL_LOCAL_MODE.md). All five hashes were rechecked: 20,228 rows parsed and 1,246 readings selected at ≥60-second spacing. One exported prefix remains, with no independently confirmed physical-device identity. No historical records were sent to Atlas/Datadog; raw files/mappings remain ignored. Eight candidate prefixes were found in 229 public LIGO filename metadata entries, without downloading additional sessions.

Actual field provenance uses `provenance.fields` (MEASURED, SOURCE_REPORTED, DERIVED, SYNTHETIC) and `provenance.assumptions`, rather than the older proposed syntheticFields/derivedFields lists. Local points retain normalized original UTC `sourceEventAt` and explicitly mapped `replayAt`. Current is source-described measured; source state/energy are reported; application charging state is derived from current >0.5 A. No local voltage, power, temperature or physical fault channel is generated. The official registration restricts use to education/research; public traces, redistribution and third-party processing grants have not been established.
