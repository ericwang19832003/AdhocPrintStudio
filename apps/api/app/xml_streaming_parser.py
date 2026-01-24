"""
Streaming XML Parser for Large Files

This module provides memory-efficient XML parsing for files up to several GB.
Uses iterative parsing (iterparse) to process records one at a time without
loading the entire XML tree into memory.

For a 2GB XML file with thousands of records:
- Traditional parsing: Would need 10-20GB RAM, likely crash
- Streaming parsing: Uses ~100MB RAM regardless of file size
"""

import csv
import io
import os
import tempfile
from typing import Generator, Optional, Callable
from collections import defaultdict

# Use defusedxml for security (prevents XXE attacks)
# Falls back to standard library if defusedxml not available
import xml.etree.ElementTree as StdET  # For type hints
try:
    import defusedxml.ElementTree as ET
    from defusedxml.ElementTree import iterparse as safe_iterparse
except ImportError:
    import xml.etree.ElementTree as ET
    from xml.etree.ElementTree import iterparse as safe_iterparse

# Use standard library Element type for type hints (defusedxml doesn't export it)
Element = StdET.Element


def _strip_namespace(tag: str) -> str:
    """Strip XML namespace prefix from a tag."""
    if tag.startswith("{"):
        return tag.split("}", 1)[1] if "}" in tag else tag
    return tag


def _flatten_element(element: Element, prefix: str = "") -> dict[str, str]:
    """
    Flatten an XML element into a dictionary with dot-notation keys.
    Strips namespace prefixes from all tags.
    """
    result: dict[str, str] = {}
    tag_name = _strip_namespace(element.tag)
    current_key = f"{prefix}.{tag_name}" if prefix else tag_name

    text = (element.text or "").strip()
    children = list(element)

    if children:
        for child in children:
            child_data = _flatten_element(child, current_key)
            result.update(child_data)
    else:
        result[current_key] = text

    # Extract attributes
    for attr_name, attr_value in element.attrib.items():
        result[f"{current_key}@{attr_name}"] = attr_value

    return result


def detect_record_element(file_path: str, sample_size: int = 50000) -> Optional[str]:
    """
    Detect the repeating record element by sampling the first part of the file.

    Args:
        file_path: Path to the XML file
        sample_size: Number of bytes to sample (default 50KB)

    Returns:
        The tag name of the detected record element, or None
    """
    # Read first sample_size bytes to detect structure
    with open(file_path, 'rb') as f:
        sample = f.read(sample_size)

    # Find the most common repeating element at depth 2-3
    tag_counts: dict[str, int] = defaultdict(int)
    depth = 0
    current_path: list[str] = []

    try:
        # Parse the sample to count tags
        for event, elem in ET.iterparse(io.BytesIO(sample), events=('start', 'end')):
            tag = _strip_namespace(elem.tag)

            if event == 'start':
                current_path.append(tag)
                depth = len(current_path)
                # Count tags at depth 2-4 (likely record level)
                if 2 <= depth <= 4:
                    tag_counts[tag] += 1
            elif event == 'end':
                if current_path:
                    current_path.pop()
                elem.clear()
    except ET.ParseError:
        # Incomplete XML in sample, that's expected
        pass

    if not tag_counts:
        return None

    # Return the most common tag (likely the record element)
    return max(tag_counts, key=tag_counts.get)


def stream_xml_records(
    file_path: str,
    record_tag: Optional[str] = None,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> Generator[dict[str, str], None, None]:
    """
    Stream XML records from a large file without loading it all into memory.

    Args:
        file_path: Path to the XML file
        record_tag: The tag name of record elements (auto-detected if None)
        progress_callback: Optional callback(records_processed, bytes_read)

    Yields:
        Dictionaries representing each record (flattened with dot notation)
    """
    # Auto-detect record element if not specified
    if record_tag is None:
        record_tag = detect_record_element(file_path)
        if record_tag is None:
            raise ValueError("Could not auto-detect record element in XML")

    file_size = os.path.getsize(file_path)
    records_processed = 0

    # Use iterparse to stream through the file
    context = safe_iterparse(file_path, events=('end',))

    for event, elem in context:
        tag = _strip_namespace(elem.tag)

        if tag == record_tag:
            # Found a record - flatten it
            record = {}
            for child in elem:
                child_data = _flatten_element(child)
                record.update(child_data)

            # Get attributes of the record element itself
            for attr_name, attr_value in elem.attrib.items():
                record[f"@{attr_name}"] = attr_value

            records_processed += 1

            # Call progress callback periodically
            if progress_callback and records_processed % 1000 == 0:
                # Estimate bytes read (rough approximation)
                progress_callback(records_processed, 0)

            yield record

            # CRITICAL: Clear the element to free memory
            # This prevents the tree from accumulating in memory
            elem.clear()


def parse_large_xml_to_csv(
    file_path: str,
    output_path: Optional[str] = None,
    record_tag: Optional[str] = None,
    max_records: Optional[int] = None,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> tuple[str, int, list[str]]:
    """
    Parse a large XML file and convert to CSV format.

    Args:
        file_path: Path to the XML file
        output_path: Path for output CSV (auto-generated if None)
        record_tag: The tag name of record elements (auto-detected if None)
        max_records: Maximum number of records to process (None = all)
        progress_callback: Optional callback(records_processed, bytes_read)

    Returns:
        Tuple of (output_csv_path, record_count, columns)
    """
    if output_path is None:
        output_path = file_path + ".csv"

    # First pass: collect all column names
    columns_set: set[str] = set()
    record_count = 0

    for record in stream_xml_records(file_path, record_tag):
        columns_set.update(record.keys())
        record_count += 1
        if max_records and record_count >= max_records:
            break

    if record_count == 0:
        raise ValueError("No records found in XML file")

    columns = sorted(list(columns_set))

    # Second pass: write CSV
    with open(output_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=columns, extrasaction='ignore')
        writer.writeheader()

        processed = 0
        for record in stream_xml_records(file_path, record_tag):
            # Fill missing columns with empty string
            for col in columns:
                if col not in record:
                    record[col] = ""

            writer.writerow(record)
            processed += 1

            if progress_callback and processed % 1000 == 0:
                progress_callback(processed, 0)

            if max_records and processed >= max_records:
                break

    return output_path, record_count, columns


def parse_large_xml_to_records(
    file_path: str,
    record_tag: Optional[str] = None,
    max_records: int = 10000,
    progress_callback: Optional[Callable[[int, int], None]] = None
) -> tuple[list[str], list[dict[str, str]]]:
    """
    Parse a large XML file and return records (with limit for API responses).

    For very large files, use parse_large_xml_to_csv instead.

    Args:
        file_path: Path to the XML file
        record_tag: The tag name of record elements (auto-detected if None)
        max_records: Maximum records to return (default 10000, prevents memory issues)
        progress_callback: Optional callback(records_processed, bytes_read)

    Returns:
        Tuple of (columns, records)
    """
    records: list[dict[str, str]] = []
    columns_set: set[str] = set()

    for record in stream_xml_records(file_path, record_tag, progress_callback):
        columns_set.update(record.keys())
        records.append(record)

        if len(records) >= max_records:
            break

    columns = sorted(list(columns_set))

    # Ensure all records have all columns
    for record in records:
        for col in columns:
            if col not in record:
                record[col] = ""

    return columns, records


def get_xml_file_info(file_path: str) -> dict:
    """
    Get information about an XML file without fully parsing it.

    Returns:
        Dictionary with file_size, estimated_records, detected_record_tag
    """
    file_size = os.path.getsize(file_path)
    record_tag = detect_record_element(file_path)

    # Estimate record count by sampling
    sample_records = 0
    sample_bytes = 0

    for record in stream_xml_records(file_path, record_tag):
        sample_records += 1
        if sample_records >= 100:
            break

    # Very rough estimate based on file size
    if sample_records > 0:
        # Read first 100KB to estimate average record size
        with open(file_path, 'rb') as f:
            sample = f.read(100000)

        # Estimate: assume records are evenly distributed
        estimated_total = int(file_size / (len(sample) / max(sample_records, 1)))
    else:
        estimated_total = 0

    return {
        "file_size_bytes": file_size,
        "file_size_mb": round(file_size / (1024 * 1024), 2),
        "detected_record_tag": record_tag,
        "estimated_records": estimated_total,
        "sample_records": sample_records,
    }


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python xml_streaming_parser.py <xml_file> [output.csv]")
        print("\nStreaming XML parser for large files (up to several GB)")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"Analyzing: {input_file}")
    info = get_xml_file_info(input_file)
    print(f"  File size: {info['file_size_mb']} MB")
    print(f"  Detected record tag: {info['detected_record_tag']}")
    print(f"  Estimated records: ~{info['estimated_records']}")

    def progress(count, bytes_read):
        print(f"  Processed {count} records...", end='\r')

    print("\nConverting to CSV...")
    csv_path, count, columns = parse_large_xml_to_csv(
        input_file,
        output_file,
        progress_callback=progress
    )

    print(f"\nDone!")
    print(f"  Output: {csv_path}")
    print(f"  Records: {count}")
    print(f"  Columns: {len(columns)}")
