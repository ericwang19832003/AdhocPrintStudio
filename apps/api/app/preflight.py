"""Deterministic pre-run data checks. No AI involved.

Row numbers in issues are 1-based (matching what users see in a spreadsheet).
"""
from __future__ import annotations

from typing import Any

# TLE fields the inserter hardware requires to route mail.
REQUIRED_TLE = {"mailing_name", "mailing_addr1", "mailing_addr3"}

MAX_REPORTED_PER_CHECK = 50


def run_checks(
    *,
    rows: list[dict[str, str]],
    mapped_columns: list[str],
    tle_columns: dict[str, str],
) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    # Dedupe while preserving order — duplicate mapped columns would otherwise
    # produce duplicate warnings and burn the per-column cap twice as fast.
    mapped_columns = list(dict.fromkeys(mapped_columns))
    required_cols = sorted(
        {tle_columns[k] for k in REQUIRED_TLE if tle_columns.get(k)}
    )
    name_col = tle_columns.get("mailing_name")

    empty_counts: dict[str, int] = {}
    caps_count = 0
    for index, row in enumerate(rows, start=1):
        for col in required_cols:
            if not (row.get(col) or "").strip():
                if empty_counts.get(col, 0) < MAX_REPORTED_PER_CHECK:
                    issues.append(
                        {
                            "row": index,
                            "field": col,
                            "severity": "error",
                            "message": f"Required mailing field '{col}' is empty.",
                        }
                    )
                empty_counts[col] = empty_counts.get(col, 0) + 1
        for col in mapped_columns:
            if col in required_cols:
                continue
            if not (row.get(col) or "").strip():
                if empty_counts.get(col, 0) < MAX_REPORTED_PER_CHECK:
                    issues.append(
                        {
                            "row": index,
                            "field": col,
                            "severity": "warning",
                            "message": f"Mapped column '{col}' is empty — the letter will have a blank.",
                        }
                    )
                empty_counts[col] = empty_counts.get(col, 0) + 1
        if name_col:
            value = (row.get(name_col) or "").strip()
            if len(value) > 3 and value.isupper():
                if caps_count < MAX_REPORTED_PER_CHECK:
                    issues.append(
                        {
                            "row": index,
                            "field": name_col,
                            "severity": "warning",
                            "message": (
                                "Recipient name is in ALL CAPS — it will print "
                                "that way on the letter."
                            ),
                        }
                    )
                caps_count += 1
    return issues
