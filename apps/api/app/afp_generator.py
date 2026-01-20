"""
AFP Page Segment Generator

Generates AFP page segments in IOCA format matching Elixir DesignPro output.
Compatible with SCRIPT/VS, DCF, and 3820.
"""

import struct
import io
from PIL import Image

# Line ending between structured fields (as used by Elixir)
CRLF = b'\x0d\x0a'
CC = 0x5A

# Structured Field Identifiers (IOCA format - category FB)
SF_BPS = bytes([0xD3, 0xA8, 0x5F])  # Begin Page Segment
SF_EPS = bytes([0xD3, 0xA9, 0x5F])  # End Page Segment
SF_BIO = bytes([0xD3, 0xA8, 0xFB])  # Begin Image Object
SF_EIO = bytes([0xD3, 0xA9, 0xFB])  # End Image Object
SF_IDD = bytes([0xD3, 0xA6, 0xFB])  # Image Data Descriptor
SF_IPD = bytes([0xD3, 0xEE, 0xFB])  # Image Picture Data

# Object Environment Group structured fields
SF_BOG = bytes([0xD3, 0xA8, 0xC7])  # Begin Object Environment Group
SF_EOG = bytes([0xD3, 0xA9, 0xC7])  # End Object Environment Group
SF_OBD = bytes([0xD3, 0xA6, 0x6B])  # Object Area Descriptor
SF_OBP = bytes([0xD3, 0xAC, 0x6B])  # Object Area Position

# NOP (No Operation) - used for comments/metadata
SF_NOP = bytes([0xD3, 0xEE, 0xEE])  # No Operation


def _sf(sf_id: bytes, data: bytes = b'') -> bytes:
    """Build structured field with CRLF suffix."""
    length = 5 + len(data)
    return bytes([CC]) + struct.pack('>H', length) + sf_id + data + CRLF


def _build_bps(name: str) -> bytes:
    """Begin Page Segment: 3 flag bytes + 8-char EBCDIC name."""
    ebcdic_name = name.upper()[:8].ljust(8).encode('cp500')
    data = bytes([0x00, 0x00, 0x00]) + ebcdic_name
    return _sf(SF_BPS, data)


def _build_nop_records(name: str) -> bytes:
    """
    Build NOP (No Operation) records with metadata.
    """
    from datetime import datetime

    result = bytearray()

    # Get current timestamp
    now = datetime.now()
    timestamp = now.strftime("%m/%d/%Y   %I:%M:%S %p")

    # Build comment text with custom copyright
    comment = f"{name.upper()[:8].ljust(8)} (c)2025 Copyright by Elevance Health {timestamp}"

    # Pad to fixed length (86 chars)
    comment = comment[:86].ljust(86)

    # First NOP: EBCDIC encoded
    ebcdic_comment = comment.encode('cp500')
    data1 = bytes([0x00, 0x00, 0x00]) + ebcdic_comment
    result.extend(_sf(SF_NOP, data1))

    # Second NOP: ASCII encoded
    ascii_comment = comment.encode('ascii')
    data2 = bytes([0x00, 0x00, 0x00]) + ascii_comment
    result.extend(_sf(SF_NOP, data2))

    return bytes(result)


def _build_eps(name: str) -> bytes:
    """End Page Segment: 3 flag bytes + 8-char EBCDIC name (matching Elixir format)."""
    ebcdic_name = name.upper()[:8].ljust(8).encode('cp500')
    data = bytes([0x00, 0x00, 0x00]) + ebcdic_name
    return _sf(SF_EPS, data)


def _build_bio(name: str) -> bytes:
    """Begin Image Object: 3 flag bytes + 8-char EBCDIC name."""
    ebcdic_name = name.upper()[:8].ljust(8).encode('cp500')
    data = bytes([0x00, 0x00, 0x00]) + ebcdic_name
    return _sf(SF_BIO, data)


def _build_eio() -> bytes:
    """End Image Object (with 3 flag bytes)."""
    return _sf(SF_EIO, bytes([0x00, 0x00, 0x00]))


def _build_bog() -> bytes:
    """Begin Object Environment Group (with 3 flag bytes)."""
    return _sf(SF_BOG, bytes([0x00, 0x00, 0x00]))


def _build_eog() -> bytes:
    """End Object Environment Group (with 3 flag bytes)."""
    return _sf(SF_EOG, bytes([0x00, 0x00, 0x00]))


def _build_obd(width: int, height: int, resolution: int = 240) -> bytes:
    """
    Object Area Descriptor (OBD).

    Contains triplets describing the object area.
    Matches Elixir DesignPro format.
    """
    data = bytearray()

    # Reserved flags (3 bytes)
    data.extend([0x00, 0x00, 0x00])

    # Triplet 1: 0x43 - Descriptor Position (3 bytes)
    data.extend([0x03, 0x43, 0x01])

    # Triplet 2: 0x4B - Mapping Option (8 bytes)
    # Use 14400 L-units per 10 inches (1440 DPI reference)
    data.extend([0x08, 0x4B, 0x00, 0x00])
    data.extend([0x38, 0x40])  # 14400 X L-units
    data.extend([0x38, 0x40])  # 14400 Y L-units

    # Triplet 3: 0x4C - Object Classification (9 bytes)
    # Using Elixir DesignPro values: 23 4E 00 21 95
    data.extend([0x09, 0x4C, 0x02, 0x00, 0x23, 0x4E, 0x00, 0x21, 0x95])

    return _sf(SF_OBD, bytes(data))


def _build_obp(x_offset: int = 0, y_offset: int = 0, resolution: int = 240) -> bytes:
    """
    Object Area Position (OBP).

    Defines the position of the object within the page.
    Matches Elixir DesignPro format.
    """
    data = bytearray()

    # Reserved flags (3 bytes)
    data.extend([0x00, 0x00, 0x00])

    # OEP Repeating Group (Object Environment Position)
    # Format from Elixir: 01 17 + 21 bytes of position data
    data.append(0x01)  # RG identifier
    data.append(0x17)  # Length of following data (23 bytes)

    # Position data (all zeros for default positioning)
    data.extend([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])  # 8 bytes

    # Offset values (0x2d = 45 at specific positions, matching Elixir)
    data.extend([0x2d, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])  # 8 bytes
    data.extend([0x00, 0x00, 0x00])  # 3 bytes

    # Final offset
    data.extend([0x2d, 0x00, 0x00])  # 3 bytes

    return _sf(SF_OBP, bytes(data))


def _build_idd(width: int, height: int, resolution: int = 240) -> bytes:
    """
    Image Data Descriptor (IOCA format).

    Matches Elixir DesignPro format.
    Format: 4 reserved bytes + resolution (4 bytes) + dimensions (4 bytes) + flags
    """
    data = bytearray()

    # Reserved bytes (4 bytes, matching Elixir)
    data.extend([0x00, 0x00, 0x00, 0x00])

    # Resolution units per 10 inches
    res_10 = resolution * 10
    data.extend(struct.pack('>H', res_10))  # X resolution
    data.extend(struct.pack('>H', res_10))  # Y resolution

    # Image dimensions
    data.extend(struct.pack('>H', width))   # Width in pels
    data.extend(struct.pack('>H', height))  # Height in pels

    # Additional flags/parameters (matching Elixir: f6 04 00 00 00 08)
    data.extend([0xF6, 0x04, 0x00, 0x00, 0x00, 0x08])

    return _sf(SF_IDD, bytes(data))


def _build_ipd_records(image_data: bytes, width: int, height: int, resolution: int = 240, use_g4: bool = True) -> bytes:
    """
    Build Image Picture Data records with IOCA self-defining fields.
    Matches Elixir DesignPro format exactly.

    Elixir format:
    - First IPD: headers + FE 92 marker (no image data in first IPD)
    - Continuation IPDs: flags + raw image data (NO FE marker)
    - Final IPD: flags + 93 01 ff (End Image Content)
    """
    result = bytearray()

    # First IPD contains Begin Image Content and image parameters only
    first_ipd = bytearray()

    # Flags (3 bytes)
    first_ipd.extend([0x00, 0x00, 0x00])

    # IOCA function set identifier (matching Elixir: 70 00)
    first_ipd.extend([0x70, 0x00])

    # Begin Image Content (0x91)
    first_ipd.extend([0x91, 0x01, 0xff])

    # Image Size Parameter (0x94)
    res_10 = resolution * 10
    first_ipd.extend([0x94, 0x09, 0x00])
    first_ipd.extend(struct.pack('>H', res_10))
    first_ipd.extend(struct.pack('>H', res_10))
    first_ipd.extend(struct.pack('>H', width))
    first_ipd.extend(struct.pack('>H', height))

    # Image Encoding Parameter (0x95)
    # Byte 1: Compression (0x03 = G4/MMR, 0x00 = uncompressed)
    # Byte 2: Recording algorithm (0x01 for G4)
    if use_g4:
        first_ipd.extend([0x95, 0x02, 0x03, 0x01])
    else:
        first_ipd.extend([0x95, 0x02, 0x00, 0x03])

    # IDE Structure (0x96)
    first_ipd.extend([0x96, 0x01, 0x01])

    # Bilevel Image Color (0x97)
    first_ipd.extend([0x97, 0x01, 0x00])

    # Image Data marker (0xFE 0x92) - indicates image data follows in subsequent IPDs
    # Elixir uses FE 92 followed by 2-byte total length indicator
    first_ipd.extend([0xFE, 0x92])
    # Add placeholder length (will be filled by subsequent IPDs)
    first_ipd.extend(struct.pack('>H', min(len(image_data), 0x1FF4)))

    result.extend(_sf(SF_IPD, bytes(first_ipd)))

    # Image data IPDs - matching exact Elixir pattern:
    # - IPD #2 (first data IPD): NO FE marker, just raw data
    # - IPD #3+: FE 92 + length + data
    # - Last IPD: FE 92 + length + data + 93 00 (End Image Content)
    max_data_per_ipd = 8180  # Elixir uses 8180 bytes per chunk (0x1FF4)
    offset = 0
    total = len(image_data)
    ipd_num = 1  # First IPD was headers

    while offset < total:
        chunk = bytearray()
        # Add flags for continuation IPDs
        chunk.extend([0x00, 0x00, 0x00])

        remaining = total - offset
        chunk_size = min(max_data_per_ipd, remaining)
        ipd_num += 1

        is_last = (offset + chunk_size >= total)
        is_first_data_ipd = (ipd_num == 2)

        if is_first_data_ipd and is_last:
            # First and only data IPD: raw data + End Image Content (no FE marker)
            chunk.extend(image_data[offset:offset + chunk_size])
            chunk.extend([0x93, 0x00, 0x71, 0x00])  # End Image Content + End Tile (Elixir format)
        elif is_first_data_ipd:
            # First data IPD: NO FE marker, just raw data (matching Elixir IPD #2)
            chunk.extend(image_data[offset:offset + chunk_size])
        elif is_last:
            # Last IPD: FE 92 + length + data + End Image Content
            chunk.extend([0xFE, 0x92])
            chunk.extend(struct.pack('>H', chunk_size))
            chunk.extend(image_data[offset:offset + chunk_size])
            chunk.extend([0x93, 0x00, 0x71, 0x00])  # End Image Content + End Tile (Elixir format)
        else:
            # Middle IPDs: FE 92 + length + data
            chunk.extend([0xFE, 0x92])
            chunk.extend(struct.pack('>H', chunk_size))
            chunk.extend(image_data[offset:offset + chunk_size])

        result.extend(_sf(SF_IPD, bytes(chunk)))
        offset += chunk_size

    return bytes(result)


def _to_bilevel(gray: bytes, w: int, h: int) -> bytes:
    """
    Convert grayscale to 1-bit bilevel.

    Uses WhiteIsZero convention (IOCA standard):
    - bit=0 means white (background)
    - bit=1 means black (foreground/ink)
    """
    bpr = (w + 7) // 8
    out = bytearray(bpr * h)

    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if idx < len(gray):
                # WhiteIsZero: dark pixels (<128) get bit=1 (black)
                if gray[idx] < 128:
                    out[y * bpr + x // 8] |= (0x80 >> (x % 8))

    return bytes(out)


def _compress_g4(gray: bytes, w: int, h: int) -> bytes:
    """
    Compress grayscale image data to G4 (CCITT Group 4) format.

    Uses PIL to create a G4 compressed TIFF and extracts the compressed data.
    """
    # Create a bilevel image from grayscale
    img = Image.frombytes('L', (w, h), gray)

    # Convert to 1-bit with proper threshold
    # IOCA/AFP uses WhiteIsZero convention: 0=white, 1=black
    # PIL saves G4 with BlackIsZero, so we invert to get WhiteIsZero output:
    # - Light pixels (>= 128) → 0 in PIL → 0 bits → white in WhiteIsZero ✓
    # - Dark pixels (< 128) → 255 in PIL → 1 bits → black in WhiteIsZero ✓
    bilevel = img.point(lambda x: 255 if x < 128 else 0, '1')

    # Save as G4 compressed TIFF to extract compressed data
    # Use a single strip to simplify extraction
    tiff_buffer = io.BytesIO()
    bilevel.save(tiff_buffer, format='TIFF', compression='group4',
                 tiffinfo={278: h})  # RowsPerStrip = full height = single strip
    tiff_data = tiff_buffer.getvalue()

    # Parse TIFF to extract G4 compressed data
    # TIFF structure: header (8 bytes) + IFD + strip data
    # We need to find StripOffsets and StripByteCounts tags

    # Check byte order
    byte_order = tiff_data[0:2]
    if byte_order == b'II':  # Little-endian
        def read_short(data, offset):
            return struct.unpack('<H', data[offset:offset+2])[0]
        def read_long(data, offset):
            return struct.unpack('<I', data[offset:offset+4])[0]
    else:  # Big-endian (MM)
        def read_short(data, offset):
            return struct.unpack('>H', data[offset:offset+2])[0]
        def read_long(data, offset):
            return struct.unpack('>I', data[offset:offset+4])[0]

    # Get IFD offset
    ifd_offset = read_long(tiff_data, 4)

    # Parse IFD entries
    num_entries = read_short(tiff_data, ifd_offset)

    strip_offsets = None
    strip_byte_counts = None

    for i in range(num_entries):
        entry_offset = ifd_offset + 2 + (i * 12)
        tag = read_short(tiff_data, entry_offset)
        field_type = read_short(tiff_data, entry_offset + 2)
        count = read_long(tiff_data, entry_offset + 4)

        # For SHORT or LONG values that fit in 4 bytes, value is inline
        if tag == 273:  # StripOffsets
            if field_type == 3:  # SHORT
                strip_offsets = read_short(tiff_data, entry_offset + 8)
            else:  # LONG
                strip_offsets = read_long(tiff_data, entry_offset + 8)
        elif tag == 279:  # StripByteCounts
            if field_type == 3:  # SHORT
                strip_byte_counts = read_short(tiff_data, entry_offset + 8)
            else:  # LONG
                strip_byte_counts = read_long(tiff_data, entry_offset + 8)

    if strip_offsets is not None and strip_byte_counts is not None:
        # Extract the G4 compressed data
        g4_data = tiff_data[strip_offsets:strip_offsets + strip_byte_counts]
        return g4_data

    # Fallback: return uncompressed if extraction fails
    return _to_bilevel(gray, w, h)


def generate_page_segment(
    image_data: bytes,
    width: int,
    height: int,
    x_resolution: int = 240,
    y_resolution: int = 240,
    segment_name: str = 'PAGESEG1'
) -> bytes:
    """Generate AFP page segment in IOCA format (Elixir compatible) with raw bilevel data."""

    # Add S1 prefix if missing and ensure max 8 characters
    segment_name = segment_name.upper()
    if not segment_name.startswith("S1"):
        segment_name = "S1" + segment_name
    segment_name = segment_name[:8]

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

    # Convert grayscale to raw bilevel (WhiteIsZero: bit=0 is white, bit=1 is black)
    # IMPORTANT: Elixir DesignPro declares G4 in header but uses RAW bilevel data!
    # This is confirmed by analyzing S1RET261.seg - file size matches raw bilevel, not compressed
    bilevel_data = _to_bilevel(image_data, width, height)

    result = bytearray()

    # Page Segment structure (matching Elixir DesignPro format)
    # 1. Begin Page Segment
    result.extend(_build_bps(segment_name))

    # 2. NOP records with metadata (matching Elixir format)
    result.extend(_build_nop_records(segment_name))

    # 3. Begin Image Object
    result.extend(_build_bio(segment_name))

    # 3. Object Environment Group
    result.extend(_build_bog())
    result.extend(_build_obd(width, height, x_resolution))
    result.extend(_build_obp(0, 0, x_resolution))
    result.extend(_build_idd(width, height, x_resolution))
    result.extend(_build_eog())

    # 4. Image Picture Data with raw bilevel data
    # NOTE: use_g4=True sets header flag to 0x03,0x01 (matching Elixir)
    # but the DATA is raw bilevel (this is how Elixir works!)
    result.extend(_build_ipd_records(bilevel_data, width, height, x_resolution, use_g4=True))

    # 5. End Image Object
    result.extend(_build_eio())

    # 6. End Page Segment (with segment name, matching Elixir format)
    result.extend(_build_eps(segment_name))

    return bytes(result)
