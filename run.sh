#!/bin/bash
# SlideGuard - Run the development server with uv
# Usage: ./run.sh

cd "$(dirname "$0")"
uv run python backend/app.py
