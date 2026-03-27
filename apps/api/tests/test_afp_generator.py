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
