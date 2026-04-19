"""
Security module for AdhocPrintStudio API.

Provides:
- API key authentication
- Rate limiting configuration
- Security headers middleware
- Input validation utilities
"""
from __future__ import annotations

import os
import re
import secrets
import logging
from typing import Optional

from fastapi import HTTPException, Security, Request, Response
from fastapi.security import APIKeyHeader
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

# API Key configuration
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)

# Valid API keys (loaded from environment)
def get_valid_api_keys() -> set[str]:
    """Load valid API keys from environment variable."""
    keys_env = os.getenv("API_KEYS", "")
    if not keys_env:
        # In development, allow requests without API key if not configured
        return set()
    return {key.strip() for key in keys_env.split(",") if key.strip()}


def verify_api_key(api_key: Optional[str] = Security(API_KEY_HEADER)) -> Optional[str]:
    """
    Verify the API key from request header.

    If API_KEYS env var is not set, authentication is bypassed (dev mode).
    If API_KEYS is set, valid key is required.
    """
    valid_keys = get_valid_api_keys()

    # If no API keys configured, allow all requests (development mode)
    if not valid_keys:
        return None

    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    # Use constant-time comparison to prevent timing attacks
    if not any(secrets.compare_digest(api_key, valid_key) for valid_key in valid_keys):
        raise HTTPException(
            status_code=403,
            detail="Invalid API key",
        )

    return api_key


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # XSS protection (legacy, but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy (relaxed for API)
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"

        # Permissions policy
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        return response


# Filename sanitization
SAFE_FILENAME_PATTERN = re.compile(r'^[a-zA-Z0-9][a-zA-Z0-9._-]*$')
MAX_FILENAME_LENGTH = 255

def sanitize_filename(filename: str) -> str:
    """
    Sanitize a filename to prevent path traversal and injection attacks.

    - Extracts only the base name (removes directory components)
    - Validates against allowed characters
    - Limits length
    - Returns a safe default if invalid
    """
    if not filename:
        return "unnamed_file"

    # Extract base name (remove any path components)
    import os.path
    base_name = os.path.basename(filename)

    # Remove any null bytes or control characters
    base_name = ''.join(c for c in base_name if c.isprintable() and c not in '\x00\r\n')

    # Limit length
    if len(base_name) > MAX_FILENAME_LENGTH:
        # Preserve extension if possible
        name, ext = os.path.splitext(base_name)
        if ext:
            max_name_len = MAX_FILENAME_LENGTH - len(ext)
            base_name = name[:max_name_len] + ext
        else:
            base_name = base_name[:MAX_FILENAME_LENGTH]

    # If the filename doesn't match safe pattern, generate a safe one
    if not base_name or not SAFE_FILENAME_PATTERN.match(base_name):
        # Keep extension if it looks safe
        _, ext = os.path.splitext(base_name)
        if ext and SAFE_FILENAME_PATTERN.match(ext[1:]):
            return f"file{ext}"
        return "unnamed_file"

    return base_name


# File size limits
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB

def validate_file_size(file_size: Optional[int], max_size: int = MAX_UPLOAD_SIZE) -> None:
    """Validate that file size is within limits."""
    if file_size is not None and file_size > max_size:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {max_size // (1024 * 1024)} MB",
        )


# Magic bytes for file type validation
FILE_SIGNATURES = {
    # CSV has no magic bytes, but we check for text
    'xlsx': [b'PK\x03\x04'],  # ZIP-based format
    'xml': [b'<?xml', b'\xef\xbb\xbf<?xml'],  # With or without BOM
    'json': [b'{', b'[', b'\xef\xbb\xbf{', b'\xef\xbb\xbf['],  # JSON starts with { or [
    'png': [b'\x89PNG\r\n\x1a\n'],
    'jpg': [b'\xff\xd8\xff'],
    'pdf': [b'%PDF-'],
}

def validate_file_content(data: bytes, expected_type: str) -> bool:
    """
    Validate file content matches expected type using magic bytes.

    Returns True if valid, raises HTTPException if invalid.
    """
    if expected_type not in FILE_SIGNATURES:
        # For CSV and other text types, just check it's valid text
        if expected_type == 'csv':
            try:
                data[:1000].decode('utf-8')
                return True
            except UnicodeDecodeError:
                raise HTTPException(
                    status_code=400,
                    detail="File does not appear to be valid CSV (text) content",
                )
        return True

    signatures = FILE_SIGNATURES[expected_type]
    for sig in signatures:
        if data[:len(sig)] == sig:
            return True

    raise HTTPException(
        status_code=400,
        detail=f"File content does not match expected type: {expected_type}",
    )


def sanitize_error_message(error: Exception) -> str:
    """
    Sanitize error messages to prevent information leakage.

    Returns a generic message for production, detailed for development.
    """
    # In production (when API_KEYS is set), return generic messages
    if get_valid_api_keys():
        # Log the actual error for debugging
        logger.error(f"Error: {error}", exc_info=True)
        return "An internal error occurred. Please try again later."

    # In development, return the actual error
    return str(error)
