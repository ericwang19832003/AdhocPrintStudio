# Word Template Upload — Design Document

## Goal
Allow users to upload a .docx Word template from a new sidebar tab, converting it to HTML and replacing the canvas content.

## Architecture
Client-side only. mammoth.js converts DOCX to HTML in the browser. No API or backend changes needed.

## Flow
1. User clicks "Upload" tab in sidebar
2. Dropzone accepts .docx file
3. FileReader reads as ArrayBuffer
4. mammoth.convertToHtml() converts to clean HTML with inline base64 images
5. Check mammoth messages for table warnings → show yellow banner if found
6. DOMPurify.sanitize() cleans the HTML
7. editor.commands.setContent(html) replaces canvas
8. Existing blocks (logo, tagline, return address) reset

## Files Changed
- `apps/web/package.json` — add `mammoth` dependency
- `apps/web/app/BuilderClient.tsx` — add "Upload" sidebar tab + handler (~60 lines)

## What Gets Imported
- Text formatting (bold, italic, underline, strikethrough)
- Font family and size, text colors and highlights
- Paragraph alignment, bulleted/numbered lists
- Inline images (as base64 data URIs)
- Hyperlinks

## What Gets Dropped (with warning)
- Tables → yellow banner: "Tables detected. Convert to images in Word first."
- Headers/footers, multi-column layouts, text boxes/shapes, comments/track changes

## Error Handling
- Non-docx → "Please upload a .docx file"
- Corrupted → "Could not read this file"
- Empty → "This document appears to be empty"

## No Impact
- AFP generation pipeline unchanged (same HTML→PNG→AFP flow)
- TLE indexing unchanged
- BlueCrest compatibility unchanged
