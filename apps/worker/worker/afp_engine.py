from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


@dataclass
class EngineErrorContext(Exception):
    message: str
    row: int | None = None
    page: int | None = None

    def __str__(self) -> str:
        parts = [self.message]
        if self.row is not None:
            parts.append(f"row={self.row}")
        if self.page is not None:
            parts.append(f"page={self.page}")
        return " | ".join(parts)


@dataclass
class RunContext:
    run_id: str
    job_id: str
    tle_manifest: dict[str, Any]


class AFPResult(Protocol):
    def read(self) -> bytes: ...


class AFPEngine(Protocol):
    def generate(self, run_context: RunContext) -> bytes | AFPResult: ...


class StubAFPEngine:
    def generate(self, run_context: RunContext) -> bytes:
        return b"stub-afp"


class RealAFPEngine:
    def generate(self, run_context: RunContext) -> bytes:
        raise EngineErrorContext("Real AFP engine not configured")
