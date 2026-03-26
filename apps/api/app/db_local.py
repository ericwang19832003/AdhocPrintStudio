"""SQLite database layer for local deployment.

Replaces PostgreSQL-based db.py with a SQLite backend.
Uses WAL mode and foreign key enforcement.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker


class Base(DeclarativeBase):
    pass


def get_database_path() -> str:
    """Return the SQLite database file path from env or default."""
    return os.getenv("LOCAL_DATABASE_PATH", "data/studio.db")


_ENGINE: Engine | None = None
_SESSION_FACTORY: sessionmaker | None = None


def get_engine() -> Engine:
    """Create or return the singleton SQLite engine.

    Enables WAL mode and foreign key enforcement via PRAGMA statements.
    """
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is None:
        db_path = get_database_path()
        # Ensure parent directory exists
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        db_url = f"sqlite:///{db_path}"
        _ENGINE = create_engine(
            db_url,
            connect_args={"check_same_thread": False},
        )

        # Enable WAL mode and foreign keys on every new connection
        @event.listens_for(_ENGINE, "connect")
        def _set_sqlite_pragma(dbapi_conn, connection_record):
            cursor = dbapi_conn.cursor()
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        _SESSION_FACTORY = sessionmaker(
            bind=_ENGINE, autoflush=False, autocommit=False
        )
    return _ENGINE


@contextmanager
def get_session() -> Generator[Session, None, None]:
    """Yield a SQLAlchemy session, closing it when done."""
    if _SESSION_FACTORY is None:
        get_engine()
    if _SESSION_FACTORY is None:
        raise RuntimeError("Database session factory is not initialized.")
    session = _SESSION_FACTORY()
    try:
        yield session
    finally:
        session.close()


def init_db() -> None:
    """Create all tables defined on Base.metadata."""
    from app.models_local import Base as ModelsBase  # noqa: F811

    engine = get_engine()
    ModelsBase.metadata.create_all(engine)


def ping_db() -> None:
    """Execute SELECT 1 to verify database connectivity."""
    engine = get_engine()
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def _reset() -> None:
    """Dispose engine and reset singletons. For testing only."""
    global _ENGINE, _SESSION_FACTORY
    if _ENGINE is not None:
        _ENGINE.dispose()
    _ENGINE = None
    _SESSION_FACTORY = None
