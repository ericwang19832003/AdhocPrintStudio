#!/usr/bin/env python3
"""Test AFP generation and validate structure."""

import struct
from app.afp_document_generator import (
    generate_afp_document,
    _sf, _to_ebcdic, _build_bdt, _build_edt, _build_bpg, _build_epg, _build_pgd,
    CC, SF_BDT, SF_EDT, SF_BPG, SF_EPG, SF_PGD, SF_TLE, SF_NOP
)

def parse_structured_fields(data: bytes) -> list:
    """Parse AFP structured fields for debugging."""
    fields = []
    offset = 0

    SF_NAMES = {
        (0xD3, 0xA8, 0xA7): "BDT (Begin Document)",
        (0xD3, 0xA9, 0xA7): "EDT (End Document)",
        (0xD3, 0xA8, 0xA8): "BPG (Begin Page)",
        (0xD3, 0xA9, 0xA8): "EPG (End Page)",
        (0xD3, 0xA6, 0xC4): "PGD (Page Descriptor)",
        (0xD3, 0xA0, 0x90): "TLE (Tag Logical Element)",
        (0xD3, 0xEE, 0xEE): "NOP (No Operation)",
        (0xD3, 0xA8, 0x5F): "BPS (Begin Page Segment)",
        (0xD3, 0xA9, 0x5F): "EPS (End Page Segment)",
        (0xD3, 0xA8, 0xFB): "BIO (Begin Image Object)",
        (0xD3, 0xA9, 0xFB): "EIO (End Image Object)",
        (0xD3, 0xA6, 0xFB): "IDD (Image Data Descriptor)",
        (0xD3, 0xEE, 0xFB): "IPD (Image Picture Data)",
        (0xD3, 0xA8, 0xC7): "BOG (Begin Object Environment Group)",
        (0xD3, 0xA9, 0xC7): "EOG (End Object Environment Group)",
        (0xD3, 0xA6, 0x6B): "OBD (Object Area Descriptor)",
        (0xD3, 0xAC, 0x6B): "OBP (Object Area Position)",
        (0xD3, 0xAF, 0x5F): "IPS (Include Page Segment)",
        (0xD3, 0xA8, 0xAD): "BAG (Begin Active Environment Group)",
        (0xD3, 0xA9, 0xAD): "EAG (End Active Environment Group)",
    }

    while offset < len(data):
        if data[offset] != CC:
            print(f"Warning: Expected CC (0x5A) at offset {offset}, got 0x{data[offset]:02X}")
            offset += 1
            continue

        if offset + 3 > len(data):
            break

        length = struct.unpack('>H', data[offset+1:offset+3])[0]

        if offset + 1 + length > len(data):
            print(f"Warning: SF at offset {offset} has length {length} but only {len(data) - offset - 1} bytes remain")
            break

        sf_id = tuple(data[offset+3:offset+6])
        sf_name = SF_NAMES.get(sf_id, f"Unknown ({sf_id[0]:02X} {sf_id[1]:02X} {sf_id[2]:02X})")
        sf_data = data[offset+6:offset+1+length]

        fields.append({
            'offset': offset,
            'length': length,
            'sf_id': sf_id,
            'name': sf_name,
            'data': sf_data
        })

        offset += 1 + length

    return fields


def test_minimal_afp():
    """Test minimal AFP document generation."""
    print("=" * 60)
    print("Testing Minimal AFP Document Generation")
    print("=" * 60)

    # Create a simple 100x100 grayscale image (all white with a black box)
    width, height = 100, 100
    image_data = bytearray(width * height)
    for i in range(width * height):
        image_data[i] = 255  # White background

    # Draw a black rectangle
    for y in range(20, 80):
        for x in range(20, 80):
            image_data[y * width + x] = 0  # Black

    pages = [{
        'image_data': bytes(image_data),
        'width': width,
        'height': height,
        'tle_data': {
            'mailing_name': 'John Doe',
            'mailing_addr1': '123 Main Street',
            'mailing_addr2': 'Anytown, ST 12345',
            'mailing_addr3': '',
            'return_addr1': 'ACME Corp',
            'return_addr2': '456 Business Ave',
            'return_addr3': 'Commerce City, ST 67890',
        }
    }]

    afp_data = generate_afp_document(pages, document_name="TESTDOC")

    print(f"\nGenerated AFP size: {len(afp_data)} bytes")
    print(f"\nFirst 100 bytes (hex):")
    for i in range(0, min(100, len(afp_data)), 16):
        hex_str = ' '.join(f'{b:02X}' for b in afp_data[i:i+16])
        print(f"  {i:04X}: {hex_str}")

    print(f"\n\nStructured Fields Analysis:")
    print("-" * 60)

    fields = parse_structured_fields(afp_data)
    for i, field in enumerate(fields):
        print(f"{i+1:3}. {field['name']:<40} len={field['length']:5} offset={field['offset']}")

    # Verify structure
    print(f"\n\nStructure Validation:")
    print("-" * 60)

    field_names = [f['name'] for f in fields]

    # Check for required fields
    checks = [
        ("BDT (Begin Document)" in str(field_names), "Has BDT"),
        ("EDT (End Document)" in str(field_names), "Has EDT"),
        ("BPG (Begin Page)" in str(field_names), "Has BPG"),
        ("EPG (End Page)" in str(field_names), "Has EPG"),
        ("PGD (Page Descriptor)" in str(field_names), "Has PGD"),
    ]

    for passed, msg in checks:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {status}: {msg}")

    # Check ordering
    bdt_idx = next((i for i, f in enumerate(fields) if "BDT" in f['name']), -1)
    bpg_idx = next((i for i, f in enumerate(fields) if "BPG" in f['name']), -1)
    epg_idx = next((i for i, f in enumerate(fields) if "EPG" in f['name']), -1)
    edt_idx = next((i for i, f in enumerate(fields) if "EDT" in f['name']), -1)

    order_ok = bdt_idx < bpg_idx < epg_idx < edt_idx
    print(f"  {'✓ PASS' if order_ok else '✗ FAIL'}: Correct field ordering (BDT < BPG < EPG < EDT)")

    # Save test file
    test_file = "/tmp/test_output.afp"
    with open(test_file, 'wb') as f:
        f.write(afp_data)
    print(f"\n\nTest AFP saved to: {test_file}")

    return afp_data


if __name__ == "__main__":
    test_minimal_afp()
