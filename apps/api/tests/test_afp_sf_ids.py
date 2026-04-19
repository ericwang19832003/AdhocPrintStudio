from app.afp_document_generator import (
    SF_BDT, SF_EDT, SF_BPG, SF_EPG, SF_PGD,
    SF_BAG, SF_EAG, SF_BNG, SF_ENG, SF_IID,
    SF_BRG, SF_ERG, SF_BPS, SF_EPS, SF_IPS, SF_MCF,
    generate_afp_with_resources,
)


def test_sf_identifiers_match_ibm_spec():
    """All corrected SF IDs match the IBM AFP/MO:DCA Reference."""
    assert SF_BDT == bytes([0xD3, 0xA8, 0xA8])
    assert SF_EDT == bytes([0xD3, 0xA9, 0xA8])
    assert SF_BPG == bytes([0xD3, 0xA8, 0xAF])
    assert SF_EPG == bytes([0xD3, 0xA9, 0xAF])
    assert SF_PGD == bytes([0xD3, 0xA6, 0xAF])
    assert SF_BAG == bytes([0xD3, 0xA8, 0xC9])
    assert SF_EAG == bytes([0xD3, 0xA9, 0xC9])
    assert SF_BNG == bytes([0xD3, 0xA8, 0xAD])
    assert SF_ENG == bytes([0xD3, 0xA9, 0xAD])
    assert SF_IID == bytes([0xD3, 0xA6, 0x7B])
    assert SF_BRG == bytes([0xD3, 0xA8, 0xC6])
    assert SF_ERG == bytes([0xD3, 0xA9, 0xC6])


def _find_sf(stream: bytes, sf_id: bytes) -> int:
    """Return offset of first structured-field record with given 3-byte ID, or -1.

    Each record begins with 0x5A (carriage control), then a 2-byte big-endian
    length (which does NOT include the CC byte), then the 3-byte SF ID.
    """
    i = 0
    while i < len(stream):
        if stream[i] != 0x5A:
            return -1
        length = int.from_bytes(stream[i + 1:i + 3], "big")
        if stream[i + 3:i + 6] == sf_id:
            return i
        i += 1 + length
    return -1


def test_exstream_envelope_shape():
    """Exstream-style AFP: BRG wraps each page; no BDT/PGD/MCF."""
    page = {
        "image_data": bytes(100 * 100),
        "width": 100,
        "height": 100,
        "tle_data": {"mailing_name": "TEST"},
    }
    afp = generate_afp_with_resources([page])

    brg_pos = _find_sf(afp, SF_BRG)
    bpg_pos = _find_sf(afp, SF_BPG)
    bps_pos = _find_sf(afp, SF_BPS)
    ips_pos = _find_sf(afp, SF_IPS)
    epg_pos = _find_sf(afp, SF_EPG)
    erg_pos = _find_sf(afp, SF_ERG)

    assert brg_pos >= 0, "BRG (document boundary) not found"
    assert bpg_pos > brg_pos, "BPG must appear inside BRG"
    assert bps_pos > bpg_pos, "inline Begin Page Segment must follow BPG"
    assert ips_pos > bps_pos, "Include Page Segment reference must follow BPS/EPS"
    assert epg_pos > ips_pos, "EPG must follow IPS"
    assert erg_pos > epg_pos, "ERG must close the document after EPG"

    # Exstream structure intentionally omits these:
    assert _find_sf(afp, SF_BDT) < 0, "BDT must not appear in Exstream layout"
    assert _find_sf(afp, SF_PGD) < 0, "PGD must not appear in Exstream layout"
    assert _find_sf(afp, SF_MCF) < 0, "MCF must not appear (no text on page)"
