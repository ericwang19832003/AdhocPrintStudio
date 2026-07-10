from app.preflight import MAX_REPORTED_PER_CHECK, run_checks


def test_missing_mapped_value_flagged():
    issues = run_checks(
        rows=[{"fname": "Ann"}, {"fname": ""}],
        mapped_columns=["fname"],
        tle_columns={"mailing_addr1": "addr1"},
    )
    assert any(
        i["row"] == 2 and i["field"] == "fname" and i["severity"] == "warning"
        for i in issues
    )


def test_missing_tle_address_is_error():
    issues = run_checks(
        rows=[{"addr1": ""}],
        mapped_columns=[],
        tle_columns={"mailing_addr1": "addr1"},
    )
    assert any(i["severity"] == "error" and i["field"] == "addr1" for i in issues)


def test_all_caps_name_warning():
    issues = run_checks(
        rows=[{"name": "JOHN SMITH"}],
        mapped_columns=["name"],
        tle_columns={"mailing_name": "name"},
    )
    assert any("caps" in i["message"].lower() for i in issues)


def test_clean_data_no_issues():
    issues = run_checks(
        rows=[{"name": "Ann Lee", "addr1": "1 Main St"}],
        mapped_columns=["name"],
        tle_columns={"mailing_name": "name", "mailing_addr1": "addr1"},
    )
    assert issues == []


def test_empty_rows_no_issues():
    issues = run_checks(
        rows=[],
        mapped_columns=["fname"],
        tle_columns={"mailing_name": "name", "mailing_addr1": "addr1"},
    )
    assert issues == []


def test_mapped_column_that_is_required_tle_not_double_reported():
    issues = run_checks(
        rows=[{"addr1": ""}],
        mapped_columns=["addr1"],
        tle_columns={"mailing_addr1": "addr1"},
    )
    addr1_issues = [i for i in issues if i["field"] == "addr1"]
    assert len(addr1_issues) == 1
    assert addr1_issues[0]["severity"] == "error"


def test_whitespace_only_value_treated_as_empty():
    issues = run_checks(
        rows=[{"addr1": "   \t "}],
        mapped_columns=[],
        tle_columns={"mailing_addr1": "addr1"},
    )
    assert any(i["severity"] == "error" and i["field"] == "addr1" for i in issues)


def test_missing_key_in_row_treated_as_empty():
    issues = run_checks(
        rows=[{"other": "x"}],
        mapped_columns=["fname"],
        tle_columns={"mailing_addr1": "addr1"},
    )
    assert any(i["field"] == "addr1" and i["severity"] == "error" for i in issues)
    assert any(i["field"] == "fname" and i["severity"] == "warning" for i in issues)


def test_cap_on_reported_issues_per_check():
    rows = [{"addr1": ""} for _ in range(60)]
    issues = run_checks(
        rows=rows,
        mapped_columns=[],
        tle_columns={"mailing_addr1": "addr1"},
    )
    addr1_issues = [i for i in issues if i["field"] == "addr1"]
    assert len(addr1_issues) == MAX_REPORTED_PER_CHECK == 50
    # First 50 rows are the ones reported.
    assert [i["row"] for i in addr1_issues] == list(range(1, 51))


def test_all_caps_short_name_skipped():
    # "LEE" is 3 chars -> skipped; "ANNA" is 4 chars -> warns.
    issues = run_checks(
        rows=[{"name": "LEE"}],
        mapped_columns=[],
        tle_columns={"mailing_name": "name"},
    )
    assert issues == []

    issues = run_checks(
        rows=[{"name": "ANNA"}],
        mapped_columns=[],
        tle_columns={"mailing_name": "name"},
    )
    assert any("caps" in i["message"].lower() for i in issues)


def test_cap_on_all_caps_warnings():
    rows = [{"name": "JOHN SMITH"} for _ in range(60)]
    issues = run_checks(
        rows=rows,
        mapped_columns=[],
        tle_columns={"mailing_name": "name"},
    )
    caps_issues = [i for i in issues if "caps" in i["message"].lower()]
    assert len(caps_issues) == MAX_REPORTED_PER_CHECK == 50
    # First 50 rows are the ones reported.
    assert [i["row"] for i in caps_issues] == list(range(1, 51))


def test_cap_on_mapped_column_empty_warnings():
    rows = [{"fname": ""} for _ in range(60)]
    issues = run_checks(
        rows=rows,
        mapped_columns=["fname"],
        tle_columns={"mailing_addr1": "addr1"},
    )
    fname_issues = [i for i in issues if i["field"] == "fname"]
    assert len(fname_issues) == MAX_REPORTED_PER_CHECK == 50
    assert all(i["severity"] == "warning" for i in fname_issues)
    assert [i["row"] for i in fname_issues] == list(range(1, 51))


def test_duplicate_mapped_columns_single_warning_per_row():
    issues = run_checks(
        rows=[{"fname": ""}],
        mapped_columns=["fname", "fname"],
        tle_columns={"mailing_addr1": "addr1"},
    )
    fname_issues = [i for i in issues if i["field"] == "fname"]
    assert len(fname_issues) == 1


def test_deterministic_ordering_of_required_columns():
    issues = run_checks(
        rows=[{}],
        mapped_columns=[],
        tle_columns={
            "mailing_name": "zeta_name",
            "mailing_addr1": "alpha_addr",
            "mailing_addr3": "mid_zip",
        },
    )
    error_fields = [i["field"] for i in issues if i["severity"] == "error"]
    assert error_fields == sorted(error_fields)
    assert set(error_fields) == {"zeta_name", "alpha_addr", "mid_zip"}


def test_unmapped_tle_key_ignored():
    # tle_columns entries with empty/missing column names should not crash
    # or produce issues.
    issues = run_checks(
        rows=[{"name": "Ann Lee"}],
        mapped_columns=[],
        tle_columns={"mailing_name": "name", "mailing_addr1": "", "mailing_addr3": ""},
    )
    assert issues == []
