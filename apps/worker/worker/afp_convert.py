from __future__ import annotations

from typing import Any

from worker.afp_engine import EngineErrorContext
from worker.afp_generator import generate_page_segment
from worker.image_processor import get_segment_name_from_filename, process_image
from worker.pdf_processor import get_pdf_page_count, render_pdf_page


def convert_image_to_afp(image_bytes: bytes, filename: str) -> bytes:
    image_data, width, height, x_dpi, y_dpi = process_image(image_bytes)
    segment_name = get_segment_name_from_filename(filename)
    return generate_page_segment(
        image_data=image_data,
        width=width,
        height=height,
        x_resolution=x_dpi,
        y_resolution=y_dpi,
        segment_name=segment_name,
    )


def _segment_name_for_page(base: str, page: int) -> str:
    base = base[:6]
    return f"{base}{page:02d}"[:8]


def convert_pdf_to_afp(pdf_bytes: bytes, filename: str) -> bytes:
    page_count = get_pdf_page_count(pdf_bytes)
    base = get_segment_name_from_filename(filename)
    segments = []
    for page in range(1, page_count + 1):
        try:
            image_data, width, height, x_dpi, y_dpi = render_pdf_page(pdf_bytes, page)
        except Exception as exc:  # pragma: no cover - surfaced to caller
            raise EngineErrorContext("PDF conversion failed", page=page) from exc
        segment_name = _segment_name_for_page(base, page)
        segments.append(
            generate_page_segment(
                image_data=image_data,
                width=width,
                height=height,
                x_resolution=x_dpi,
                y_resolution=y_dpi,
                segment_name=segment_name,
            )
        )
    return b"".join(segments)
