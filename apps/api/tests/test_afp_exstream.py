"""Tests for the OpenText Exstream 22.3 compatible AFP output format."""

import struct

import pytest

from app.afp_document_generator import (
    EXSTREAM_BANNER,
    SF_BAG_STD,
    SF_BNG_STD,
    SF_EAG_STD,
    SF_ENG_STD,
    SF_PGD_STD,
    generate_afp_exstream,
)
from app.afp_validator import validate_afp_bytes

CC = 0x5A

SF_NAMES = {
    bytes([0xD3, 0xA8, 0xA8]): "BDT",
    bytes([0xD3, 0xA9, 0xA8]): "EDT",
    bytes([0xD3, 0xA8, 0xAD]): "BNG",
    bytes([0xD3, 0xA9, 0xAD]): "ENG",
    bytes([0xD3, 0xA8, 0xAF]): "BPG",
    bytes([0xD3, 0xA9, 0xAF]): "EPG",
    bytes([0xD3, 0xA8, 0xC9]): "BAG",
    bytes([0xD3, 0xA9, 0xC9]): "EAG",
    bytes([0xD3, 0xA6, 0xAF]): "PGD",
    bytes([0xD3, 0xA0, 0x90]): "TLE",
    bytes([0xD3, 0xEE, 0xEE]): "NOP",
    bytes([0xD3, 0xA8, 0xFB]): "BIO",
    bytes([0xD3, 0xA9, 0xFB]): "EIO",
}


def parse_fields(afp: bytes) -> list[tuple[str, bytes]]:
    """Walk the datastream; return (name, data) per structured field."""
    fields = []
    offset = 0
    while offset < len(afp):
        assert afp[offset] == CC, f"missing 0x5A carriage control at offset {offset}"
        length = struct.unpack(">H", afp[offset + 1:offset + 3])[0]
        sf_id = afp[offset + 3:offset + 6]
        data = afp[offset + 6:offset + 1 + length]
        fields.append((SF_NAMES.get(sf_id, sf_id.hex().upper()), data))
        offset += 1 + length
    return fields


def make_pages(n: int, with_image: bool = False) -> list[dict]:
    pages = []
    for i in range(n):
        page = {
            "tle_data": {
                "mailing_name": f"CUSTOMER {i}",
                "mailing_addr1": "123 MAIN ST",
                "mailing_addr2": "SPRINGFIELD IL 62701",
                "mailing_addr3": "",
                "return_addr1": "ACME INSURANCE",
                "return_addr2": "PO BOX 1",
                "return_addr3": "",
            }
        }
        if with_image:
            page.update({"image_data": bytes(16 * 16), "width": 16, "height": 16})
        pages.append(page)
    return pages


class TestSpecCorrectIds:
    def test_std_ids_match_modca_reference(self):
        assert SF_BNG_STD == bytes([0xD3, 0xA8, 0xAD])
        assert SF_ENG_STD == bytes([0xD3, 0xA9, 0xAD])
        assert SF_BAG_STD == bytes([0xD3, 0xA8, 0xC9])
        assert SF_EAG_STD == bytes([0xD3, 0xA9, 0xC9])
        assert SF_PGD_STD == bytes([0xD3, 0xA6, 0xAF])


class TestExstreamStructure:
    def test_document_wrapped_in_bdt_edt(self):
        fields = parse_fields(generate_afp_exstream(make_pages(2)))
        names = [n for n, _ in fields]
        assert names[0] == "BDT"
        assert names[-1] == "EDT"
        assert names.count("BDT") == 1 and names.count("EDT") == 1

    def test_banner_nop_follows_bdt(self):
        fields = parse_fields(generate_afp_exstream(make_pages(1)))
        name, data = fields[1]
        assert name == "NOP"
        comment = data[3:].decode("cp500")
        assert "EXSTREAM 22.3" in comment

    def test_banner_can_be_disabled(self):
        names = [n for n, _ in parse_fields(
            generate_afp_exstream(make_pages(1), include_banner=False))]
        assert "NOP" not in names

    def test_named_page_group_per_letter(self):
        names = [n for n, _ in parse_fields(generate_afp_exstream(make_pages(3)))]
        assert names.count("BNG") == 3
        assert names.count("ENG") == 3

    def test_tles_between_bng_and_bpg(self):
        names = [n for n, _ in parse_fields(generate_afp_exstream(make_pages(1)))]
        bng, bpg = names.index("BNG"), names.index("BPG")
        tles = [i for i, n in enumerate(names) if n == "TLE"]
        assert len(tles) == 7
        assert all(bng < i < bpg for i in tles), "TLEs must sit after BNG, before BPG"

    def test_page_has_aeg_with_pgd(self):
        names = [n for n, _ in parse_fields(generate_afp_exstream(make_pages(1)))]
        bpg = names.index("BPG")
        assert names[bpg + 1] == "BAG"
        assert names[bpg + 2] == "PGD"
        assert names[bpg + 3] == "EAG"

    def test_pgd_encodes_page_size_and_units(self):
        fields = parse_fields(
            generate_afp_exstream(make_pages(1), resolution=300,
                                  page_width=2550, page_height=3300))
        data = next(d for n, d in fields if n == "PGD")[3:]  # skip flag bytes
        x_base, y_base = data[0], data[1]
        x_units, y_units = struct.unpack(">HH", data[2:6])
        x_size = int.from_bytes(data[6:9], "big")
        y_size = int.from_bytes(data[9:12], "big")
        assert (x_base, y_base) == (0x00, 0x00)  # ten-inch unit base
        assert x_units == y_units == 3000
        assert (x_size, y_size) == (2550, 3300)

    def test_image_pages_embed_inline_ioca_object(self):
        names = [n for n, _ in parse_fields(
            generate_afp_exstream(make_pages(1, with_image=True)))]
        bpg, epg = names.index("BPG"), names.index("EPG")
        assert bpg < names.index("BIO") < names.index("EIO") < epg

    def test_names_are_ebcdic_padded(self):
        fields = parse_fields(generate_afp_exstream(make_pages(1), document_name="MAILOUT"))
        bdt_data = fields[0][1]
        assert bdt_data[3:11] == "MAILOUT ".encode("cp500")

    def test_validator_accepts_output(self):
        valid, errors, _ = validate_afp_bytes(
            generate_afp_exstream(make_pages(2, with_image=True)))
        assert valid, f"validator rejected Exstream output: {errors}"

    def test_no_legacy_nonstandard_ids_present(self):
        afp = generate_afp_exstream(make_pages(2, with_image=True))
        seen_ids = set()
        offset = 0
        while offset < len(afp):
            length = struct.unpack(">H", afp[offset + 1:offset + 3])[0]
            seen_ids.add(afp[offset + 3:offset + 6])
            offset += 1 + length
        legacy_ids = {bytes([0xD3, 0xA8, 0xDF]), bytes([0xD3, 0xA9, 0xDF]),
                      bytes([0xD3, 0xA6, 0xC4]), bytes([0xD3, 0xAB, 0xFB])}
        leaked = seen_ids & legacy_ids
        assert not leaked, f"legacy nonstandard ids leaked into output: {[i.hex() for i in leaked]}"
