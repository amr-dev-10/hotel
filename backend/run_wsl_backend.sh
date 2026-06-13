#!/usr/bin/env bash
set -euo pipefail

cd "/mnt/c/Users/Lenovo/Documents/Hotel Managment"
. .venv/bin/activate

exec uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
