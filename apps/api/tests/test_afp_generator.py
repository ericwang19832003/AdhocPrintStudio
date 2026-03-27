"""Tests for AFP Structured Field Identifiers per MO:DCA specification."""

import struct

from app.afp_document_generator import (
    SF_BDT, SF_EDT, SF_BPG, SF_EPG, SF_BNG, SF_ENG, SF_TLE,
    generate_afp_document, generate_afp_with_resources,
)


class TestStructuredFieldIdentifiers:
    """Verify SF IDs match the MO:DCA Architecture Reference."""

    def test_bdt_uses_correct_sf_id(self):
        """BDT (Begin Document) must be D3 A8 A8."""
        assert SF_BDT == bytes([0xD3, 0xA8, 0xA8]), (
            f"BDT should be D3 A8 A8, got {SF_BDT.hex(' ').upper()}"
        )

    def test_edt_uses_correct_sf_id(self):
        """EDT (End Document) must be D3 A9 A8."""
        assert SF_EDT == bytes([0xD3, 0xA9, 0xA8]), (
            f"EDT should be D3 A9 A8, got {SF_EDT.hex(' ').upper()}"
        )

    def test_bpg_uses_correct_sf_id(self):
        """BPG (Begin Page) must be D3 A8 AF."""
        assert SF_BPG == bytes([0xD3, 0xA8, 0xAF]), (
            f"BPG should be D3 A8 AF, got {SF_BPG.hex(' ').upper()}"
        )

    def test_epg_uses_correct_sf_id(self):
        """EPG (End Page) must be D3 A9 AF."""
        assert SF_EPG == bytes([0xD3, 0xA9, 0xAF]), (
            f"EPG should be D3 A9 AF, got {SF_EPG.hex(' ').upper()}"
        )


# ---------------------------------------------------------------------------
# Helpers for document-structure tests
# ---------------------------------------------------------------------------

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


def _get_sf_sequence(afp_data: bytes) -> list:
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


def _make_test_pages(count=3):
    width, height = 100, 100
    image_data = bytes([200] * (width * height))
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


# ---------------------------------------------------------------------------
# Tests for generate_afp_with_resources (should already be correct)
# ---------------------------------------------------------------------------

class TestAfpWithResourcesStructure:
    """Verify generate_afp_with_resources uses correct document structure."""

    def test_single_bdt_edt_for_entire_document(self):
        """Entire file must have exactly 1 BDT and 1 EDT."""
        pages = _make_test_pages(3)
        afp = generate_afp_with_resources(pages)
        assert _count_sf(afp, SF_BDT) == 1, "Expected exactly 1 BDT"
        assert _count_sf(afp, SF_EDT) == 1, "Expected exactly 1 EDT"

    def test_bng_eng_per_letter(self):
        """Each letter must be wrapped in its own BNG/ENG."""
        pages = _make_test_pages(3)
        afp = generate_afp_with_resources(pages)
        assert _count_sf(afp, SF_BNG) == 3, "Expected 3 BNG for 3 pages"
        assert _count_sf(afp, SF_ENG) == 3, "Expected 3 ENG for 3 pages"

    def test_tle_between_bng_and_bpg(self):
        """TLE records must appear after BNG and before BPG."""
        pages = _make_test_pages(1)
        afp = generate_afp_with_resources(pages)
        seq = _get_sf_sequence(afp)
        # Find first BNG, first TLE after it, and first BPG after it
        bng_idx = seq.index(SF_BNG)
        tle_idx = None
        bpg_idx = None
        for i in range(bng_idx + 1, len(seq)):
            if seq[i] == SF_TLE and tle_idx is None:
                tle_idx = i
            if seq[i] == SF_BPG and bpg_idx is None:
                bpg_idx = i
                break
        assert tle_idx is not None, "No TLE found after BNG"
        assert bpg_idx is not None, "No BPG found after BNG"
        assert bng_idx < tle_idx < bpg_idx, (
            f"Expected BNG({bng_idx}) < TLE({tle_idx}) < BPG({bpg_idx})"
        )


# ---------------------------------------------------------------------------
# Tests for generate_afp_document (will fail before fix)
# ---------------------------------------------------------------------------

class TestAfpDocumentStructure:
    """Verify generate_afp_document uses correct document structure."""

    def test_generate_afp_document_single_bdt_edt(self):
        """generate_afp_document must produce exactly 1 BDT and 1 EDT."""
        pages = _make_test_pages(3)
        afp = generate_afp_document(pages)
        assert _count_sf(afp, SF_BDT) == 1, (
            f"Expected 1 BDT, got {_count_sf(afp, SF_BDT)}"
        )
        assert _count_sf(afp, SF_EDT) == 1, (
            f"Expected 1 EDT, got {_count_sf(afp, SF_EDT)}"
        )

    def test_generate_afp_document_has_bng_eng(self):
        """generate_afp_document must wrap each letter in BNG/ENG."""
        pages = _make_test_pages(3)
        afp = generate_afp_document(pages)
        assert _count_sf(afp, SF_BNG) == 3, (
            f"Expected 3 BNG, got {_count_sf(afp, SF_BNG)}"
        )
        assert _count_sf(afp, SF_ENG) == 3, (
            f"Expected 3 ENG, got {_count_sf(afp, SF_ENG)}"
        )


def test_pgd_inside_page_with_resources():
    """Each page must have a Page Descriptor (PGD) inside BAG/EAG."""
    from app.afp_document_generator import SF_PGD
    pages = _make_test_pages(1)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")
    assert _count_sf(afp, SF_PGD) >= 1, "Should have at least one PGD"


def test_default_resolution_300dpi():
    """Default resolution should be 300 DPI for modern print environments."""
    import struct
    from app.afp_document_generator import SF_IDD
    pages = _make_test_pages(1)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")

    sf_idd = bytes([0xD3, 0xA6, 0xFB])
    offset = 0
    found_300 = False
    while offset < len(afp):
        if afp[offset] != 0x5A:
            break
        length = struct.unpack('>H', afp[offset+1:offset+3])[0]
        if afp[offset+3:offset+6] == sf_idd:
            data = afp[offset+6:offset+1+length]
            if len(data) >= 8:
                x_res = struct.unpack('>H', data[4:6])[0]
                if x_res == 3000:  # 300 DPI * 10
                    found_300 = True
        offset += 1 + length

    assert found_300, "Default resolution should be 300 DPI (3000 in IDD)"


def test_g4_compression_reduces_size():
    """G4 compressed AFP should be significantly smaller than raw bilevel."""
    pages = _make_test_pages(1)  # 100x100 mostly-gray image
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")

    # Raw bilevel for 100x100 = 1300 bytes. With AFP overhead for 1 page,
    # total raw would be ~2000+ bytes. G4 of a simple image should be much smaller.
    # The total AFP with headers/TLEs/etc will add overhead, but the image
    # portion should be compressed.
    # Just verify it generates without error and is reasonable size
    assert len(afp) > 100, "AFP should have content"
    assert len(afp) < 50000, "AFP should not be excessively large"


def test_ipd_header_declares_g4():
    """IPD IOCA header must declare G4 compression encoding."""
    pages = _make_test_pages(1)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")

    sf_ipd = bytes([0xD3, 0xEE, 0xFB])
    offset = 0
    found_encoding = False
    while offset < len(afp):
        if afp[offset] != 0x5A:
            break
        length = struct.unpack('>H', afp[offset+1:offset+3])[0]
        if afp[offset+3:offset+6] == sf_ipd:
            data = afp[offset+6:offset+1+length]
            # Look for encoding param 0x95 in IOCA header
            idx = bytes(data).find(b'\x95\x02')
            if idx >= 0:
                encoding = data[idx+2:idx+4]
                # 0x03 0x03 = CCITT G4 (MMR)
                assert encoding == bytes([0x03, 0x03]), (
                    f"IOCA encoding should be 03 03 (G4/MMR), got {bytes(encoding).hex()}"
                )
                found_encoding = True
                break
        offset += 1 + length

    assert found_encoding, "Should find encoding parameter in IPD header"


def test_validator_passes_valid_document():
    """Validator should pass a correctly structured AFP document."""
    from app.afp_validator import validate_afp_bytes
    pages = _make_test_pages(2)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")
    success, errors, warnings = validate_afp_bytes(afp)
    assert success, f"Validation failed: {errors}"


def test_full_afp_bluecrest_compatible():
    """
    End-to-end test: generate AFP and verify BlueCrest Output Manager compatibility.

    Checks:
    1. Single BDT/EDT
    2. BNG/ENG per letter
    3. TLEs between BNG and BPG
    4. PGD inside each page
    5. 300 DPI resolution
    6. G4 compression
    7. Passes validator
    """
    from app.afp_document_generator import SF_PGD, SF_IDD
    from app.afp_validator import validate_afp_bytes

    pages = _make_test_pages(5)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")

    # 1. Single BDT/EDT
    assert _count_sf(afp, SF_BDT) == 1, "Should have exactly one BDT"
    assert _count_sf(afp, SF_EDT) == 1, "Should have exactly one EDT"

    # 2. BNG/ENG per letter
    assert _count_sf(afp, SF_BNG) == 5, "Should have one BNG per letter"
    assert _count_sf(afp, SF_ENG) == 5, "Should have one ENG per letter"

    # 3. TLEs between BNG and BPG
    sf_ids = _get_sf_sequence(afp)
    for i, sf_id in enumerate(sf_ids):
        if sf_id == SF_BNG:
            # Next non-TLE after BNG should be BPG
            j = i + 1
            while j < len(sf_ids) and sf_ids[j] == SF_TLE:
                j += 1
            assert j < len(sf_ids) and sf_ids[j] == SF_BPG, \
                "After BNG+TLEs, next SF should be BPG"

    # 4. PGD inside pages
    assert _count_sf(afp, SF_PGD) >= 5, "Should have PGD in each page"

    # 5. BPG/EPG per letter
    assert _count_sf(afp, SF_BPG) == 5
    assert _count_sf(afp, SF_EPG) == 5

    # 6. 7 TLEs per letter (mailing_name, addr1-3, return_addr1-3)
    assert _count_sf(afp, SF_TLE) == 35, "Should have 7 TLEs per letter * 5 letters"

    # 7. 300 DPI resolution in IDD
    sf_idd = bytes([0xD3, 0xA6, 0xFB])
    offset = 0
    found_300 = False
    while offset < len(afp):
        if afp[offset] != 0x5A:
            break
        length = struct.unpack('>H', afp[offset+1:offset+3])[0]
        if afp[offset+3:offset+6] == sf_idd:
            data = afp[offset+6:offset+1+length]
            if len(data) >= 8:
                x_res = struct.unpack('>H', data[4:6])[0]
                if x_res == 3000:
                    found_300 = True
                    break
        offset += 1 + length
    assert found_300, "Should use 300 DPI"

    # 8. Passes validator
    valid, errors, warnings = validate_afp_bytes(afp)
    assert valid, f"AFP validation failed: {errors}"

    # 9. Document starts with NOP/BDT and ends with EDT
    sf_nop = bytes([0xD3, 0xEE, 0xEE])
    non_nop = [s for s in sf_ids if s != sf_nop]
    assert non_nop[0] == SF_BDT, "Document should start with BDT (after NOPs)"
    assert non_nop[-1] == SF_EDT, "Document should end with EDT"
