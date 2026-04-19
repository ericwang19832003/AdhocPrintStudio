SHELL := /bin/bash
MSG ?= update
.PHONY: dev-api dev-worker dev-web fmt test migrate-aws makemigrations

dev-api:
	cd apps/api && \
	python3.11 -m venv .venv && \
	. .venv/bin/activate && \
	pip install -r requirements.txt && \
	uvicorn app.main:app --reload --host 0.0.0.0 --port $${API_PORT:-8000}

dev-worker:
	cd apps/worker && \
	python3.11 -m venv .venv && \
	. .venv/bin/activate && \
	pip install -r requirements.txt && \
	python -m worker.main

dev-web:
	cd apps/web && \
	npm install && \
	npm run dev

migrate-aws:
	cd apps/api && \
	. .venv/bin/activate 2>/dev/null || (python3.11 -m venv .venv && . .venv/bin/activate) && \
	pip install -r requirements.txt && \
	alembic upgrade head

makemigrations:
	cd apps/api && \
	. .venv/bin/activate 2>/dev/null || (python3.11 -m venv .venv && . .venv/bin/activate) && \
	pip install -r requirements.txt && \
	alembic revision --autogenerate -m "$(MSG)"

fmt:
	cd apps/api && \
	. .venv/bin/activate 2>/dev/null || (python3.11 -m venv .venv && . .venv/bin/activate) && \
	pip install -r requirements.txt && \
	ruff format app
	cd apps/worker && \
	. .venv/bin/activate 2>/dev/null || (python3.11 -m venv .venv && . .venv/bin/activate) && \
	pip install -r requirements.txt && \
	ruff format worker
	cd apps/web && \
	npm install && \
	npm run lint -- --fix

test:
	cd apps/api && \
	. .venv/bin/activate 2>/dev/null || (python3.11 -m venv .venv && . .venv/bin/activate) && \
	pip install -r requirements.txt && \
	pytest
	cd apps/worker && \
	. .venv/bin/activate 2>/dev/null || (python3.11 -m venv .venv && . .venv/bin/activate) && \
	pip install -r requirements.txt && \
	pytest
	cd apps/web && \
	npm install && \
	npm run lint
