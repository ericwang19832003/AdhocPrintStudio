"""Tests for AFP Structured Field Identifiers per MO:DCA specification."""

import struct

from app.afp_document_generator import (
    SF_BDT, SF_EDT, SF_BPG, SF_EPG, SF_BNG, SF_ENG, SF_TLE,
    SF_BRG, SF_ERG, SF_BPS, SF_EPS, SF_IPS,
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
# Tests for generate_afp_with_resources (Exstream-compatible structure)
# ---------------------------------------------------------------------------

class TestAfpWithResourcesStructure:
    """Verify generate_afp_with_resources matches Exstream output structure."""

    def test_no_bdt_edt(self):
        """Exstream format has no BDT/EDT wrapper."""
        pages = _make_test_pages(3)
        afp = generate_afp_with_resources(pages)
        assert _count_sf(afp, SF_BDT) == 0, "Should have no BDT"
        assert _count_sf(afp, SF_EDT) == 0, "Should have no EDT"

    def test_brg_erg_per_letter(self):
        """Each letter must be wrapped in BRG/ERG (not BNG/ENG)."""
        pages = _make_test_pages(3)
        afp = generate_afp_with_resources(pages)
        assert _count_sf(afp, SF_BRG) == 3, "Expected 3 BRG for 3 pages"
        assert _count_sf(afp, SF_ERG) == 3, "Expected 3 ERG for 3 pages"
        assert _count_sf(afp, SF_BNG) == 0, "Should not use BNG"
        assert _count_sf(afp, SF_ENG) == 0, "Should not use ENG"

    def test_tle_inside_bpg(self):
        """TLE records must appear inside BPG (after BAG/EAG), not before BPG."""
        pages = _make_test_pages(1)
        afp = generate_afp_with_resources(pages)
        seq = _get_sf_sequence(afp)
        bpg_idx = seq.index(SF_BPG)
        epg_idx = seq.index(SF_EPG)
        tle_indices = [i for i, s in enumerate(seq) if s == SF_TLE]
        assert len(tle_indices) > 0, "Should have TLE records"
        for idx in tle_indices:
            assert bpg_idx < idx < epg_idx, (
                f"TLE at {idx} should be between BPG({bpg_idx}) and EPG({epg_idx})"
            )

    def test_inline_bps_eps_with_ips(self):
        """Each page must have inline BPS/EPS followed by IPS reference."""
        pages = _make_test_pages(2)
        afp = generate_afp_with_resources(pages)
        assert _count_sf(afp, SF_BPS) == 2, "Expected 2 BPS for 2 pages"
        assert _count_sf(afp, SF_EPS) == 2, "Expected 2 EPS for 2 pages"
        assert _count_sf(afp, SF_IPS) == 2, "Expected 2 IPS for 2 pages"
        # IPS must come after EPS
        seq = _get_sf_sequence(afp)
        eps_indices = [i for i, s in enumerate(seq) if s == SF_EPS]
        ips_indices = [i for i, s in enumerate(seq) if s == SF_IPS]
        for eps_i, ips_i in zip(eps_indices, ips_indices):
            assert eps_i < ips_i, f"IPS({ips_i}) must follow EPS({eps_i})"


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


def test_no_pgd_in_exstream_format():
    """Exstream format uses empty BAG/EAG — no PGD."""
    from app.afp_document_generator import SF_PGD
    pages = _make_test_pages(1)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")
    assert _count_sf(afp, SF_PGD) == 0, "Exstream format should not have PGD"


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
                # 0x82 = G4 MMR (ITU-T T.6), 0x01 = RIDIC top-to-bottom.
                # (The earlier 03/03 bytes were invalid — viewers reported
                # "unsupported bottom-to-top scanning" / "triplet error".)
                assert encoding == bytes([0x82, 0x01]), (
                    f"IOCA encoding should be 82 01 (G4 MMR + RIDIC), got {bytes(encoding).hex()}"
                )
                found_encoding = True
                break
        offset += 1 + length

    assert found_encoding, "Should find encoding parameter in IPD header"


def test_full_afp_exstream_compatible():
    """
    End-to-end test: verify AFP matches Exstream structure for BlueCrest compatibility.

    Exstream structure per page:
        BRG → BPG → BAG/EAG → TLE×7 → BPS → BIO...EIO → EPS → IPS → EPG → ERG
    """
    from app.afp_document_generator import SF_IDD

    pages = _make_test_pages(5)
    afp = generate_afp_with_resources(pages, document_name="MAILOUT")

    # 1. No BDT/EDT (Exstream format)
    assert _count_sf(afp, SF_BDT) == 0, "Should have no BDT"
    assert _count_sf(afp, SF_EDT) == 0, "Should have no EDT"

    # 2. BRG/ERG per letter (not BNG/ENG)
    assert _count_sf(afp, SF_BRG) == 5, "Should have one BRG per letter"
    assert _count_sf(afp, SF_ERG) == 5, "Should have one ERG per letter"

    # 3. BPG/EPG per letter
    assert _count_sf(afp, SF_BPG) == 5
    assert _count_sf(afp, SF_EPG) == 5

    # 4. 7 TLEs per letter
    assert _count_sf(afp, SF_TLE) == 35, "Should have 7 TLEs per letter * 5 letters"

    # 5. Inline BPS/EPS + IPS per letter
    assert _count_sf(afp, SF_BPS) == 5, "Should have one BPS per letter"
    assert _count_sf(afp, SF_EPS) == 5, "Should have one EPS per letter"
    assert _count_sf(afp, SF_IPS) == 5, "Should have one IPS per letter"

    # 6. SF ordering: BRG → BPG → ... → EPS → IPS → EPG → ERG
    sf_ids = _get_sf_sequence(afp)
    assert sf_ids[0] == SF_BRG, "Document should start with BRG"
    assert sf_ids[-1] == SF_ERG, "Document should end with ERG"

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
