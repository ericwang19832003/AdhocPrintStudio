#!/usr/bin/env python3
"""
AFP Document Validator

Validates AFP document structure according to IBM AFP specifications.
Checks for common issues that cause viewers to fail.
"""

import struct
import sys
from typing import List, Dict, Tuple, Optional

# Carriage Control
CC = 0x5A

# Structured Field Identifiers
SF_TYPES = {
    (0xD3, 0xA8, 0xA7): ("BDT", "Begin Document"),
    (0xD3, 0xA9, 0xA7): ("EDT", "End Document"),
    (0xD3, 0xA8, 0xA8): ("BPG", "Begin Page"),
    (0xD3, 0xA9, 0xA8): ("EPG", "End Page"),
    (0xD3, 0xA6, 0xC4): ("PGD", "Page Descriptor"),
    (0xD3, 0xA0, 0x90): ("TLE", "Tag Logical Element"),
    (0xD3, 0xEE, 0xEE): ("NOP", "No Operation"),
    (0xD3, 0xA8, 0x5F): ("BPS", "Begin Page Segment"),
    (0xD3, 0xA9, 0x5F): ("EPS", "End Page Segment"),
    (0xD3, 0xA8, 0xFB): ("BIO", "Begin Image Object"),
    (0xD3, 0xA9, 0xFB): ("EIO", "End Image Object"),
    (0xD3, 0xA6, 0xFB): ("IDD", "Image Data Descriptor"),
    (0xD3, 0xEE, 0xFB): ("IPD", "Image Picture Data"),
    (0xD3, 0xA8, 0xC7): ("BOG", "Begin Object Environment Group"),
    (0xD3, 0xA9, 0xC7): ("EOG", "End Object Environment Group"),
    (0xD3, 0xA6, 0x6B): ("OBD", "Object Area Descriptor"),
    (0xD3, 0xAC, 0x6B): ("OBP", "Object Area Position"),
    (0xD3, 0xAF, 0x5F): ("IPS", "Include Page Segment"),
    (0xD3, 0xA8, 0xAD): ("BAG", "Begin Active Environment Group"),
    (0xD3, 0xA9, 0xAD): ("EAG", "End Active Environment Group"),
    (0xD3, 0xA8, 0x89): ("BPT", "Begin Presentation Text"),
    (0xD3, 0xA9, 0x89): ("EPT", "End Presentation Text"),
    (0xD3, 0xEE, 0x9B): ("PTX", "Presentation Text Data"),
}


class AFPValidator:
    def __init__(self, data: bytes):
        self.data = data
        self.fields: List[Dict] = []
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def parse(self) -> bool:
        """Parse all structured fields."""
        offset = 0
        field_num = 0

        while offset < len(self.data):
            # Check for carriage control
            if self.data[offset] != CC:
                self.errors.append(f"Offset {offset}: Expected CC (0x5A), got 0x{self.data[offset]:02X}")
                # Try to find next CC
                next_cc = self.data.find(bytes([CC]), offset + 1)
                if next_cc == -1:
                    break
                offset = next_cc
                continue

            # Check minimum length
            if offset + 3 > len(self.data):
                self.errors.append(f"Offset {offset}: Truncated structured field (no length)")
                break

            # Get length
            length = struct.unpack('>H', self.data[offset+1:offset+3])[0]

            # Validate length
            if length < 5:
                self.errors.append(f"Offset {offset}: Invalid SF length {length} (minimum is 5)")
                offset += 3
                continue

            if offset + 1 + length > len(self.data):
                self.errors.append(f"Offset {offset}: SF length {length} exceeds data (only {len(self.data) - offset - 1} bytes remain)")
                break

            # Get SF identifier
            sf_id = tuple(self.data[offset+3:offset+6])
            sf_info = SF_TYPES.get(sf_id, ("UNK", f"Unknown (0x{sf_id[0]:02X}{sf_id[1]:02X}{sf_id[2]:02X})"))
            sf_data = self.data[offset+6:offset+1+length]

            field_num += 1
            self.fields.append({
                'num': field_num,
                'offset': offset,
                'length': length,
                'sf_id': sf_id,
                'code': sf_info[0],
                'name': sf_info[1],
                'data': sf_data
            })

            offset += 1 + length

        return len(self.errors) == 0

    def validate_structure(self) -> bool:
        """Validate document structure."""
        codes = [f['code'] for f in self.fields]

        # Check for required fields
        if 'BDT' not in codes:
            self.errors.append("Missing BDT (Begin Document)")
        if 'EDT' not in codes:
            self.errors.append("Missing EDT (End Document)")
        if 'BPG' not in codes:
            self.errors.append("Missing BPG (Begin Page) - document has no pages!")
        if 'EPG' not in codes:
            self.errors.append("Missing EPG (End Page)")

        # Check document structure
        bdt_idx = codes.index('BDT') if 'BDT' in codes else -1
        edt_idx = codes.index('EDT') if 'EDT' in codes else -1

        if bdt_idx > 0:
            # Only NOP should come before BDT
            for i in range(bdt_idx):
                if codes[i] != 'NOP':
                    self.warnings.append(f"Field {i+1} ({codes[i]}) appears before BDT")

        if edt_idx >= 0 and edt_idx < len(codes) - 1:
            self.warnings.append(f"Fields appear after EDT")

        # Check page structure
        page_depth = 0
        aeg_depth = 0
        segment_depth = 0
        image_depth = 0
        oeg_depth = 0

        for i, f in enumerate(self.fields):
            code = f['code']

            if code == 'BPG':
                page_depth += 1
                if page_depth > 1:
                    self.errors.append(f"Field {i+1}: Nested BPG (page inside page)")
            elif code == 'EPG':
                page_depth -= 1
                if page_depth < 0:
                    self.errors.append(f"Field {i+1}: EPG without matching BPG")
            elif code == 'BAG':
                aeg_depth += 1
            elif code == 'EAG':
                aeg_depth -= 1
                if aeg_depth < 0:
                    self.errors.append(f"Field {i+1}: EAG without matching BAG")
            elif code == 'BPS':
                segment_depth += 1
            elif code == 'EPS':
                segment_depth -= 1
                if segment_depth < 0:
                    self.errors.append(f"Field {i+1}: EPS without matching BPS")
            elif code == 'BIO':
                image_depth += 1
            elif code == 'EIO':
                image_depth -= 1
                if image_depth < 0:
                    self.errors.append(f"Field {i+1}: EIO without matching BIO")
            elif code == 'BOG':
                oeg_depth += 1
            elif code == 'EOG':
                oeg_depth -= 1
                if oeg_depth < 0:
                    self.errors.append(f"Field {i+1}: EOG without matching BOG")

        if page_depth != 0:
            self.errors.append(f"Unclosed pages: {page_depth} BPG without EPG")
        if aeg_depth != 0:
            self.errors.append(f"Unclosed AEG: {aeg_depth} BAG without EAG")
        if segment_depth != 0:
            self.errors.append(f"Unclosed segments: {segment_depth} BPS without EPS")
        if image_depth != 0:
            self.errors.append(f"Unclosed images: {image_depth} BIO without EIO")
        if oeg_depth != 0:
            self.errors.append(f"Unclosed OEG: {oeg_depth} BOG without EOG")

        # Check for page content
        has_page_content = False
        for f in self.fields:
            if f['code'] in ['IPS', 'PTX', 'IPD']:
                has_page_content = True
                break

        if not has_page_content:
            self.warnings.append("No renderable page content found (no IPS, PTX, or IPD in page)")

        # Check if IPS references defined segments
        segment_names = set()
        ips_names = set()

        for f in self.fields:
            if f['code'] == 'BPS' and len(f['data']) >= 11:
                # Extract segment name (EBCDIC, positions 3-10)
                try:
                    name = f['data'][3:11].decode('cp500').strip()
                    segment_names.add(name)
                except:
                    pass
            elif f['code'] == 'IPS' and len(f['data']) >= 11:
                try:
                    name = f['data'][3:11].decode('cp500').strip()
                    ips_names.add(name)
                except:
                    pass

        for name in ips_names:
            if name not in segment_names:
                self.warnings.append(f"IPS references undefined segment: '{name}'")

        return len(self.errors) == 0

    def print_report(self):
        """Print validation report."""
        print("=" * 70)
        print("AFP DOCUMENT VALIDATION REPORT")
        print("=" * 70)
        print(f"\nDocument size: {len(self.data)} bytes")
        print(f"Structured fields: {len(self.fields)}")

        # Print field summary
        print(f"\n{'#':<4} {'Offset':<8} {'Length':<8} {'Code':<6} {'Name':<35}")
        print("-" * 70)
        for f in self.fields:
            print(f"{f['num']:<4} {f['offset']:<8} {f['length']:<8} {f['code']:<6} {f['name']:<35}")

        # Print errors
        if self.errors:
            print(f"\n{'='*70}")
            print(f"ERRORS ({len(self.errors)}):")
            print("-" * 70)
            for err in self.errors:
                print(f"  ✗ {err}")

        # Print warnings
        if self.warnings:
            print(f"\n{'='*70}")
            print(f"WARNINGS ({len(self.warnings)}):")
            print("-" * 70)
            for warn in self.warnings:
                print(f"  ⚠ {warn}")

        # Print summary
        print(f"\n{'='*70}")
        if not self.errors and not self.warnings:
            print("✓ VALIDATION PASSED - No errors or warnings")
        elif not self.errors:
            print(f"✓ VALIDATION PASSED with {len(self.warnings)} warning(s)")
        else:
            print(f"✗ VALIDATION FAILED - {len(self.errors)} error(s), {len(self.warnings)} warning(s)")
        print("=" * 70)


def validate_afp_file(filepath: str) -> bool:
    """Validate an AFP file."""
    with open(filepath, 'rb') as f:
        data = f.read()

    validator = AFPValidator(data)
    validator.parse()
    validator.validate_structure()
    validator.print_report()

    return len(validator.errors) == 0


def validate_afp_bytes(data: bytes) -> Tuple[bool, List[str], List[str]]:
    """Validate AFP data and return (success, errors, warnings)."""
    validator = AFPValidator(data)
    validator.parse()
    validator.validate_structure()
    return len(validator.errors) == 0, validator.errors, validator.warnings


if __name__ == "__main__":
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
        print(f"Validating: {filepath}\n")
        validate_afp_file(filepath)
    else:
        # Test with generated AFP
        from app.afp_document_generator import generate_afp_document

        print("Generating test AFP document...\n")

        # Create test image data
        width, height = 100, 100
        image_data = bytes([255] * (width * height))  # White image

        pages = [{
            'image_data': image_data,
            'width': width,
            'height': height,
            'tle_data': {
                'mailing_name': 'John Doe',
                'mailing_addr1': '123 Main St',
                'mailing_addr2': 'City, ST 12345',
            }
        }]

        afp_data = generate_afp_document(pages, document_name="TESTDOC")

        # Save for external testing
        with open('/tmp/test_afp_validated.afp', 'wb') as f:
            f.write(afp_data)
        print(f"Test AFP saved to: /tmp/test_afp_validated.afp\n")

        validator = AFPValidator(afp_data)
        validator.parse()
        validator.validate_structure()
        validator.print_report()
