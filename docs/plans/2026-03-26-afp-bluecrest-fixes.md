# AFP BlueCrest Output Manager Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the AFP generator to produce valid AFP documents that BlueCrest Output Manager can consume for TLE-based indexing, routing, and AFP→PDF conversion.

**Architecture:** Refactor `afp_document_generator.py` to use correct MO:DCA structured field IDs, proper document structure (one BDT/EDT per file, BNG/ENG per letter with TLEs between BNG and BPG), CCITT G4 compression for images, 300 DPI default, and PGD inside pages. Fix the validator to use matching SF IDs. Wire validation into the AFP endpoint.

**Tech Stack:** Python 3.11, Pillow (PIL), struct, existing AFP generator

---

## Critical Discovery: Wrong Structured Field IDs

The generator uses `D3 A8 C6` for BDT which is actually **BRG (Begin Resource Group)** in the MO:DCA spec. The correct IDs per the AFP Architecture Reference:

| Field | Current (WRONG) | Correct (MO:DCA) |
|-------|-----------------|-------------------|
| BDT (Begin Document) | `D3 A8 C6` (= BRG!) | `D3 A8 A8` |
| EDT (End Document) | `D3 A9 C6` (= ERG!) | `D3 A9 A8` |

The BPG (`D3 A8 AF`) and EPG (`D3 A9 AF`) in the generator are correct. The validator has BPG/EPG wrong (`D3 A8 A8` / `D3 A9 A8`) — those are actually BDT/EDT codes.

---

### Task 1: Fix Structured Field IDs in Generator

**Files:**
- Modify: `apps/api/app/afp_document_generator.py:21-22`

**Step 1: Write failing test**

Create `apps/api/tests/test_afp_generator.py`:

```python
"""Tests for AFP document generator — BlueCrest compatibility."""
import struct
from app.afp_document_generator import (
    _sf, _build_bdt, _build_edt, _build_bpg, _build_epg,
    _build_bng, _build_eng, _build_tle, _build_pgd,
    CC,
)

# Correct MO:DCA SF IDs per AFP Architecture Reference
MODCA_BDT = bytes([0xD3, 0xA8, 0xA8])
MODCA_EDT = bytes([0xD3, 0xA9, 0xA8])
MODCA_BPG = bytes([0xD3, 0xA8, 0xAF])
MODCA_EPG = bytes([0xD3, 0xA9, 0xAF])
MODCA_BNG = bytes([0xD3, 0xA8, 0xAD])
MODCA_ENG = bytes([0xD3, 0xA9, 0xAD])
MODCA_TLE = bytes([0xD3, 0xA0, 0x90])


def _extract_sf_id(sf_bytes: bytes) -> bytes:
    """Extract the 3-byte SF ID from a structured field."""
    # Byte 0 = CC (0x5A), Bytes 1-2 = length, Bytes 3-5 = SF ID
    return sf_bytes[3:6]


def test_bdt_uses_correct_sf_id():
    bdt = _build_bdt("TESTDOC")
    assert _extract_sf_id(bdt) == MODCA_BDT, f"BDT should be D3 A8 A8, got {_extract_sf_id(bdt).hex()}"


def test_edt_uses_correct_sf_id():
    edt = _build_edt("TESTDOC")
    assert _extract_sf_id(edt) == MODCA_EDT, f"EDT should be D3 A9 A8, got {_extract_sf_id(edt).hex()}"


def test_bpg_uses_correct_sf_id():
    bpg = _build_bpg("PAGE0001")
    assert _extract_sf_id(bpg) == MODCA_BPG


def test_epg_uses_correct_sf_id():
    epg = _build_epg("PAGE0001")
    assert _extract_sf_id(epg) == MODCA_EPG
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py::test_bdt_uses_correct_sf_id -v`
Expected: FAIL — BDT ID is `d3a8c6` not `d3a8a8`

**Step 3: Fix the SF IDs**

In `apps/api/app/afp_document_generator.py`, change lines 21-22:

```python
# BEFORE (wrong — D3 A8 C6 = BRG, not BDT):
SF_BDT = bytes([0xD3, 0xA8, 0xC6])
SF_EDT = bytes([0xD3, 0xA9, 0xC6])

# AFTER (correct MO:DCA):
SF_BDT = bytes([0xD3, 0xA8, 0xA8])  # Begin Document (D3 A8 A8)
SF_EDT = bytes([0xD3, 0xA9, 0xA8])  # End Document (D3 A9 A8)
```

**Step 4: Run test to verify it passes**

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py -v`
Expected: All 4 tests PASS

**Step 5: Commit**

```bash
git add apps/api/tests/test_afp_generator.py apps/api/app/afp_document_generator.py
git commit -m "fix: correct BDT/EDT structured field IDs to MO:DCA spec"
```

---

### Task 2: Fix Document Structure — One BDT/EDT, BNG/ENG Per Letter

**Files:**
- Modify: `apps/api/app/afp_document_generator.py:718-850` (the `generate_afp_with_resources` function)
- Test: `apps/api/tests/test_afp_generator.py`

**Step 1: Write failing test**

Add to `apps/api/tests/test_afp_generator.py`:

```python
from app.afp_document_generator import generate_afp_with_resources, SF_BDT, SF_EDT, SF_BNG, SF_ENG, SF_TLE, SF_BPG


def _count_sf(afp_data: bytes, sf_id: bytes) -> int:
    """Count occurrences of a structured field ID in AFP data."""
    count = 0
    offset = 0
    while offset < len(afp_data):
        if afp_data[offset] != 0x5A:
            break
        length = struct.unpack('>H', afp_data[offset+1:offset+3])[0]
        if afp_data[offset+3:offset+6] == sf_id:
            count += 1
        offset += 1 + length
    return count


def _get_sf_sequence(afp_data: bytes) -> list[bytes]:
    """Extract ordered list of SF IDs from AFP data."""
    ids = []
    offset = 0
    while offset < len(afp_data):
        if afp_data[offset] != 0x5A:
            break
        length = struct.unpack('>H', afp_data[offset+1:offset+3])[0]
        ids.append(afp_data[offset+3:offset+6])
        offset += 1 + length
    return ids


def _make_test_pages(count: int = 3):
    """Create test page data."""
    width, height = 100, 100
    image_data = bytes([200] * (width * height))  # Gray image
    pages = []
    for i in range(count):
        pages.append({
            'image_data': image_data,
            'width': width,
            'height': height,
            'tle_data': {
                'mailing_name': f'Person {i+1}',
                'mailing_addr1': f'{i+1}00 Main St',
                'mailing_addr2': f'City {i+1}, ST 0000{i+1}',
                'mailing_addr3': '',
                'return_addr1': 'ACME Corp',
                'return_addr2': '999 Business Ave',
                'return_addr3': 'HQ, ST 99999',
            }
        })
    return pages


def test_single_bdt_edt_for_entire_document():
    """BlueCrest expects one BDT/EDT wrapping the entire AFP stream."""
    pages = _make_test_pages(3)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")
    assert _count_sf(afp, SF_BDT) == 1, "Should have exactly one BDT"
    assert _count_sf(afp, SF_EDT) == 1, "Should have exactly one EDT"


def test_bng_eng_per_letter():
    """Each letter should be wrapped in BNG/ENG for document boundary detection."""
    pages = _make_test_pages(3)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")
    assert _count_sf(afp, SF_BNG) == 3, "Should have one BNG per letter"
    assert _count_sf(afp, SF_ENG) == 3, "Should have one ENG per letter"


def test_tle_between_bng_and_bpg():
    """TLEs must appear between BNG and BPG, not inside the page."""
    pages = _make_test_pages(1)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")
    sf_ids = _get_sf_sequence(afp)

    # Find the page section (after resources)
    # Look for the pattern: BNG → TLE... → BPG
    found_bng = False
    found_tle_after_bng = False
    found_bpg_after_tle = False

    for i, sf_id in enumerate(sf_ids):
        if sf_id == SF_BNG:
            found_bng = True
        elif sf_id == SF_TLE and found_bng and not found_bpg_after_tle:
            found_tle_after_bng = True
        elif sf_id == SF_BPG and found_tle_after_bng:
            found_bpg_after_tle = True
            break

    assert found_bng, "Should have BNG"
    assert found_tle_after_bng, "TLE should appear after BNG"
    assert found_bpg_after_tle, "BPG should appear after TLE (TLEs between BNG and BPG)"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py::test_single_bdt_edt_for_entire_document -v`
Expected: PASS (generate_afp_with_resources already has single BDT/EDT)

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py::test_tle_between_bng_and_bpg -v`
Expected: PASS (generate_afp_with_resources already places TLEs between BNG and BPG)

Note: `generate_afp_with_resources` already has the correct structure! The broken function is `generate_afp_document`. But `print_output.py` calls `generate_afp_with_resources`, so the endpoint is correct. These tests confirm the good behavior.

**Step 3: Also fix `generate_afp_document` for consistency**

In `apps/api/app/afp_document_generator.py`, rewrite `generate_afp_document()` (lines 591-680) to use the same BNG/ENG pattern:

```python
def generate_afp_document(
    pages: List[Dict],
    document_name: str = "PRINTDOC",
    resolution: int = 300,
    page_width: int = 2550,
    page_height: int = 3300
) -> bytes:
    """
    Generate a complete AFP document with TLE index data.

    Structure (BlueCrest Output Manager compatible):
      BDT (one per file)
        BNG (one per letter)
          TLE records (between BNG and BPG)
          BPG
            BAG → PGD → EAG
            inline image
          EPG
        ENG
      EDT
    """
    result = bytearray()
    result.extend(_build_bdt(document_name))

    for page_num, page in enumerate(pages, start=1):
        group_name = f"G{page_num:07d}"
        page_name = f"P{page_num:07d}"

        # Begin Named Page Group — document boundary for BlueCrest
        result.extend(_build_bng(group_name))

        # TLE records — MUST be between BNG and BPG
        tle_data = page.get('tle_data', {})
        tle_fields = [
            ('mailing_name', tle_data.get('mailing_name', '')),
            ('mailing_addr1', tle_data.get('mailing_addr1', '')),
            ('mailing_addr2', tle_data.get('mailing_addr2', '')),
            ('mailing_addr3', tle_data.get('mailing_addr3', '')),
            ('return_addr1', tle_data.get('return_addr1', '')),
            ('return_addr2', tle_data.get('return_addr2', '')),
            ('return_addr3', tle_data.get('return_addr3', '')),
        ]
        for field_name, field_value in tle_fields:
            result.extend(_build_tle(field_name, field_value))

        # Begin Page
        result.extend(_build_bpg(page_name))

        # Active Environment Group with Page Descriptor
        result.extend(_build_bag())
        result.extend(_build_pgd(page_width, page_height, resolution))
        result.extend(_build_eag())

        # Embed letter image
        image_data = page.get('image_data')
        if image_data:
            img_width = page.get('width', page_width)
            img_height = page.get('height', page_height)
            result.extend(generate_inline_image(
                image_data, img_width, img_height, resolution
            ))

        result.extend(_build_epg(page_name))
        result.extend(_build_eng(group_name))

    result.extend(_build_edt(document_name))
    return bytes(result)
```

**Step 4: Run all tests**

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add apps/api/app/afp_document_generator.py apps/api/tests/test_afp_generator.py
git commit -m "fix: correct AFP document structure — single BDT/EDT, BNG/ENG per letter, TLEs before BPG"
```

---

### Task 3: Add PGD Inside Pages in `generate_afp_with_resources`

**Files:**
- Modify: `apps/api/app/afp_document_generator.py:826-833`
- Test: `apps/api/tests/test_afp_generator.py`

**Step 1: Write failing test**

```python
from app.afp_document_generator import SF_PGD

def test_pgd_inside_page():
    """Each page must have a Page Descriptor (PGD) inside BAG/EAG."""
    pages = _make_test_pages(1)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")
    assert _count_sf(afp, SF_PGD) >= 1, "Should have at least one PGD"
```

**Step 2: Run test to verify it fails**

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py::test_pgd_inside_page -v`
Expected: FAIL — no PGD in current output

**Step 3: Add PGD to generate_afp_with_resources**

In `apps/api/app/afp_document_generator.py`, inside the page section of `generate_afp_with_resources()`, after `_build_bag()` and before `_build_mcf()`, add:

```python
        # Active Environment Group with Page Descriptor and font mapping
        result.extend(_build_bag())
        result.extend(_build_pgd(page_width, page_height, resolution))  # ADD THIS
        result.extend(_build_mcf())
        result.extend(_build_eag())
```

**Step 4: Run test**

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add apps/api/app/afp_document_generator.py apps/api/tests/test_afp_generator.py
git commit -m "fix: add PGD (Page Descriptor) inside page BAG/EAG"
```

---

### Task 4: Change Default Resolution to 300 DPI

**Files:**
- Modify: `apps/api/app/afp_document_generator.py` — default params
- Modify: `apps/api/app/print_output.py:37-39` — DPI constant
- Test: `apps/api/tests/test_afp_generator.py`

**Step 1: Write failing test**

```python
def test_default_resolution_300dpi():
    """Default resolution should be 300 DPI for modern print environments."""
    pages = _make_test_pages(1)
    # Call without explicit resolution — should default to 300
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")

    # Parse to find IDD and check resolution
    offset = 0
    found_300 = False
    sf_idd = bytes([0xD3, 0xA6, 0xFB])
    while offset < len(afp):
        if afp[offset] != 0x5A:
            break
        length = struct.unpack('>H', afp[offset+1:offset+3])[0]
        if afp[offset+3:offset+6] == sf_idd:
            # IDD data: 4 reserved + 2 x_res + 2 y_res
            data = afp[offset+6:offset+1+length]
            if len(data) >= 8:
                x_res = struct.unpack('>H', data[4:6])[0]
                # 300 DPI * 10 = 3000
                if x_res == 3000:
                    found_300 = True
        offset += 1 + length

    assert found_300, "Default resolution should be 300 DPI (3000 in IDD)"
```

**Step 2: Run test to verify it fails**

Expected: FAIL — current default is 240 DPI (2400 in IDD)

**Step 3: Update defaults**

In `apps/api/app/print_output.py` lines 37-39:
```python
# BEFORE:
DPI = 240
PAGE_WIDTH = int(8.5 * DPI)
PAGE_HEIGHT = int(11 * DPI)

# AFTER:
DPI = 300
PAGE_WIDTH = int(8.5 * DPI)   # 2550
PAGE_HEIGHT = int(11 * DPI)   # 3300
```

In `apps/api/app/afp_document_generator.py`, update ALL function signatures that have `resolution=240` to `resolution=300`, and width/height defaults to match 300 DPI:
- `generate_afp_document`: resolution=300, page_width=2550, page_height=3300
- `generate_afp_with_resources`: resolution=300, page_width=2550, page_height=3300
- `generate_inline_image`: resolution=300
- `generate_inline_page_segment`: resolution=300
- `_build_pgd`: width=2550, height=3300, resolution=300
- `_build_obd`: resolution=300
- `_build_idd`: resolution=300
- `_build_ipd_records`: resolution=300

**Step 4: Run tests**

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add apps/api/app/print_output.py apps/api/app/afp_document_generator.py apps/api/tests/test_afp_generator.py
git commit -m "feat: change default AFP resolution to 300 DPI"
```

---

### Task 5: Implement CCITT G4 Compression

**Files:**
- Modify: `apps/api/app/afp_document_generator.py` — `_build_ipd_records` and bilevel conversion
- Test: `apps/api/tests/test_afp_generator.py`

**Step 1: Write failing test**

```python
def test_image_data_is_g4_compressed():
    """IPD header should declare G4 AND data should actually be G4 compressed."""
    pages = _make_test_pages(1)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")

    # G4 compressed data is MUCH smaller than raw bilevel
    # 100x100 raw bilevel = 1250 bytes, G4 of mostly-white = ~50 bytes
    # Total AFP size with raw bilevel will be >> with G4
    raw_bilevel_size = (100 + 7) // 8 * 100  # 1300 bytes per image
    assert len(afp) < raw_bilevel_size * 5, "AFP should be smaller than 5x raw bilevel (G4 compressed)"
```

**Step 2: Run test to verify it fails**

Expected: May pass or fail depending on overhead. Better test: check the IPD header encoding byte.

Updated test:

```python
def test_ipd_header_declares_g4_compression():
    """IPD IOCA header must declare G4 compression (0x95 0x02 0x03 0x03)."""
    pages = _make_test_pages(1)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")

    # Find first IPD and check encoding parameter
    sf_ipd = bytes([0xD3, 0xEE, 0xFB])
    offset = 0
    while offset < len(afp):
        if afp[offset] != 0x5A:
            break
        length = struct.unpack('>H', afp[offset+1:offset+3])[0]
        if afp[offset+3:offset+6] == sf_ipd:
            data = afp[offset+6:offset+1+length]
            # Look for encoding param 0x95 in the IOCA header
            # 0x95 0x02 0x03 0x03 = CCITT G4 (MMR)
            idx = data.find(b'\x95\x02')
            if idx >= 0:
                encoding = data[idx+2:idx+4]
                assert encoding == b'\x03\x03', (
                    f"IOCA encoding should be 03 03 (G4/MMR), got {encoding.hex()}"
                )
                break
        offset += 1 + length
```

**Step 3: Implement G4 compression**

In `apps/api/app/afp_document_generator.py`, add G4 compression using Pillow:

```python
def _compress_g4(bilevel_data: bytes, width: int, height: int) -> bytes:
    """Compress bilevel image data using CCITT Group 4 (T.6) via Pillow."""
    # Reconstruct 1-bit image from raw bilevel bytes
    bpr = (width + 7) // 8
    img = Image.frombytes('1', (width, height), bilevel_data)

    # Save as TIFF with G4 compression, extract raw compressed data
    buf = io.BytesIO()
    img.save(buf, format='TIFF', compression='group4')
    buf.seek(0)

    # Parse TIFF to extract the raw G4 data strip
    # Pillow's TIFF writer puts data in a single strip
    tiff_data = buf.getvalue()

    # Re-open and get the raw compressed bytes via libtiff
    from PIL import TiffImagePlugin
    buf.seek(0)
    tiff_img = Image.open(buf)
    # Use tobytes with decoder to get compressed stream
    # Alternative: use the TIFF strip offsets
    buf2 = io.BytesIO()
    tiff_img.save(buf2, format='TIFF', compression='group4')

    # Extract strip data from TIFF structure
    buf2.seek(0)
    return _extract_tiff_strip(buf2.getvalue())


def _extract_tiff_strip(tiff_bytes: bytes) -> bytes:
    """Extract raw G4 compressed data from a TIFF file."""
    import struct as st

    # TIFF header: byte order (2) + magic (2) + IFD offset (4)
    if tiff_bytes[:2] == b'II':
        endian = '<'
    else:
        endian = '>'

    ifd_offset = st.unpack(endian + 'I', tiff_bytes[4:8])[0]

    # Parse IFD entries to find StripOffsets (273) and StripByteCounts (279)
    num_entries = st.unpack(endian + 'H', tiff_bytes[ifd_offset:ifd_offset+2])[0]

    strip_offset = 0
    strip_length = 0

    for i in range(num_entries):
        entry_offset = ifd_offset + 2 + i * 12
        tag = st.unpack(endian + 'H', tiff_bytes[entry_offset:entry_offset+2])[0]
        value = st.unpack(endian + 'I', tiff_bytes[entry_offset+8:entry_offset+12])[0]

        if tag == 273:  # StripOffsets
            strip_offset = value
        elif tag == 279:  # StripByteCounts
            strip_length = value

    if strip_offset and strip_length:
        return tiff_bytes[strip_offset:strip_offset + strip_length]

    # Fallback: return empty (should not happen)
    return b''
```

Then update `_build_ipd_records` to use the compressed data and set the correct encoding parameter:

```python
# Change line 445 from:
first_ipd.extend([0x95, 0x02, 0x03, 0x01])  # G4 declared but raw data (WRONG)
# To:
first_ipd.extend([0x95, 0x02, 0x03, 0x03])  # CCITT G4 (MMR) compression
```

And update the callers (`generate_inline_image`, `generate_inline_page_segment`, `generate_afp_with_resources`) to compress before passing to `_build_ipd_records`:

```python
bilevel_data = _to_bilevel(image_data, width, height)
compressed_data = _compress_g4(bilevel_data, width, height)
# Pass compressed_data to _build_ipd_records instead of bilevel_data
```

Add `import io` and `from PIL import Image` at top of file.

**Step 4: Run tests**

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add apps/api/app/afp_document_generator.py apps/api/tests/test_afp_generator.py
git commit -m "feat: implement actual CCITT G4 compression for AFP images"
```

---

### Task 6: Fix Validator SF IDs and Add BNG/ENG Support

**Files:**
- Modify: `apps/api/app/afp_validator.py:17-41`
- Test: `apps/api/tests/test_afp_generator.py`

**Step 1: Write failing test**

```python
from app.afp_validator import validate_afp_bytes


def test_validator_passes_valid_document():
    """Validator should pass a correctly structured AFP document."""
    pages = _make_test_pages(1)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")
    success, errors, warnings = validate_afp_bytes(afp)
    assert success, f"Validation failed: {errors}"
```

**Step 2: Run to verify it fails**

Expected: FAIL — validator doesn't recognize the generator's SF IDs

**Step 3: Fix validator SF_TYPES**

In `apps/api/app/afp_validator.py`, fix the SF_TYPES dict:

```python
SF_TYPES = {
    (0xD3, 0xA8, 0xA8): ("BDT", "Begin Document"),      # Fixed
    (0xD3, 0xA9, 0xA8): ("EDT", "End Document"),          # Fixed
    (0xD3, 0xA8, 0xAF): ("BPG", "Begin Page"),            # Fixed
    (0xD3, 0xA9, 0xAF): ("EPG", "End Page"),              # Fixed
    (0xD3, 0xA6, 0xC4): ("PGD", "Page Descriptor"),
    (0xD3, 0xA0, 0x90): ("TLE", "Tag Logical Element"),
    (0xD3, 0xEE, 0xEE): ("NOP", "No Operation"),
    (0xD3, 0xA8, 0x5F): ("BPS", "Begin Page Segment"),
    (0xD3, 0xA9, 0x5F): ("EPS", "End Page Segment"),
    (0xD3, 0xA8, 0xFB): ("BIO", "Begin Image Object"),
    (0xD3, 0xA9, 0xFB): ("EIO", "End Image Object"),
    (0xD3, 0xA6, 0xFB): ("IDD", "Image Data Descriptor"),
    (0xD3, 0xEE, 0xFB): ("IPD", "Image Picture Data"),
    (0xD3, 0xA8, 0xC7): ("BOG", "Begin Object Environment Group"),
    (0xD3, 0xA9, 0xC7): ("EOG", "End Object Environment Group"),
    (0xD3, 0xA6, 0x6B): ("OBD", "Object Area Descriptor"),
    (0xD3, 0xAC, 0x6B): ("OBP", "Object Area Position"),
    (0xD3, 0xAB, 0xFB): ("IID", "Image Input Descriptor"),
    (0xD3, 0xAF, 0x5F): ("IPS", "Include Page Segment"),
    (0xD3, 0xA8, 0xAD): ("BAG", "Begin Active Environment Group"),
    (0xD3, 0xA9, 0xAD): ("EAG", "End Active Environment Group"),
    (0xD3, 0xA8, 0xCE): ("BRS", "Begin Resource"),
    (0xD3, 0xA9, 0xCE): ("ERS", "End Resource"),
    (0xD3, 0xA8, 0xDF): ("BNG", "Begin Named Page Group"),  # Added
    (0xD3, 0xA9, 0xDF): ("ENG", "End Named Page Group"),    # Added
    (0xD3, 0xAB, 0x8A): ("MCF", "Map Coded Font"),          # Added
}
```

Also add BNG/ENG depth tracking in `validate_structure()` and check TLE placement.

**Step 4: Run tests**

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add apps/api/app/afp_validator.py apps/api/tests/test_afp_generator.py
git commit -m "fix: correct validator SF IDs, add BNG/ENG support"
```

---

### Task 7: Wire Validator Into AFP Endpoint

**Files:**
- Modify: `apps/api/app/print_output.py:662-671`
- Test: `apps/api/tests/test_afp_generator.py`

**Step 1: Add validation call**

In `apps/api/app/print_output.py`, after `generate_afp_with_resources()` call (around line 665), add:

```python
        afp_document = generate_afp_with_resources(
            pages=pages,
            document_name="MAILOUT",
            resolution=DPI,
            page_width=PAGE_WIDTH,
            page_height=PAGE_HEIGHT
        )

        # Validate AFP structure before returning
        from app.afp_validator import validate_afp_bytes
        valid, errors, warnings = validate_afp_bytes(afp_document)
        if warnings:
            for w in warnings:
                logger.warning("AFP validation warning: %s", w)
        if not valid:
            logger.error("AFP validation failed: %s", errors)
            # Still return the file but log the errors
```

**Step 2: Run tests**

Run: `cd apps/api && python -m pytest tests/ -v`
Expected: All PASS

**Step 3: Commit**

```bash
git add apps/api/app/print_output.py
git commit -m "feat: wire AFP validator into generation endpoint"
```

---

### Task 8: End-to-End Integration Test

**Files:**
- Test: `apps/api/tests/test_afp_generator.py`

**Step 1: Write integration test**

```python
def test_full_afp_bluecrest_compatible():
    """
    End-to-end test: generate AFP and verify BlueCrest compatibility.

    Checks:
    1. Single BDT/EDT
    2. BNG/ENG per letter
    3. TLEs between BNG and BPG
    4. PGD inside each page
    5. 300 DPI resolution
    6. Passes validator
    """
    pages = _make_test_pages(5)
    afp = generate_afp_with_resources(
        pages, document_name="MAILOUT"
    )

    # Structure checks
    assert _count_sf(afp, SF_BDT) == 1
    assert _count_sf(afp, SF_EDT) == 1
    assert _count_sf(afp, SF_BNG) == 5
    assert _count_sf(afp, SF_ENG) == 5
    assert _count_sf(afp, SF_BPG) == 5
    assert _count_sf(afp, SF_EPG) == 5
    assert _count_sf(afp, SF_TLE) == 35  # 7 TLEs per letter * 5 letters
    assert _count_sf(afp, SF_PGD) >= 5  # One PGD per page minimum

    # Validator check
    from app.afp_validator import validate_afp_bytes
    valid, errors, warnings = validate_afp_bytes(afp)
    assert valid, f"AFP validation failed: {errors}"

    # Verify document starts with NOP, BDT and ends with EDT
    sf_ids = _get_sf_sequence(afp)
    # First non-NOP should be BDT
    non_nop = [s for s in sf_ids if s != bytes([0xD3, 0xEE, 0xEE])]
    assert non_nop[0] == SF_BDT, "Document should start with BDT"
    assert non_nop[-1] == SF_EDT, "Document should end with EDT"
```

**Step 2: Run all tests**

Run: `cd apps/api && python -m pytest tests/test_afp_generator.py -v`
Expected: All PASS

**Step 3: Commit**

```bash
git add apps/api/tests/test_afp_generator.py
git commit -m "test: add end-to-end BlueCrest compatibility integration test"
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `afp_document_generator.py` | Fix BDT/EDT SF IDs, fix document structure, add PGD, change to 300 DPI, add G4 compression |
| `print_output.py` | Change DPI to 300, add validator call |
| `afp_validator.py` | Fix SF_TYPES, add BNG/ENG/MCF/BRS/ERS/IID support |
| `tests/test_afp_generator.py` | New — 10+ tests covering SF IDs, structure, TLE placement, resolution, compression, validation |
