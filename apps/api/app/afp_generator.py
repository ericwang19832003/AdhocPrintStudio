"""
AFP Page Segment Generator.

Copied from worker implementation to keep API self-contained.
"""
from __future__ import annotations

import struct

CRLF = b"\x0d\x0a"
CC = 0x5A

SF_BPS = bytes([0xD3, 0xA8, 0x5F])
SF_EPS = bytes([0xD3, 0xA9, 0x5F])
SF_BIO = bytes([0xD3, 0xA8, 0xFB])
SF_EIO = bytes([0xD3, 0xA9, 0xFB])
SF_IDD = bytes([0xD3, 0xA6, 0xFB])
SF_IPD = bytes([0xD3, 0xEE, 0xFB])

SF_BOG = bytes([0xD3, 0xA8, 0xC7])
SF_EOG = bytes([0xD3, 0xA9, 0xC7])
SF_OBD = bytes([0xD3, 0xA6, 0x6B])
SF_OBP = bytes([0xD3, 0xAC, 0x6B])
SF_NOP = bytes([0xD3, 0xEE, 0xEE])


def _sf(sf_id: bytes, data: bytes = b"") -> bytes:
    length = 5 + len(data)
    return bytes([CC]) + struct.pack(">H", length) + sf_id + data + CRLF


def _build_bps(name: str) -> bytes:
    ebcdic_name = name.upper()[:8].ljust(8).encode("cp500")
    data = bytes([0x00, 0x00, 0x00]) + ebcdic_name
    return _sf(SF_BPS, data)


def _build_nop_records(name: str) -> bytes:
    from datetime import datetime

    result = bytearray()
    now = datetime.now()
    timestamp = now.strftime("%m/%d/%Y   %I:%M:%S %p")
    comment = f"{name.upper()[:8].ljust(8)} (c)2025 Copyright by Elevance Health {timestamp}"
    comment = comment[:86].ljust(86)

    ebcdic_comment = comment.encode("cp500")
    data1 = bytes([0x00, 0x00, 0x00]) + ebcdic_comment
    result.extend(_sf(SF_NOP, data1))

    ascii_comment = comment.encode("ascii")
    data2 = bytes([0x00, 0x00, 0x00]) + ascii_comment
    result.extend(_sf(SF_NOP, data2))

    return bytes(result)


def _build_eps(name: str) -> bytes:
    ebcdic_name = name.upper()[:8].ljust(8).encode("cp500")
    data = bytes([0x00, 0x00, 0x00]) + ebcdic_name
    return _sf(SF_EPS, data)


def _build_bio(name: str) -> bytes:
    ebcdic_name = name.upper()[:8].ljust(8).encode("cp500")
    data = bytes([0x00, 0x00, 0x00]) + ebcdic_name
    return _sf(SF_BIO, data)


def _build_eio() -> bytes:
    return _sf(SF_EIO, bytes([0x00, 0x00, 0x00]))


def _build_bog() -> bytes:
    return _sf(SF_BOG, bytes([0x00, 0x00, 0x00]))


def _build_eog() -> bytes:
    return _sf(SF_EOG, bytes([0x00, 0x00, 0x00]))


def _build_obd(width: int, height: int, resolution: int = 240) -> bytes:
    data = bytearray()
    data.extend([0x00, 0x00, 0x00])
    data.extend([0x03, 0x43, 0x01])
    data.extend([0x06, 0x44, 0x00])
    data.extend(struct.pack(">H", width))
    data.extend(struct.pack(">H", height))
    data.extend([0x0A, 0x45, 0x01])
    data.extend(struct.pack(">H", resolution))
    data.extend(struct.pack(">H", resolution))
    return _sf(SF_OBD, bytes(data))


def _build_obp(x: int, y: int, resolution: int = 240) -> bytes:
    data = bytearray()
    data.extend([0x00, 0x00, 0x00])
    data.extend([0x06, 0x3F, 0x00])
    data.extend(struct.pack(">H", x))
    data.extend(struct.pack(">H", y))
    data.extend([0x0A, 0x45, 0x01])
    data.extend(struct.pack(">H", resolution))
    data.extend(struct.pack(">H", resolution))
    return _sf(SF_OBP, bytes(data))


def _build_idd(width: int, height: int, resolution: int = 240) -> bytes:
    data = bytearray()
    data.extend([0x00, 0x00, 0x00])
    data.extend([0x06, 0x01, 0x00])
    data.extend(struct.pack(">H", width))
    data.extend(struct.pack(">H", height))
    data.extend([0x0A, 0x45, 0x01])
    data.extend(struct.pack(">H", resolution))
    data.extend(struct.pack(">H", resolution))
    return _sf(SF_IDD, bytes(data))


def _build_ipd_records(
    image_data: bytes,
    width: int,
    height: int,
    resolution: int = 240,
    use_g4: bool = True,
) -> bytes:
    data = bytearray()
    header = bytearray()
    header.extend([0x00, 0x00, 0x00])
    header.extend([0x0A, 0x01, 0x01])
    header.extend(struct.pack(">H", width))
    header.extend(struct.pack(">H", height))
    header.extend(struct.pack(">H", resolution))
    header.extend(struct.pack(">H", resolution))
    header.extend([0x01 if use_g4 else 0x00])
    data.extend(_sf(SF_IPD, bytes(header)))

    row_bytes = width // 8
    for row in range(height):
        offset = row * row_bytes
        row_data = image_data[offset : offset + row_bytes]
        data.extend(_sf(SF_IPD, row_data))
    return bytes(data)


def _to_bilevel(image_data: bytes, width: int, height: int, threshold: int = 128) -> bytes:
    row_bytes = width // 8
    output = bytearray(row_bytes * height)
    for y in range(height):
        for x in range(width):
            pixel = image_data[y * width + x]
            if pixel < threshold:
                byte_index = y * row_bytes + (x // 8)
                bit_index = 7 - (x % 8)
                output[byte_index] |= 1 << bit_index
    return bytes(output)


def generate_page_segment(
    image_data: bytes,
    width: int,
    height: int,
    x_resolution: int = 240,
    y_resolution: int = 240,
    segment_name: str = "PAGESEG1",
) -> bytes:
    segment_name = segment_name.upper()
    if not segment_name.startswith("S1"):
        segment_name = "S1" + segment_name
    segment_name = segment_name[:8]

    padded_width = ((width + 7) // 8) * 8
    if padded_width != width:
        padded_data = bytearray(padded_width * height)
        for y in range(height):
            for x in range(width):
                if y * width + x < len(image_data):
                    padded_data[y * padded_width + x] = image_data[y * width + x]
        image_data = bytes(padded_data)
        width = padded_width

    bilevel_data = _to_bilevel(image_data, width, height)

    result = bytearray()
    result.extend(_build_bps(segment_name))
    result.extend(_build_nop_records(segment_name))
    result.extend(_build_bio(segment_name))
    result.extend(_build_bog())
    result.extend(_build_obd(width, height, x_resolution))
    result.extend(_build_obp(0, 0, x_resolution))
    result.extend(_build_idd(width, height, x_resolution))
    result.extend(_build_eog())
    result.extend(_build_ipd_records(bilevel_data, width, height, x_resolution, use_g4=True))
    result.extend(_build_eio())
    result.extend(_build_eps(segment_name))

    return bytes(result)
