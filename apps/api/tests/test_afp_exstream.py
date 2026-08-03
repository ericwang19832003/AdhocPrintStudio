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


class TestValidatorLegacyDisambiguation:
    def test_legacy_aeg_ids_inside_pages_report_as_bag_eag(self):
        from app.afp_document_generator import generate_afp_with_resources
        from app.afp_validator import AFPValidator

        afp = generate_afp_with_resources(make_pages(1, with_image=True))
        validator = AFPValidator(afp)
        assert validator.parse()
        codes = [f["code"] for f in validator.fields]
        assert "BAG" in codes and "EAG" in codes, "legacy AEG inside page must keep BAG/EAG labels"
        assert "BNG" not in codes, "legacy format has no real named page groups"

    def test_exstream_bng_outside_pages_still_reports_as_bng(self):
        from app.afp_validator import AFPValidator

        validator = AFPValidator(generate_afp_exstream(make_pages(1, with_image=True)))
        assert validator.parse()
        codes = [f["code"] for f in validator.fields]
        assert codes.count("BNG") == 1 and codes.count("BAG") == 1


class TestBilevelPerfRewrite:
    def test_pil_bilevel_bit_exact_with_reference_loop(self):
        import random
        from app.afp_document_generator import _to_bilevel

        def reference(gray: bytes, w: int, h: int) -> bytes:
            bpr = (w + 7) // 8
            out = bytearray(bpr * h)
            for y in range(h):
                for x in range(w):
                    idx = y * w + x
                    if idx < len(gray) and gray[idx] < 128:
                        out[y * bpr + x // 8] |= 0x80 >> (x % 8)
            return bytes(out)

        rng = random.Random(42)
        for w, h in [(64, 16), (61, 9), (2552, 4), (8, 1)]:
            gray = bytes(rng.randrange(256) for _ in range(w * h))
            assert _to_bilevel(gray, w, h) == reference(gray, w, h), f"mismatch at {w}x{h}"


class TestIocaEncodingHeader:
    def test_ipd_header_declares_g4_mmr_top_to_bottom(self):
        """Viewers reject COMPRID/RECID 03/03 (Papyrus AFPR0150E/AFPR0172E)."""
        from app.afp_document_generator import generate_inline_image

        data = generate_inline_image(bytes([255]) * (64 * 64), 64, 64)
        assert bytes([0x95, 0x02, 0x82, 0x01]) in data, "Image Encoding must be G4 MMR + RIDIC"
        assert bytes([0x95, 0x02, 0x03, 0x03]) not in data
        assert bytes([0x97, 0x01, 0x00]) not in data, "X'97' is not a valid IOCA field"


class TestG4SingleStrip:
    def test_g4_stream_is_single_strip_and_roundtrips_bit_exact(self):
        """Pillow's 64KB strip default split pages into 205-row independent
        T.6 streams; concatenating them broke strict decoders at scanline 205
        (Papyrus ACMP0007E). The stream must decode bit-exact as ONE strip."""
        import io
        from PIL import Image
        from app.afp_document_generator import _compress_g4, _to_bilevel

        w, h = 2552, 700  # tall enough to cross the old 205-row strip boundary
        gray = bytearray([255] * (w * h))
        for y in range(180, 240):  # black band straddling scanline 205
            for x in range(300, 2200):
                gray[y * w + x] = 0
        for y in range(400, 420):
            for x in range(100, 900):
                gray[y * w + x] = 0

        bilevel = _to_bilevel(bytes(gray), w, h)
        g4 = _compress_g4(bilevel, w, h)

        # decode as a SINGLE continuous G4 strip — what AFP viewers do
        def entry(tag, typ, count, val):
            return struct.pack("<HHI4s", tag, typ, count, struct.pack("<I", val))
        entries = [entry(256, 3, 1, w), entry(257, 3, 1, h), entry(258, 3, 1, 1),
                   entry(259, 3, 1, 4), entry(262, 3, 1, 0),
                   entry(273, 4, 1, 8 + 2 + 12 * 9 + 4), entry(277, 3, 1, 1),
                   entry(278, 3, 1, h), entry(279, 4, 1, len(g4))]
        tiff = (b"II*\x00" + struct.pack("<I", 8) + struct.pack("<H", len(entries))
                + b"".join(entries) + struct.pack("<I", 0) + g4)
        decoded = Image.open(io.BytesIO(tiff))
        decoded.load()
        # PIL '1' packs bit=1 as white while our bilevel packs bit=1 as dark,
        # so a perfect round trip yields the bitwise inverse.
        inverted = bytes(b ^ 0xFF for b in decoded.tobytes())
        assert inverted == bilevel, "G4 stream must decode bit-exact as one strip"


class TestRichBodyRendering:
    def test_editor_formatting_reaches_the_rendered_page(self):
        """Fonts/sizes/bold from the toolbar must survive into print output."""
        from app.print_output import _render_body_html

        big = _render_body_html(
            '<p><span style="font-size: 24pt"><strong>HEADING</strong></span></p>', [], 2000, 600)
        small = _render_body_html('<p>HEADING</p>', [], 2000, 600)
        assert big is not None and small is not None
        big, small = big[0], small[0]

        def ink_height(img):
            px = img.load()
            rows = [y for y in range(img.height)
                    if any(px[x, y] < 128 for x in range(0, img.width, 4))]
            return (max(rows) - min(rows) + 1) if rows else 0

        assert ink_height(big) > ink_height(small) * 1.5, \
            "24pt bold heading must render visibly larger than 12pt body"

    def test_font_family_mapping(self):
        from app.print_output import _map_font_families
        html = '<span style="font-family: Times New Roman">x</span><span style="font-family: Courier New">y</span>'
        mapped = _map_font_families(html)
        assert "font-family: serif" in mapped and "font-family: monospace" in mapped

    def test_page_breaks_produce_multiple_pages(self):
        """Editor pages joined with page-break-before must not be truncated."""
        from app.print_output import _render_body_html, _render_letter

        html = ('<p>Page one content</p>'
                '<div style="page-break-before:always"><p>Page two content</p></div>')
        body_pages = _render_body_html(html, [], 2000, 600)
        assert body_pages is not None and len(body_pages) == 2

        letter_pages = _render_letter(html, [], ["", "", "", ""], ["", "", ""])
        assert len(letter_pages) == 2
