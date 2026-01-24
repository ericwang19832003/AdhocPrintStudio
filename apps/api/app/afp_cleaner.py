"""
AFP Cleaner - Remove Index/Grouping Structured Fields

This module removes Named Page Group and Index Element structured fields
that are added by mainframe processing (e.g., StreamWeaver) and may not
be recognized by downstream systems like Bluecrest Output Manager.

Structured fields removed:
- BNG (D3 A8 5F) - Begin Named Page Group (when containing S-number)
- ENG (D3 A9 5F) - End Named Page Group (when containing S-number)
- BIE (D3 A8 FB) - Begin Index Element (when containing S-number)
- EIE (D3 A9 FB) - End Index Element (when containing S-number)
- IEL (D3 AF 5F) - Index Element Link (when containing S-number)

These are identified by:
1. Specific structured field type codes
2. Length of 16 bytes (0x0010)
3. Data containing S-number pattern (EBCDIC 'S' = 0xE2 followed by digits)
"""

import struct
from typing import Tuple, List

# AFP Carriage Control character
CC = 0x5A

# Structured field types to potentially remove (when they contain S-numbers)
SF_TYPES_TO_CHECK = {
    bytes([0xD3, 0xA8, 0x5F]): "BNG (Begin Named Page Group)",
    bytes([0xD3, 0xA9, 0x5F]): "ENG (End Named Page Group)",
    bytes([0xD3, 0xA8, 0xFB]): "BIE (Begin Index Element)",
    bytes([0xD3, 0xA9, 0xFB]): "EIE (End Index Element)",
    bytes([0xD3, 0xAF, 0x5F]): "IEL (Index Element Link)",
}

# S-number pattern: EBCDIC 'S' (0xE2) followed by EBCDIC digits (0xF0-0xF9)
def _is_s_number(data: bytes) -> bool:
    """Check if data contains an S-number pattern (S followed by 7 digits in EBCDIC)."""
    if len(data) < 8:
        return False

    # Look for EBCDIC 'S' (0xE2) followed by 7 EBCDIC digits (0xF0-0xF9)
    for i in range(len(data) - 7):
        if data[i] == 0xE2:  # EBCDIC 'S'
            is_s_number = True
            for j in range(1, 8):
                if not (0xF0 <= data[i + j] <= 0xF9):
                    is_s_number = False
                    break
            if is_s_number:
                return True
    return False


def _parse_structured_field(data: bytes, offset: int) -> Tuple[int, bytes, bytes, int]:
    """
    Parse an AFP structured field at the given offset.

    Returns: (total_length, sf_type, sf_data, next_offset)

    AFP structured field format:
    - 1 byte: Carriage control (0x5A)
    - 2 bytes: Length (big-endian, includes these 2 bytes + 3-byte SF ID + data)
    - 3 bytes: Structured field identifier
    - N bytes: Data (length - 5 bytes)
    """
    if offset >= len(data):
        return (0, b'', b'', offset)

    # Check for carriage control
    if data[offset] != CC:
        # Skip to next 0x5A
        next_cc = data.find(bytes([CC]), offset + 1)
        if next_cc == -1:
            return (0, b'', b'', len(data))
        return (0, b'', b'', next_cc)

    if offset + 6 > len(data):
        return (0, b'', b'', len(data))

    # Parse length (2 bytes, big-endian)
    length = struct.unpack('>H', data[offset + 1:offset + 3])[0]

    # Parse SF type (3 bytes)
    sf_type = data[offset + 3:offset + 6]

    # Calculate data length
    data_length = length - 5  # length includes 2-byte length + 3-byte SF ID
    if data_length < 0:
        data_length = 0

    # Extract data
    sf_data = data[offset + 6:offset + 6 + data_length]

    # Total length includes CC byte + length bytes + SF ID + data
    total_length = 1 + length

    return (total_length, sf_type, sf_data, offset + total_length)


def clean_afp(input_data: bytes, verbose: bool = False) -> Tuple[bytes, dict]:
    """
    Remove index/grouping structured fields from AFP data.

    Args:
        input_data: Raw AFP file bytes
        verbose: If True, print details about removed fields

    Returns:
        Tuple of (cleaned_data, stats_dict)
        stats_dict contains counts of removed fields by type
    """
    output = bytearray()
    stats = {name: 0 for name in SF_TYPES_TO_CHECK.values()}
    stats["total_removed"] = 0
    stats["total_kept"] = 0

    offset = 0
    while offset < len(input_data):
        total_length, sf_type, sf_data, next_offset = _parse_structured_field(input_data, offset)

        if total_length == 0:
            # Skip byte or end of file
            if next_offset > offset:
                output.extend(input_data[offset:next_offset])
            offset = next_offset
            continue

        # Check if this is an index/grouping SF with S-number
        should_remove = False
        if sf_type in SF_TYPES_TO_CHECK:
            if _is_s_number(sf_data):
                should_remove = True
                sf_name = SF_TYPES_TO_CHECK[sf_type]
                stats[sf_name] += 1
                stats["total_removed"] += 1

                if verbose:
                    # Decode S-number for display
                    s_num = ""
                    for b in sf_data:
                        if b == 0xE2:
                            s_num += "S"
                        elif 0xF0 <= b <= 0xF9:
                            s_num += chr(b - 0xF0 + ord('0'))
                    print(f"Removing {sf_name}: {s_num} at offset 0x{offset:x}")

        if not should_remove:
            # Keep this structured field
            output.extend(input_data[offset:offset + total_length])
            stats["total_kept"] += 1

        offset = next_offset

    return bytes(output), stats


def clean_afp_file(input_path: str, output_path: str = None, verbose: bool = False) -> dict:
    """
    Clean an AFP file by removing index/grouping structured fields.

    Args:
        input_path: Path to input AFP file
        output_path: Path for cleaned output file (default: input_path + ".cleaned")
        verbose: If True, print details about removed fields

    Returns:
        Statistics dictionary
    """
    if output_path is None:
        output_path = input_path + ".cleaned"

    with open(input_path, 'rb') as f:
        input_data = f.read()

    print(f"Input file: {input_path}")
    print(f"Input size: {len(input_data):,} bytes")

    cleaned_data, stats = clean_afp(input_data, verbose=verbose)

    with open(output_path, 'wb') as f:
        f.write(cleaned_data)

    print(f"\nOutput file: {output_path}")
    print(f"Output size: {len(cleaned_data):,} bytes")
    print(f"Size reduction: {len(input_data) - len(cleaned_data):,} bytes")
    print(f"\nRemoval statistics:")
    for name, count in stats.items():
        if name not in ("total_removed", "total_kept") and count > 0:
            print(f"  {name}: {count}")
    print(f"  Total removed: {stats['total_removed']}")
    print(f"  Total kept: {stats['total_kept']}")

    return stats


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python afp_cleaner.py <input_file> [output_file] [-v]")
        print("\nRemoves index/grouping structured fields from AFP files")
        print("that may cause issues with Bluecrest Output Manager.")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = None
    verbose = "-v" in sys.argv or "--verbose" in sys.argv

    for arg in sys.argv[2:]:
        if arg not in ("-v", "--verbose"):
            output_file = arg
            break

    clean_afp_file(input_file, output_file, verbose=verbose)
