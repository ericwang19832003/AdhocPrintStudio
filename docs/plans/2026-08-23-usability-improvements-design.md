# Usability Improvements Design

**Date:** 2026-08-23
**Scope:** Audit items 2-10. The default output format remains AFP by request.

## Primary workflow

The editor exposes one primary action, **Preview & create**. Preview owns format selection and the final create command, and creation always runs preflight first. Secondary document, library, export, and settings commands live in an overflow menu so they do not compete with the main workflow.

## Corrective guidance

The Data panel presents a linked readiness summary for recipients, fill-in fields, and mailing address setup. A failed item opens the relevant Data section. Preflight issues provide a Review action that returns to the appropriate mapping section; **Generate anyway** remains available but is visually secondary.

AI remains optional. Configuration appears contextually as **Improve mapping with AI** when unmapped fields exist, while advanced access remains under Settings.

## Output and Windows behavior

Generated files use the letter title, date, recipient count, and chosen extension. Completion confirms the actual filename without assuming the browser's download directory and lets the user return to preview.

The Windows launcher reuses a healthy existing server, detects port 8000 conflicts, stops waiting after 30 seconds, and writes startup diagnostics to `data\server.log`. Bundled instructions no longer mention dependency installation.

## Drafts

Autosave is extended into a browser-local draft index. Each draft retains the existing serialized letter format and receives a stable local ID. New, Open recent, Duplicate, and Rename are available from the top-bar menu. Opening or duplicating a draft reloads the editor from the selected autosave snapshot, avoiding a second in-memory restore implementation. Portable project files remain out of scope.

## Verification

Pure UX logic is covered with Node's test runner and TypeScript execution through `tsx`. Existing API tests and the Next.js production build remain regression gates. The packaged Windows artifact should be rebuilt before the next release.
