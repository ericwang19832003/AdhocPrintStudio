"""
PDF Processor for AFP Converter

Handles reading and processing PDF files for AFP page segment generation.
"""
from __future__ import annotations

from typing import Tuple

import fitz  # PyMuPDF


DEFAULT_DPI = 240


def get_pdf_page_count(pdf_bytes: bytes) -> int:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    count = len(doc)
    doc.close()
    return count


def render_pdf_page(
    pdf_bytes: bytes, page_number: int, dpi: int = DEFAULT_DPI
) -> Tuple[bytes, int, int, int, int]:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    if page_number < 1 or page_number > len(doc):
        doc.close()
        raise ValueError(f"Invalid page number: {page_number}. PDF has {len(doc)} pages.")

    page = doc[page_number - 1]

    zoom = dpi / 72.0
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat, alpha=False, colorspace=fitz.csGRAY)

    width = pix.width
    height = pix.height
    image_data = pix.samples

    doc.close()

    return image_data, width, height, dpi, dpi
