# Open Ledger MA data pipeline.
#   make setup   create .venv and install requirements
#   make pull    fetch raw CTHRU rows (cached; FORCE=1 to refresh, YEARS="2026 2027" to limit)
#   make build   write data/*.json and the METHODOLOGY totals table
#   make check   validate data/ against docs/DATA_CONTRACT.md
#   make all     setup + pull + build + check

PYTHON ?= python3
VENV   := .venv
PY     := $(VENV)/bin/python
YEARS  ?= 2024 2025 2026 2027
PULL_FLAGS := --years $(YEARS) $(if $(FORCE),--force,)

.PHONY: setup pull build check all clean-raw

all: setup pull build check

$(PY): requirements.txt
	$(PYTHON) -m venv $(VENV)
	$(PY) -m pip install --quiet --upgrade pip
	$(PY) -m pip install --quiet -r requirements.txt
	@touch $(PY)

setup: $(PY)

pull: setup
	$(PY) etl/pull.py $(PULL_FLAGS)

build: setup
	$(PY) etl/build.py --years $(YEARS)

check: setup
	$(PY) etl/check.py

clean-raw:
	rm -rf etl/raw
