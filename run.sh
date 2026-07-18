#!/bin/bash
# SlideGuard - Run the development server
# Usage: ./run.sh

cd "$(dirname "$0")"
export PYTHONPATH="$(pwd):$PYTHONPATH"
echo "Starting SlideGuard..."
python3 backend/app.py
