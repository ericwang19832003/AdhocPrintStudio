from __future__ import annotations

import os

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from contextlib import contextmanager

from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def get_database_url() -> str | None:
    url = os.getenv("DATABASE_URL")
    return url if url else None


_ENGINE: Engine | None = None
_SESSION_FACTORY: sessionmaker | None = None


def get_engine() -> Engine:
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is None:
        db_url = get_database_url()
        if not db_url:
            raise RuntimeError("DATABASE_URL is not set.")
        _ENGINE = create_engine(db_url, pool_pre_ping=True)
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


def ping_db() -> None:
    engine = get_engine()
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def get_alembic_revision() -> str | None:
    if not get_database_url():
        return None
    try:
        engine = get_engine()
        with engine.connect() as connection:
            result = connection.execute(text("SELECT version_num FROM alembic_version"))
            row = result.first()
            if row:
                return str(row[0])
    except Exception:
        return None
    return None
