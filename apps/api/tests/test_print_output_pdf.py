"""Tests for the /print-output/pdf route (incremental PDF assembly)."""

import base64
import io

import fitz
from PIL import Image

from app.print_output import generate_pdf


def _make_payload(rows: int = 3, babel_pages: int = 0) -> dict:
    csv_lines = ["name,addr1"] + [f"Person {i},1 Main St" for i in range(rows)]
    payload = {
        "spreadsheet_csv": "\n".join(csv_lines),
        "template_html": "<p>Dear [name], your statement is enclosed.</p>",
        "block_texts": [],
        "placeholder_map": {"[name]": "name"},
        "mailing_map": {"mailing_name": "name", "mailing_addr1": "addr1"},
        "return_address": ["Acme Corp", "2 Side St", "Springfield"],
    }
    if babel_pages:
        img = Image.new("RGB", (200, 260), "white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
        payload["babel_pages"] = [data_url] * babel_pages
    return payload


def _open_pdf(response) -> fitz.Document:
    assert response.media_type == "application/pdf"
    assert response.body[:5] == b"%PDF-"
    return fitz.open("pdf", response.body)


def test_pdf_one_page_per_row():
    response = generate_pdf(_make_payload(rows=3))
    doc = _open_pdf(response)
    assert doc.page_count == 3


def test_pdf_babel_pages_follow_each_letter():
    response = generate_pdf(_make_payload(rows=2, babel_pages=1))
    doc = _open_pdf(response)
    assert doc.page_count == 4  # letter, babel, letter, babel


def test_pdf_babel_image_embedded_once():
    """Repeated babel inserts must reuse one embedded image, not N copies."""
    response = generate_pdf(_make_payload(rows=5, babel_pages=1))
    doc = _open_pdf(response)
    assert doc.page_count == 10
    babel_xrefs = set()
    for page_index in (1, 3, 5, 7, 9):  # babel positions
        images = doc.get_page_images(page_index)
        assert len(images) == 1
        babel_xrefs.add(images[0][0])
    assert len(babel_xrefs) == 1


def test_pdf_pages_render_content():
    response = generate_pdf(_make_payload(rows=1))
    doc = _open_pdf(response)
    pix = doc[0].get_pixmap()
    # The page must not be blank — rendered text produces non-white pixels.
    assert pix.color_count() > 1
