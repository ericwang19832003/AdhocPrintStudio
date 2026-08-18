"""Tests for mailing-line templates ({Column} composition from split columns)."""

import fitz

from app.preflight import run_checks
from app.print_output import _resolve_mailing_line, generate_pdf


ROW = {
    "first_name": "Alice",
    "last_name": "Smith",
    "street": "1 Main St",
    "apt": "Suite 4",
    "city": "Springfield",
    "state": "IL",
    "zip": "62704",
    "full": "Bob Jones",
}


def test_plain_column_name_is_legacy_lookup():
    assert _resolve_mailing_line("full", ROW) == "Bob Jones"


def test_missing_plain_column_resolves_empty():
    assert _resolve_mailing_line("nope", ROW) == ""
    assert _resolve_mailing_line("", ROW) == ""


def test_two_part_name_template():
    assert _resolve_mailing_line("{first_name} {last_name}", ROW) == "Alice Smith"


def test_city_state_zip_template():
    assert _resolve_mailing_line("{city}, {state} {zip}", ROW) == "Springfield, IL 62704"


def test_missing_parts_leave_no_artifacts():
    row = dict(ROW, state="", zip="")
    assert _resolve_mailing_line("{city}, {state} {zip}", row) == "Springfield"
    row = dict(ROW, last_name="")
    assert _resolve_mailing_line("{first_name} {last_name}", row) == "Alice"
    row = dict(ROW, city="")
    assert _resolve_mailing_line("{city}, {state} {zip}", row) == "IL 62704"


def test_untrimmed_cells_are_cleaned():
    row = dict(ROW, first_name=" Alice ", last_name=" Smith ")
    assert _resolve_mailing_line("{first_name} {last_name}", row) == "Alice Smith"


def test_generate_pdf_with_split_columns():
    csv_text = (
        "first_name,last_name,street,apt,city,state,zip\n"
        "Alice,Smith,1 Main St,Suite 4,Springfield,IL,62704\n"
    )
    response = generate_pdf(
        {
            "spreadsheet_csv": csv_text,
            "template_html": "<p>Hello</p>",
            "block_texts": [],
            "placeholder_map": {},
            "mailing_map": {
                "mailing_name": "{first_name} {last_name}",
                "mailing_addr1": "street",
                "mailing_addr2": "{apt}",
                "mailing_addr3": "{city}, {state} {zip}",
            },
            "return_address": ["Acme", "2 Side St", "Town"],
        }
    )
    assert response.media_type == "application/pdf"
    doc = fitz.open("pdf", response.body)
    assert doc.page_count == 1


def test_preflight_checks_resolved_lines():
    issues = run_checks(
        rows=[
            {"first_name": "Alice", "last_name": "Smith", "street": "1 Main St", "city": "Springfield"},
            {"first_name": "", "last_name": "", "street": "2 Oak Ave", "city": "Shelbyville"},
        ],
        mapped_columns=[],
        tle_columns={
            "mailing_name": "{first_name} {last_name}",
            "mailing_addr1": "street",
            "mailing_addr3": "{city}",
        },
    )
    errors = [i for i in issues if i["severity"] == "error"]
    assert len(errors) == 1
    assert errors[0]["row"] == 2
    assert "recipient name" in errors[0]["message"]


def test_preflight_skips_template_columns_in_mapped_warnings():
    # A column referenced by a required template must not double-report as a
    # generic mapped-column warning.
    issues = run_checks(
        rows=[{"first_name": "", "last_name": "Smith", "street": "1 Main St", "city": "X"}],
        mapped_columns=["first_name"],
        tle_columns={
            "mailing_name": "{first_name} {last_name}",
            "mailing_addr1": "street",
            "mailing_addr3": "{city}",
        },
    )
    warnings = [i for i in issues if i["severity"] == "warning"]
    assert warnings == []
