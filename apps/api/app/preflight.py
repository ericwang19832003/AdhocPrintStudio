"""Deterministic pre-run data checks. No AI involved.

Row numbers in issues are 1-based (matching what users see in a spreadsheet).
"""
from __future__ import annotations

import re
from typing import Any

from app.print_output import _resolve_mailing_line

# Mailing lines the inserter hardware requires to route mail. Values in
# tle_columns may be plain column names (legacy) or "{Col} {Col}" templates.
REQUIRED_TLE = {
    "mailing_name": "recipient name",
    "mailing_addr1": "street address",
    "mailing_addr3": "city/state/ZIP",
}

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
    required = [
        (key, label, tle_columns[key])
        for key, label in REQUIRED_TLE.items()
        if tle_columns.get(key)
    ]
    name_template = tle_columns.get("mailing_name")
    # Columns already covered by required-line checks: don't warn about them
    # again in the mapped-column loop. Both the raw value (exact column names,
    # including headers that contain braces) and any parsed tokens are
    # excluded — over-inclusion only suppresses duplicate warnings.
    required_columns: set[str] = set()
    for _, _, template in required:
        required_columns.add(template)
        if "{" in template:
            required_columns.update(re.findall(r"\{([^{}]+)\}", template))

    empty_counts: dict[str, int] = {}
    caps_count = 0
    for index, row in enumerate(rows, start=1):
        for key, label, template in required:
            if not _resolve_mailing_line(template, row):
                if empty_counts.get(key, 0) < MAX_REPORTED_PER_CHECK:
                    issues.append(
                        {
                            "row": index,
                            "field": template,
                            "severity": "error",
                            "message": f"Required mailing field ({label}) is empty.",
                        }
                    )
                empty_counts[key] = empty_counts.get(key, 0) + 1
        for col in mapped_columns:
            if col in required_columns:
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
        if name_template:
            value = _resolve_mailing_line(name_template, row)
            if len(value) > 3 and value.isupper():
                if caps_count < MAX_REPORTED_PER_CHECK:
                    issues.append(
                        {
                            "row": index,
                            "field": name_template,
                            "severity": "warning",
                            "message": (
                                "Recipient name is in ALL CAPS — it will print "
                                "that way on the letter."
                            ),
                        }
                    )
                caps_count += 1
    return issues
