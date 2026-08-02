"""App-managed AI provider credentials.

Lets users paste an API key in the UI once (like OpenClaw / agent-app setup
wizards) instead of editing environment files. Resolution order:

    1. Environment variable (server-managed deployments always win)
    2. data/ai_keys.json written by the settings UI (owner-only permissions)

The full key never leaves the machine the server runs on; status responses
expose only the provider name, source, and the last four characters.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

# Env var names per provider, mirrored from ai_providers.py
PROVIDER_ENV_KEYS = {
    "anthropic": "ANTHROPIC_API_KEY",
    "openai_compatible": "OPENAI_API_KEY",
}
PROVIDER_BASE_URL_KEY = "OPENAI_BASE_URL"


def _keys_path() -> Path:
    return Path(os.getenv("AI_KEYS_PATH", "data/ai_keys.json"))


def _load() -> dict[str, str]:
    try:
        data = json.loads(_keys_path().read_text())
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def resolve(name: str) -> str | None:
    """Resolve a credential: environment first, then the app key store."""
    return os.getenv(name) or _load().get(name) or None


def source_of(name: str) -> str | None:
    """Where a credential comes from: 'env', 'app', or None."""
    if os.getenv(name):
        return "env"
    if _load().get(name):
        return "app"
    return None


def store(values: dict[str, str]) -> None:
    """Persist non-empty values into the app key store (0600 permissions)."""
    path = _keys_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    data = _load()
    data.update({k: v for k, v in values.items() if v})
    path.write_text(json.dumps(data, indent=2))
    try:
        os.chmod(path, 0o600)
    except OSError:  # e.g. Windows — best effort
        pass


def remove(names: list[str]) -> None:
    data = _load()
    for name in names:
        data.pop(name, None)
    path = _keys_path()
    if path.exists():
        path.write_text(json.dumps(data, indent=2))


def key_hint(name: str) -> str | None:
    """Masked display form of a configured key: '····abcd'."""
    value = resolve(name)
    if not value:
        return None
    return "····" + value[-4:] if len(value) > 4 else "····"
