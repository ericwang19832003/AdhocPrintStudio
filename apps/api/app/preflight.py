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

    def referenced_columns(template: str) -> set[str]:
        # Raw value included too: exact column names (even brace-containing
        # headers) resolve as plain lookups.
        cols = {template}
        if "{" in template:
            cols.update(re.findall(r"\{([^{}]+)\}", template))
        return cols

    empty_counts: dict[str, int] = {}
    caps_count = 0
    for index, row in enumerate(rows, start=1):
        # Columns whose required-line check errored on THIS row: skip their
        # generic mapped-column warning (it would duplicate the error). A
        # column feeding a line that still resolved fine keeps its warning —
        # the letter body would print a blank there.
        errored_columns: set[str] = set()
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
                errored_columns.update(referenced_columns(template))
        for col in mapped_columns:
            if col in errored_columns:
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
