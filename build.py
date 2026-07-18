"""SlideGuard PyInstaller build script.

Usage:
    pip install pyinstaller
    python build.py
"""

import os
import sys
import shutil

# Ensure we're in the project root
os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Clean previous builds
for d in ['build', 'dist', '__pycache__']:
    shutil.rmtree(d, ignore_errors=True)

# PyInstaller command
pyinstaller_args = [
    'pyinstaller',
    '--name=SlideGuard',
    '--onefile',
    '--windowed',
    '--add-data=frontend/templates:templates',
    '--add-data=frontend/static:static',
    '--hidden-import=backend',
    '--hidden-import=backend.engine',
    '--hidden-import=backend.models',
    '--hidden-import=backend.parsers',
    '--hidden-import=backend.reporters',
    '--hidden-import=backend.rules',
    '--hidden-import=backend.utils',
    '--hidden-import=lxml',
    '--hidden-import=numpy',
    '--hidden-import=sklearn',
    '--hidden-import=flask',
    '--hidden-import=openpyxl',
    '--hidden-import=PIL',
    'backend/app.py',
]

cmd = ' '.join(pyinstaller_args)
print(f"Running: {cmd}")
os.system(cmd)

print("\n=== Build complete ===")
print(f"Binary: dist/SlideGuard")
if os.path.exists('dist/SlideGuard'):
    size_mb = os.path.getsize('dist/SlideGuard') / (1024 * 1024)
    print(f"Size: {size_mb:.1f} MB")
