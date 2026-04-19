from __future__ import annotations

import os
from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker


_ENGINE: Engine | None = None
_SESSION_FACTORY: sessionmaker | None = None


def get_database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set.")
    return url


def get_engine() -> Engine:
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is None:
        _ENGINE = create_engine(get_database_url(), pool_pre_ping=True)
        _SESSION_FACTORY = sessionmaker(bind=_ENGINE, autoflush=False, autocommit=False)
    return _ENGINE


@contextmanager
def get_session() -> Session:
    if _SESSION_FACTORY is None:
        get_engine()
    if _SESSION_FACTORY is None:
        raise RuntimeError("Database session factory is not initialized.")
    session = _SESSION_FACTORY()
    try:
        yield session
    finally:
        session.close()
