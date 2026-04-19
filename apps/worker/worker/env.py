from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


def load_env() -> None:
    base_dir = Path(__file__).resolve().parents[1]
    env_path = base_dir / ".env"
    env_local_path = base_dir / ".env.local"

    if env_path.exists():
        load_dotenv(env_path)
    if env_local_path.exists():
        load_dotenv(env_local_path, override=True)
