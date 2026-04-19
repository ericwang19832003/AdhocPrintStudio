"""
Image Processor for AFP Converter

Handles reading and processing images for AFP page segment generation.
"""
from __future__ import annotations

from io import BytesIO
from typing import Tuple

from PIL import Image


ALLOWED_EXTENSIONS = {"tiff", "tif", "jpeg", "jpg", "png"}
DEFAULT_DPI = 240


def is_valid_image_type(filename: str) -> bool:
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def process_image(image_bytes: bytes) -> Tuple[bytes, int, int, int, int]:
    img = Image.open(BytesIO(image_bytes))

    if img.mode != "L":
        img = img.convert("L")

    width, height = img.size
    dpi = img.info.get("dpi", (DEFAULT_DPI, DEFAULT_DPI))

    if isinstance(dpi, tuple):
        x_dpi, y_dpi = int(dpi[0]), int(dpi[1])
    else:
        x_dpi = y_dpi = int(dpi)

    if x_dpi <= 0 or x_dpi > 2400:
        x_dpi = DEFAULT_DPI
    if y_dpi <= 0 or y_dpi > 2400:
        y_dpi = DEFAULT_DPI

    image_data = img.tobytes()

    return image_data, width, height, x_dpi, y_dpi


def get_segment_name_from_filename(filename: str) -> str:
    if "." in filename:
        name = filename.rsplit(".", 1)[0]
    else:
        name = filename

    name = "".join(c for c in name if c.isalnum())
    name = name.upper()[:8]

    if not name:
        name = "PAGESEG1"

    return name
