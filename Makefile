.PHONY: run test lint format install install-dev

VENV ?= .venv
PYTHON ?= python3

run:
	$(PYTHON) -m uvicorn app.main:app --reload

test:
	$(PYTHON) -m pytest tests/ -v

lint:
	ruff check app utils scripts
	ruff format --check app utils scripts

format:
	ruff check --fix app utils scripts
	ruff format app utils scripts

install:
	pip install -r requirements.txt

install-dev: install
	pip install -r requirements-dev.txt
