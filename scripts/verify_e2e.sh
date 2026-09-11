#!/usr/bin/env bash
set -e

echo "=== TrustShare Platform End-to-End Verification ==="
echo "1. Checking Python environment..."
source .venv/bin/activate
python3 -c "import fastapi, cryptography, sqlalchemy, pydantic; print('[OK] Core dependencies verified')"

echo "2. Running Full Test Suite..."
PYTHONPATH=backend pytest backend/tests/ -v

echo "3. Platform Verification Complete: All systems operational!"
