from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from typing import Any

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont

from app.afp_document_generator import generate_afp_document
from openpyxl import load_workbook

router = APIRouter(prefix="/print-output", tags=["print-output"])

DPI = 240
PAGE_WIDTH = int(8.5 * DPI)
PAGE_HEIGHT = int(11 * DPI)


@dataclass
class RenderConfig:
    margin_left: int = int(0.7 * DPI)
    margin_top: int = int(0.6 * DPI)
    mailing_offset_x: int = int(0.3 * DPI)
    mailing_offset_y: int = int(1.8 * DPI)
    body_start_y: int = int(3.1 * DPI)
    line_height: int = int(0.22 * DPI)


def _html_to_text(html: str) -> str:
    text = html.replace("</p>", "\n").replace("<br>", "\n").replace("<br/>", "\n")
    text = text.replace("<div>", "\n").replace("</div>", "\n")
    text = "".join(ch for ch in text if ch != "\r")
    result = []
    in_tag = False
    for ch in text:
        if ch == "<":
            in_tag = True
            continue
        if ch == ">":
            in_tag = False
            continue
        if not in_tag:
            result.append(ch)
    return "".join(result)


def _wrap_text(text: str, draw: ImageDraw.ImageDraw, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current: list[str] = []
    for word in words:
        candidate = " ".join(current + [word])
        width = draw.textlength(candidate, font=font)
        if width <= max_width or not current:
            current.append(word)
        else:
            lines.append(" ".join(current))
            current = [word]
    if current:
        lines.append(" ".join(current))
    return lines


def _replace_placeholders(text: str, row: dict[str, str], placeholder_map: dict[str, str]) -> str:
    output = text
    for placeholder, column in placeholder_map.items():
        key = placeholder.strip("[]")
        column_key = column or key
        value = row.get(column_key, "")
        output = output.replace(placeholder, value)
    return output


def _render_letter(
    body_html: str,
    block_texts: list[str],
    mailing_lines: list[str],
    return_lines: list[str],
) -> bytes:
    image = Image.new("L", (PAGE_WIDTH, PAGE_HEIGHT), color=255)
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    cfg = RenderConfig()

    x = cfg.margin_left
    y = cfg.margin_top
    for line in return_lines:
        if line:
            draw.text((x, y), line, fill=0, font=font)
            y += cfg.line_height

    mx = cfg.margin_left + cfg.mailing_offset_x
    my = cfg.margin_top + cfg.mailing_offset_y
    for line in mailing_lines:
        if line:
            draw.text((mx, my), line, fill=0, font=font)
            my += cfg.line_height

    body_text = _html_to_text(body_html).strip()
    if block_texts:
        body_text = "\n".join([body_text] + [text for text in block_texts if text.strip()])
    body_lines: list[str] = []
    for paragraph in body_text.splitlines():
        if not paragraph.strip():
            body_lines.append("")
            continue
        body_lines.extend(
            _wrap_text(
                paragraph,
                draw,
                font,
                PAGE_WIDTH - cfg.margin_left * 2,
            )
        )
    by = cfg.body_start_y
    for line in body_lines:
        if by > PAGE_HEIGHT - cfg.margin_left:
            break
        draw.text((cfg.margin_left, by), line, fill=0, font=font)
        by += cfg.line_height

    buffer = io.BytesIO()
    image.save(buffer, format="PNG", dpi=(DPI, DPI))
    return buffer.getvalue()


def _csv_from_rows(rows: list[list[Any]]) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    for row in rows:
        writer.writerow(["" if value is None else str(value) for value in row])
    return buffer.getvalue()


@router.post("/columns")
async def parse_columns(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing file name")
    filename = file.filename.lower()
    data = await file.read()
    if filename.endswith(".csv"):
        text = data.decode("utf-8", errors="ignore")
        header = text.splitlines()[0] if text.splitlines() else ""
        columns = [value.strip() for value in header.split(",") if value.strip()]
        return {"columns": columns, "csv": text}
    if filename.endswith(".xlsx"):
        workbook = load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        sheet = workbook.active
        rows = []
        for row in sheet.iter_rows(values_only=True):
            rows.append(list(row))
        if not rows:
            raise HTTPException(status_code=400, detail="Spreadsheet has no rows")
        columns = [str(value).strip() for value in rows[0] if value is not None]
        return {"columns": columns, "csv": _csv_from_rows(rows)}
    raise HTTPException(status_code=400, detail="Unsupported file type")


@router.post("/afp")
def generate_afp(payload: dict[str, Any]) -> Response:
    """
    Generate a complete IBM AFP document with embedded TLE index records.

    The AFP document contains:
    - Document structure (BDT/EDT)
    - Page structure with page descriptors
    - TLE (Tag Logical Element) records for each page containing:
      - mailing_name, mailing_addr1, mailing_addr2, mailing_addr3
      - return_addr1, return_addr2, return_addr3
    - Inline page segments with IOCA image data

    Compatible with mainframe processing, reblocking, and AFP viewers.
    """
    try:
        spreadsheet_csv = payload.get("spreadsheet_csv", "")
        if not spreadsheet_csv.strip():
            raise HTTPException(status_code=400, detail="Spreadsheet data missing")
        reader = csv.DictReader(io.StringIO(spreadsheet_csv))
        rows = list(reader)
        if not rows:
            raise HTTPException(status_code=400, detail="Spreadsheet has no rows")

        body_html = payload.get("template_html", "")
        block_texts = payload.get("block_texts", [])
        placeholder_map = payload.get("placeholder_map", {})
        mailing_map = payload.get("mailing_map", {})
        return_lines = payload.get("return_address", ["", "", ""])

        # Build pages with image data and TLE information
        pages: list[dict[str, Any]] = []
        for index, row in enumerate(rows, start=1):
            merged_body = _replace_placeholders(body_html, row, placeholder_map)
            merged_blocks = [
                _replace_placeholders(text, row, placeholder_map) for text in block_texts
            ]

            mailing_lines = [
                row.get(mailing_map.get("mailing_name", ""), ""),
                row.get(mailing_map.get("mailing_addr1", ""), ""),
                row.get(mailing_map.get("mailing_addr2", ""), ""),
                row.get(mailing_map.get("mailing_addr3", ""), ""),
            ]

            image_bytes = _render_letter(
                merged_body,
                merged_blocks,
                mailing_lines,
                return_lines,
            )

            # Convert PNG to grayscale image data
            image = Image.open(io.BytesIO(image_bytes))
            if image.mode != "L":
                image = image.convert("L")
            image_data = image.tobytes()
            width, height = image.size

            # Build page with TLE data
            pages.append({
                'image_data': image_data,
                'width': width,
                'height': height,
                'tle_data': {
                    'mailing_name': mailing_lines[0],
                    'mailing_addr1': mailing_lines[1],
                    'mailing_addr2': mailing_lines[2],
                    'mailing_addr3': mailing_lines[3],
                    'return_addr1': return_lines[0] if len(return_lines) > 0 else "",
                    'return_addr2': return_lines[1] if len(return_lines) > 1 else "",
                    'return_addr3': return_lines[2] if len(return_lines) > 2 else "",
                }
            })

        # Generate complete AFP document with embedded TLE records
        afp_document = generate_afp_document(
            pages=pages,
            document_name="MAILOUT",
            resolution=DPI,
            page_width=PAGE_WIDTH,
            page_height=PAGE_HEIGHT
        )

        return Response(
            content=afp_document,
            media_type="application/octet-stream",
            headers={"Content-Disposition": 'attachment; filename="print_output.afp"'},
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
