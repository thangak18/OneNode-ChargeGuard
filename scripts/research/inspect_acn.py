#!/usr/bin/env python3
"""Offline ACN-Data sample inspector. No network, credentials or ingestion.

Supported inputs: .csv, .csv.gz, .json and .json.gz, either directly or under a
directory. Prints aggregate information only, omitting record-level IDs and
user-provided fields. This script never modifies input files.

Usage: python3 scripts/research/inspect_acn.py data/raw/acn --max-sessions 5
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
from collections import Counter
from datetime import datetime, timezone
from itertools import islice
from pathlib import Path
from statistics import median
from typing import Any


def open_text(path: Path):
    if path.suffix.lower() == ".gz":
        return gzip.open(path, "rt", encoding="utf-8-sig", newline="")
    return path.open("r", encoding="utf-8-sig", newline="")


def candidate_files(root: Path) -> list[Path]:
    if root.is_file():
        return [root]
    if not root.is_dir():
        raise FileNotFoundError("Input path does not exist")
    return sorted(
        p for p in root.rglob("*")
        if p.is_file() and not p.name.endswith('.local.json') and (
            p.suffix.lower() in (".csv", ".json")
            or (p.suffix.lower() == ".gz" and p.with_suffix("").suffix.lower() in (".csv", ".json"))
        )
    )


def parse_timestamp(value: Any) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    txt = value.strip()
    try:
        dt = datetime.fromisoformat(txt.replace("Z", "+00:00"))
        # Refuse to invent a timezone for naive source timestamps.
        return dt if dt.tzinfo is not None and dt.utcoffset() is not None else None
    except ValueError:
        pass
    try:
        from email.utils import parsedate_to_datetime
        dt = parsedate_to_datetime(txt)
        return dt if dt.tzinfo is not None and dt.utcoffset() is not None else None
    except (TypeError, ValueError):
        return None


def is_missing(value: Any) -> bool:
    return value is None or (isinstance(value, str) and value.strip().lower() in ("", "null", "nan", "na", "none"))


def kind(value: Any) -> str:
    if is_missing(value):
        return "missing"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, (list, tuple)):
        return "array"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, str):
        if parse_timestamp(value) is not None:
            return "datetime-string"
        try:
            numeric = float(value)
            if math.isfinite(numeric):
                return "numeric-string"
        except ValueError:
            pass
    return "string"


def read_records(path: Path, max_rows: int) -> list[dict[str, Any]]:
    base_suffix = path.with_suffix("").suffix.lower() if path.suffix.lower() == ".gz" else path.suffix.lower()
    with open_text(path) as handle:
        if base_suffix == ".csv":
            return [dict(row) for row in islice(csv.DictReader(handle), max_rows)]
        if base_suffix == ".json":
            data = json.load(handle)
            if isinstance(data, list):
                return [r for r in data[:max_rows] if isinstance(r, dict)]
            if isinstance(data, dict):
                for key in ("_items", "items", "sessions", "data"):
                    if isinstance(data.get(key), list):
                        return [r for r in data[key][:max_rows] if isinstance(r, dict)]
                return [data]
    raise ValueError("Unsupported file format")


def timestamp_series(records: list[dict[str, Any]]):
    """Keep session/JSON traces separate; never pool current and pilot clocks."""
    series: dict[str, list[Any]] = {}
    for index, row in enumerate(records):
        queue = [(row, '')]
        while queue:
            obj, prefix = queue.pop()
            for name, raw in obj.items():
                if not isinstance(name, str):
                    continue
                if isinstance(raw, dict):
                    queue.append((raw, prefix + name + '.'))
                if "timestamp" not in name.lower() and name.lower() not in ("", "time", "ts", "datetime"):
                    continue
                key = prefix + (name or '<unnamed timestamp>')
                if isinstance(raw, list):
                    key = f'record {index + 1}.' + key
                series.setdefault(key, []).extend(raw if isinstance(raw, list) else [raw])
    return series


def summarize(path: Path, rows: list[dict[str, Any]]) -> None:
    # Never print original filenames because these may include station/session IDs.
    print("  Records inspected (bounded by --max-rows):", len(rows))
    fields = sorted({k for row in rows for k in row})
    print("  Fields (name | observed type counts | missing record count):")
    for name in fields:
        values = [row.get(name) for row in rows]
        types = dict(sorted(Counter(kind(v) for v in values).items()))
        print("   ", json.dumps(name), "|", types, "|", sum(is_missing(v) for v in values))
    series = timestamp_series(rows)
    if not series:
        print('  Sampling gap: UNDETERMINED (no timestamp series found)')
    for label, values in series.items():
        parsed = [parse_timestamp(v) for v in values]
        valid = [t.astimezone(timezone.utc) for t in parsed if t is not None]
        # Consecutive gaps preserve row order and do not bridge invalid timestamps.
        deltas = [(b - a).total_seconds() for a, b in zip(parsed, parsed[1:])
                  if a is not None and b is not None]
        positive = [d for d in deltas if d > 0]
        print('  Timestamp series:', json.dumps(label), 'explicit-offset:', len(valid),
              'missing/naive/invalid:', len(values) - len(valid),
              'duplicate timestamps:', len(valid) - len(set(valid)),
              'backward steps:', sum(d < 0 for d in deltas))
        print('  Consecutive gaps (seconds):', dict(sorted(Counter(deltas).items())))
        print('  Median positive gap (seconds):', median(positive) if positive else 'UNDETERMINED')
    for name in fields:
        low = name.lower()
        if any(tag in low for tag in ("current", "pilot", "power", "voltage", "energy", "kwh", "temp", "status")):
            vals = [row.get(name) for row in rows]
            numbers = []
            for v in vals:
                try:
                    if not is_missing(v) and not isinstance(v, (dict, list, bool)):
                        n = float(v)
                        if math.isfinite(n):
                            numbers.append(n)
                except (TypeError, ValueError):
                    pass
            print("  Measurement candidate:", json.dumps(name), "numeric_observations:", len(numbers),
                  "min:", min(numbers) if numbers else "n/a", "max:", max(numbers) if numbers else "n/a")
            if 'energy' in low and len(numbers) == len(rows):
                print('  Energy decreases:', sum(b < a for a, b in zip(numbers, numbers[1:])),
                      'final value:', numbers[-1] if numbers else 'n/a')
        if low in ('charging state', 'status'):
            print('  State counts:', dict(Counter(str(row.get(name)) for row in rows)))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path, help="Single file or local sample directory")
    parser.add_argument("--max-sessions", type=int, default=5, help="Maximum files to inspect (default: 5)")
    parser.add_argument("--max-rows", type=int, default=100000, help="Maximum records per file (default: 100000)")
    args = parser.parse_args()
    if args.max_sessions < 1 or args.max_rows < 1:
        parser.error("limits must be positive")
    try:
        files = candidate_files(args.path)
    except FileNotFoundError as exc:
        parser.error(str(exc))
    if not files:
        print("No supported local sample files found. No records inspected.")
        return 2
    successes = 0
    for i, path in enumerate(files[: args.max_sessions], start=1):
        print(f"Sample file {i} of {min(len(files), args.max_sessions)}:")
        try:
            summarize(path, read_records(path, args.max_rows))
            successes += 1
        except (OSError, ValueError, json.JSONDecodeError, csv.Error) as exc:
            print("  ERROR:", type(exc).__name__, "(unable to read sample)")
    print("Files successfully inspected:", successes)
    print("Note: A CSV file is treated as one session ONLY when exported as a per-session file.")
    return 0 if successes == min(len(files), args.max_sessions) else 1


if __name__ == "__main__":
    raise SystemExit(main())
