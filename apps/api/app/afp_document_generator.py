"""
AFP Document Generator

Generates complete IBM AFP documents with:
- Document structure (BDT/EDT)
- Page structure (BPG/EPG)
- TLE (Tag Logical Element) for indexing
- Page segments with IOCA image data

Compatible with mainframe processing, reblocking, and AFP viewers.
"""

import struct
from datetime import datetime
from typing import List, Dict, Optional

# Carriage control (Machine Carriage Control for AFP)
CC = 0x5A

# Structured Field Identifiers (per AFP Architecture Reference)
SF_BDT = bytes([0xD3, 0xA8, 0xC6])  # Begin Document (D3 A8 C6)
SF_EDT = bytes([0xD3, 0xA9, 0xC6])  # End Document (D3 A9 C6)
SF_BPG = bytes([0xD3, 0xA8, 0xAF])  # Begin Page (D3 A8 AF)
SF_EPG = bytes([0xD3, 0xA9, 0xAF])  # End Page (D3 A9 AF)
SF_PGD = bytes([0xD3, 0xA6, 0xC4])  # Page Descriptor
SF_TLE = bytes([0xD3, 0xA0, 0x90])  # Tag Logical Element
SF_NOP = bytes([0xD3, 0xEE, 0xEE])  # No Operation

# Page Segment structured fields
SF_BPS = bytes([0xD3, 0xA8, 0x5F])  # Begin Page Segment
SF_EPS = bytes([0xD3, 0xA9, 0x5F])  # End Page Segment
SF_BIO = bytes([0xD3, 0xA8, 0xFB])  # Begin Image Object
SF_EIO = bytes([0xD3, 0xA9, 0xFB])  # End Image Object
SF_IDD = bytes([0xD3, 0xA6, 0xFB])  # Image Data Descriptor
SF_IPD = bytes([0xD3, 0xEE, 0xFB])  # Image Picture Data

# Object Environment Group
SF_BOG = bytes([0xD3, 0xA8, 0xC7])  # Begin Object Environment Group
SF_EOG = bytes([0xD3, 0xA9, 0xC7])  # End Object Environment Group
SF_OBD = bytes([0xD3, 0xA6, 0x6B])  # Object Area Descriptor
SF_OBP = bytes([0xD3, 0xAC, 0x6B])  # Object Area Position
SF_IID = bytes([0xD3, 0xAB, 0xFB])  # Image Input Descriptor

# Include Page Segment
SF_IPS = bytes([0xD3, 0xAF, 0x5F])  # Include Page Segment

# Active Environment Group
SF_BAG = bytes([0xD3, 0xA8, 0xAD])  # Begin Active Environment Group
SF_EAG = bytes([0xD3, 0xA9, 0xAD])  # End Active Environment Group

# Medium Map (for grouping pages, not document boundaries)
SF_BMM = bytes([0xD3, 0xA8, 0xCC])  # Begin Medium Map (D3 A8 CC)
SF_EMM = bytes([0xD3, 0xA9, 0xCC])  # End Medium Map (D3 A9 CC)


def _sf(sf_id: bytes, data: bytes = b'') -> bytes:
    """Build structured field with carriage control (MCC format).

    Per AFP specification, the length field contains the count of bytes
    in the structured field, EXCLUDING the carriage control character.
    Length = length_field(2) + SF_ID(3) + data = 5 + len(data)
    """
    length = 5 + len(data)
    return bytes([CC]) + struct.pack('>H', length) + sf_id + data


def _to_ebcdic(text: str, length: int = 8) -> bytes:
    """Convert text to EBCDIC, padded/truncated to specified length."""
    return text.upper()[:length].ljust(length).encode('cp500')


def _build_bdt(document_name: str = "DOCUMENT") -> bytes:
    """
    Build Begin Document (BDT) structured field.

    Format: 3 flag bytes + 8-char EBCDIC document name
    """
    data = bytes([0x00, 0x00, 0x00]) + _to_ebcdic(document_name, 8)
    return _sf(SF_BDT, data)


def _build_edt(document_name: str = "DOCUMENT") -> bytes:
    """
    Build End Document (EDT) structured field.

    Format: 3 flag bytes + 8-char EBCDIC document name
    """
    data = bytes([0x00, 0x00, 0x00]) + _to_ebcdic(document_name, 8)
    return _sf(SF_EDT, data)


def _build_bmm(map_name: str = "") -> bytes:
    """
    Build Begin Medium Map (BMM) structured field.
    Used by Crawford format instead of BDT.

    Format: 3 flag bytes + 8-char EBCDIC name (spaces if empty)
    """
    data = bytes([0x00, 0x00, 0x00]) + _to_ebcdic(map_name, 8)
    return _sf(SF_BMM, data)


def _build_emm(map_name: str = "") -> bytes:
    """
    Build End Medium Map (EMM) structured field.

    Format: 3 flag bytes + 8-char EBCDIC name (spaces if empty)
    """
    data = bytes([0x00, 0x00, 0x00]) + _to_ebcdic(map_name, 8)
    return _sf(SF_EMM, data)


def _build_bpg(page_name: str = "PAGE0001") -> bytes:
    """
    Build Begin Page (BPG) structured field.

    Format: 3 flag bytes + 8-char EBCDIC page name
    """
    data = bytes([0x00, 0x00, 0x00]) + _to_ebcdic(page_name, 8)
    return _sf(SF_BPG, data)


def _build_epg(page_name: str = "PAGE0001") -> bytes:
    """
    Build End Page (EPG) structured field.

    Format: 3 flag bytes + 8-char EBCDIC page name
    """
    data = bytes([0x00, 0x00, 0x00]) + _to_ebcdic(page_name, 8)
    return _sf(SF_EPG, data)


def _build_pgd(width: int = 2040, height: int = 2640, resolution: int = 240) -> bytes:
    """
    Build Page Descriptor (PGD) structured field.

    Default is 8.5" x 11" at 240 DPI.

    Format:
    - 3 flag bytes
    - XpgBase (3 bytes) - units base
    - YpgBase (3 bytes) - units base
    - XpgSize (3 bytes) - page width
    - YpgSize (3 bytes) - page height
    """
    data = bytearray()

    # Flag bytes
    data.extend([0x00, 0x00, 0x00])

    # XpgBase and YpgBase - L-units per unit base (240 per inch * 10 = 2400)
    # Using 2400 L-units per 10 inches
    data.extend([0x00, 0x09, 0x60])  # 2400 in 3 bytes
    data.extend([0x00, 0x09, 0x60])  # 2400 in 3 bytes

    # XpgSize - page width in L-units (8.5 * 240 = 2040)
    data.extend([0x00])
    data.extend(struct.pack('>H', width))

    # YpgSize - page height in L-units (11 * 240 = 2640)
    data.extend([0x00])
    data.extend(struct.pack('>H', height))

    return _sf(SF_PGD, bytes(data))


def _build_tle(attribute_name: str, attribute_value: str) -> bytes:
    """
    Build Tag Logical Element (TLE) structured field.

    TLE is used for indexing and can be extracted by mainframe tools
    for sorting, selecting, and routing print jobs.

    Column layout after reblocking:
    - Bytes 1-6:   CC + Length + SF_ID (fixed)
    - Bytes 7-9:   Flags (fixed)
    - Byte 10+:    Name triplet (0x02) - variable length based on name
    - After name:  Value triplet (0x36)

    Args:
        attribute_name: The TLE attribute name
        attribute_value: The TLE attribute value (can be empty string)
    """
    data = bytearray()

    # Flag bytes (columns 7-9)
    data.extend([0x00, 0x00, 0x00])

    # Name triplet (0x02) - Crawford format
    # Structure: length(1) + ID(1) + FQN_type(1) + format(1) + name(N)
    name_ebcdic = attribute_name[:250].encode('cp500')
    name_triplet_len = 4 + len(name_ebcdic)  # 4 bytes overhead + name

    name_triplet = bytearray()
    name_triplet.append(name_triplet_len)  # Length of triplet
    name_triplet.append(0x02)  # Triplet ID - FQN
    name_triplet.append(0x0B)  # FQN Type - Attribute GID
    name_triplet.append(0x00)  # Format
    name_triplet.extend(name_ebcdic)
    data.extend(name_triplet)

    # Value triplet (0x36) - Crawford format
    # Structure: length(1) + ID(1) + reserved(2) + value(N)
    # Always include value triplet even if value is empty
    value_ebcdic = attribute_value[:250].encode('cp500') if attribute_value else b''
    value_triplet = bytearray()
    value_triplet.append(len(value_ebcdic) + 4)  # Length (4 bytes overhead + value)
    value_triplet.append(0x36)  # Triplet ID - Attribute Value
    value_triplet.extend([0x00, 0x00])  # Reserved bytes (Crawford format)
    value_triplet.extend(value_ebcdic)
    data.extend(value_triplet)

    return _sf(SF_TLE, bytes(data))


def _build_nop_comment(comment: str) -> bytes:
    """Build NOP (No Operation) record with comment."""
    comment_padded = comment[:86].ljust(86)

    # EBCDIC version
    data = bytes([0x00, 0x00, 0x00]) + comment_padded.encode('cp500')
    return _sf(SF_NOP, data)


def _build_ips(segment_name: str) -> bytes:
    """
    Build Include Page Segment (IPS) structured field.

    References a page segment by name.
    """
    data = bytes([0x00, 0x00, 0x00]) + _to_ebcdic(segment_name, 8)
    return _sf(SF_IPS, data)


def _build_bag() -> bytes:
    """
    Build Begin Active Environment Group (BAG) structured field.

    The AEG contains resource mappings and environment settings for the page.
    """
    data = bytes([0x00, 0x00, 0x00])
    return _sf(SF_BAG, data)


def _build_eag() -> bytes:
    """
    Build End Active Environment Group (EAG) structured field.
    """
    data = bytes([0x00, 0x00, 0x00])
    return _sf(SF_EAG, data)


# ============== Image/Page Segment Building Functions ==============

def _build_bps(name: str) -> bytes:
    """Begin Page Segment."""
    data = bytes([0x00, 0x00, 0x00]) + _to_ebcdic(name, 8)
    return _sf(SF_BPS, data)


def _build_eps(name: str) -> bytes:
    """End Page Segment."""
    data = bytes([0x00, 0x00, 0x00]) + _to_ebcdic(name, 8)
    return _sf(SF_EPS, data)


def _build_bio(name: str) -> bytes:
    """Begin Image Object."""
    data = bytes([0x00, 0x00, 0x00]) + _to_ebcdic(name, 8)
    return _sf(SF_BIO, data)


def _build_eio() -> bytes:
    """End Image Object."""
    return _sf(SF_EIO, bytes([0x00, 0x00, 0x00]))


def _build_bog() -> bytes:
    """Begin Object Environment Group."""
    return _sf(SF_BOG, bytes([0x00, 0x00, 0x00]))


def _build_eog() -> bytes:
    """End Object Environment Group."""
    return _sf(SF_EOG, bytes([0x00, 0x00, 0x00]))


def _build_obd(width: int, height: int, resolution: int = 240) -> bytes:
    """Object Area Descriptor (OBD) - Elixir compatible."""
    data = bytearray()
    data.extend([0x00, 0x00, 0x00])
    data.extend([0x03, 0x43, 0x01])
    data.extend([0x08, 0x4B, 0x00, 0x00, 0x38, 0x40, 0x38, 0x40])
    data.extend([0x09, 0x4C, 0x02, 0x00, 0x23, 0x4E, 0x00, 0x21, 0x95])
    return _sf(SF_OBD, bytes(data))


def _build_obp() -> bytes:
    """Object Area Position (OBP) - Elixir compatible."""
    data = bytearray()
    data.extend([0x00, 0x00, 0x00])
    data.append(0x01)
    data.append(0x17)
    data.extend([0x00] * 8)
    data.extend([0x2d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    data.extend([0x00, 0x00, 0x00])
    data.extend([0x2d, 0x00, 0x00])
    return _sf(SF_OBP, bytes(data))


def _build_idd(width: int, height: int, resolution: int = 240) -> bytes:
    """Image Data Descriptor (IDD) - IOCA format."""
    data = bytearray()
    data.extend([0x00, 0x00, 0x00, 0x00])
    res_10 = resolution * 10
    data.extend(struct.pack('>H', res_10))
    data.extend(struct.pack('>H', res_10))
    data.extend(struct.pack('>H', width))
    data.extend(struct.pack('>H', height))
    data.extend([0xF6, 0x04, 0x00, 0x00, 0x00, 0x08])
    return _sf(SF_IDD, bytes(data))


def _build_iid() -> bytes:
    """Image Input Descriptor (IID) - specifies IOCA image format.

    Crawford format: 0005030410
    - Triplet 0x03 (Set Extended Bilevel Image Color)
    - Data: 0x04 0x10 (IOCA FS10 format indicator)
    """
    data = bytearray()
    data.extend([0x00, 0x00, 0x00])  # Flags
    data.extend([0x00, 0x05, 0x03, 0x04, 0x10])  # Triplet for IOCA FS10
    return _sf(SF_IID, bytes(data))


def _build_ipd_records(image_data: bytes, width: int, height: int, resolution: int = 240) -> bytes:
    """Build Image Picture Data (IPD) records with IOCA self-defining fields."""
    result = bytearray()

    # First IPD - headers
    first_ipd = bytearray()
    first_ipd.extend([0x00, 0x00, 0x00])
    first_ipd.extend([0x70, 0x00])
    first_ipd.extend([0x91, 0x01, 0xff])

    res_10 = resolution * 10
    first_ipd.extend([0x94, 0x09, 0x00])
    first_ipd.extend(struct.pack('>H', res_10))
    first_ipd.extend(struct.pack('>H', res_10))
    first_ipd.extend(struct.pack('>H', width))
    first_ipd.extend(struct.pack('>H', height))

    first_ipd.extend([0x95, 0x02, 0x03, 0x01])
    first_ipd.extend([0x96, 0x01, 0x01])
    first_ipd.extend([0x97, 0x01, 0x00])
    first_ipd.extend([0xFE, 0x92])
    first_ipd.extend(struct.pack('>H', min(len(image_data), 0x1FF4)))

    result.extend(_sf(SF_IPD, bytes(first_ipd)))

    # Data IPDs
    max_data_per_ipd = 8180
    offset = 0
    total = len(image_data)
    ipd_num = 1

    while offset < total:
        chunk = bytearray()
        chunk.extend([0x00, 0x00, 0x00])

        remaining = total - offset
        chunk_size = min(max_data_per_ipd, remaining)
        ipd_num += 1

        is_last = (offset + chunk_size >= total)
        is_first_data_ipd = (ipd_num == 2)

        if is_first_data_ipd and is_last:
            chunk.extend(image_data[offset:offset + chunk_size])
            chunk.extend([0x93, 0x00, 0x71, 0x00])
        elif is_first_data_ipd:
            chunk.extend(image_data[offset:offset + chunk_size])
        elif is_last:
            chunk.extend([0xFE, 0x92])
            chunk.extend(struct.pack('>H', chunk_size))
            chunk.extend(image_data[offset:offset + chunk_size])
            chunk.extend([0x93, 0x00, 0x71, 0x00])
        else:
            chunk.extend([0xFE, 0x92])
            chunk.extend(struct.pack('>H', chunk_size))
            chunk.extend(image_data[offset:offset + chunk_size])

        result.extend(_sf(SF_IPD, bytes(chunk)))
        offset += chunk_size

    return bytes(result)


def _to_bilevel(gray: bytes, w: int, h: int) -> bytes:
    """Convert grayscale to 1-bit bilevel (WhiteIsZero)."""
    bpr = (w + 7) // 8
    out = bytearray(bpr * h)

    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if idx < len(gray):
                if gray[idx] < 128:
                    out[y * bpr + x // 8] |= (0x80 >> (x % 8))

    return bytes(out)


def generate_inline_image(
    image_data: bytes,
    width: int,
    height: int,
    resolution: int = 240
) -> bytes:
    """
    Generate an inline image object (without page segment wrapper).

    This embeds the image directly in the page using BIO...EIO structure,
    avoiding BPS/EPS/IPS which Bluecrest interprets as page segment references.
    """
    # Ensure width is byte-aligned
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
    # Image object without page segment wrapper
    # Use empty name to avoid any segment reference issues
    result.extend(_build_bio(""))
    result.extend(_build_bog())
    result.extend(_build_obd(width, height, resolution))
    result.extend(_build_obp())
    result.extend(_build_iid())
    result.extend(_build_idd(width, height, resolution))
    result.extend(_build_eog())
    result.extend(_build_ipd_records(bilevel_data, width, height, resolution))
    result.extend(_build_eio())

    return bytes(result)


def generate_inline_page_segment(
    image_data: bytes,
    width: int,
    height: int,
    segment_name: str,
    resolution: int = 240
) -> bytes:
    """
    Generate an inline page segment with IOCA image data.

    This creates BPS...EPS structure that can be embedded in a page.
    NOTE: This may cause issues with Bluecrest - use generate_inline_image instead.
    """
    segment_name = segment_name.upper()[:8]

    # Ensure width is byte-aligned
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
    result.extend(_build_bio(segment_name))
    result.extend(_build_bog())
    result.extend(_build_obd(width, height, resolution))
    result.extend(_build_obp())
    result.extend(_build_iid())  # Image Input Descriptor (required by some viewers)
    result.extend(_build_idd(width, height, resolution))
    result.extend(_build_eog())
    result.extend(_build_ipd_records(bilevel_data, width, height, resolution))
    result.extend(_build_eio())
    result.extend(_build_eps(segment_name))

    return bytes(result)


def generate_afp_document(
    pages: List[Dict],
    document_name: str = "PRINTDOC",
    resolution: int = 240,
    page_width: int = 2040,
    page_height: int = 2640
) -> bytes:
    """
    Generate a complete AFP document with TLE index data.

    Each page is wrapped in its own BDT/EDT (Begin/End Document) structure
    so that mainframe tools like Enrichment One can detect document boundaries
    based on TLE records.

    Args:
        pages: List of page dictionaries, each containing:
            - image_data: bytes - grayscale image data
            - width: int - image width in pixels
            - height: int - image height in pixels
            - tle_data: dict - TLE index fields:
                - mailing_name
                - mailing_addr1
                - mailing_addr2
                - mailing_addr3
                - return_addr1
                - return_addr2
                - return_addr3
        document_name: str - 8-character document name
        resolution: int - DPI (default 240)
        page_width: int - page width in L-units (default 8.5" at 240 DPI)
        page_height: int - page height in L-units (default 11" at 240 DPI)

    Returns:
        bytes - Complete AFP document
    """
    result = bytearray()

    # Generate each page as a separate document (BDT/EDT wrapper)
    # This allows Enrichment One to detect document boundaries via TLE records
    for page_num, page in enumerate(pages, start=1):
        doc_name = f"DOC{page_num:05d}"
        page_name = f"P{page_num:07d}"

        # Begin Document - each letter is its own document
        result.extend(_build_bdt(doc_name))

        # Begin Page
        result.extend(_build_bpg(page_name))

        # Begin Active Environment Group
        result.extend(_build_bag())

        # End Active Environment Group
        result.extend(_build_eag())

        # TLE records for this page (critical for document detection)
        # Enrichment One uses these to identify document boundaries
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
            # Always write TLE records, even when value is empty
            result.extend(_build_tle(field_name, field_value))

        # Inline image (without page segment wrapper to avoid Bluecrest issues)
        # Using direct BIO/EIO structure instead of BPS/EPS/IPS
        image_data = page.get('image_data', b'')
        width = page.get('width', page_width)
        height = page.get('height', page_height)

        if image_data:
            # Embed image directly without page segment wrapper
            result.extend(generate_inline_image(
                image_data=image_data,
                width=width,
                height=height,
                resolution=resolution
            ))

        # End Page
        result.extend(_build_epg(page_name))

        # End Document - closes this letter's document boundary
        result.extend(_build_edt(doc_name))

    return bytes(result)


# Convenience function for simple usage
def create_afp_with_tle(
    page_images: List[bytes],
    page_dimensions: List[tuple],
    tle_records: List[Dict[str, str]],
    document_name: str = "MAILOUT"
) -> bytes:
    """
    Simplified function to create AFP document with TLE data.

    Args:
        page_images: List of grayscale image bytes
        page_dimensions: List of (width, height) tuples
        tle_records: List of TLE dictionaries with fields:
            - mailing_name, mailing_addr1, mailing_addr2, mailing_addr3
            - return_addr1, return_addr2, return_addr3
        document_name: Document identifier

    Returns:
        Complete AFP document bytes
    """
    pages = []
    for i, (image_data, (width, height), tle_data) in enumerate(
        zip(page_images, page_dimensions, tle_records)
    ):
        pages.append({
            'image_data': image_data,
            'width': width,
            'height': height,
            'tle_data': tle_data
        })

    return generate_afp_document(pages, document_name)
