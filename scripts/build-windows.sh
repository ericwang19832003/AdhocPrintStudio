#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# build-windows.sh — Assemble AdhocPrintStudio Windows ZIP
# Run on Mac. Produces build/AdhocPrintStudio-Windows.zip
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

BUILD_DIR="$ROOT_DIR/build/windows-stage"
CACHE_DIR="$ROOT_DIR/build/.cache"
OUTPUT_ZIP="$ROOT_DIR/build/AdhocPrintStudio-Windows.zip"

PYTHON_VERSION="3.11.11"
PYTHON_URL="https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip"
PYTHON_ZIP="python-${PYTHON_VERSION}-embed-amd64.zip"

echo "=== AdhocPrintStudio Windows Build ==="
echo ""

# -----------------------------------------------------------
# 1. Clean previous staging area
# -----------------------------------------------------------
echo "[1/10] Preparing build directory..."
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR" "$CACHE_DIR"

# -----------------------------------------------------------
# 2. Download Python embeddable (cached)
# -----------------------------------------------------------
echo "[2/10] Downloading Python ${PYTHON_VERSION} embeddable for Windows..."
if [ -f "$CACHE_DIR/$PYTHON_ZIP" ]; then
    echo "       (using cached download)"
else
    curl -L -o "$CACHE_DIR/$PYTHON_ZIP" "$PYTHON_URL"
fi

# -----------------------------------------------------------
# 3. Extract Python and enable pip
# -----------------------------------------------------------
echo "[3/10] Extracting Python and enabling pip..."
mkdir -p "$BUILD_DIR/python"
unzip -q "$CACHE_DIR/$PYTHON_ZIP" -d "$BUILD_DIR/python"

# Uncomment 'import site' in python311._pth to enable pip
PTH_FILE="$BUILD_DIR/python/python311._pth"
if [ -f "$PTH_FILE" ]; then
    sed -i '' 's/^#import site/import site/' "$PTH_FILE"
    echo "       Enabled 'import site' in python311._pth"
else
    echo "       WARNING: python311._pth not found"
fi

# -----------------------------------------------------------
# 4. Create requirements-local.txt
# -----------------------------------------------------------
echo "[4/10] Creating requirements-local.txt..."
cat > "$BUILD_DIR/requirements-local.txt" << 'EOF'
fastapi==0.115.0
uvicorn==0.30.6
python-dotenv==1.0.1
SQLAlchemy==2.0.35
pillow==10.4.0
openpyxl==3.1.5
python-multipart==0.0.9
defusedxml==0.7.1
PyMuPDF==1.24.5
filetype==1.2.0
EOF

# -----------------------------------------------------------
# 5. Copy API app
# -----------------------------------------------------------
echo "[5/10] Copying API app..."
cp -R "$ROOT_DIR/apps/api/app" "$BUILD_DIR/app"

# -----------------------------------------------------------
# 6. Copy worker
# -----------------------------------------------------------
echo "[6/10] Copying worker..."
cp -R "$ROOT_DIR/apps/worker/worker" "$BUILD_DIR/worker"

# -----------------------------------------------------------
# 7. Build frontend and copy output
# -----------------------------------------------------------
echo "[7/10] Building frontend..."
(cd "$ROOT_DIR" && BUILD_LOCAL=1 npm run build)
cp -R "$ROOT_DIR/out" "$BUILD_DIR/web"

# -----------------------------------------------------------
# 8. Copy launcher files from dist/
# -----------------------------------------------------------
echo "[8/10] Copying launcher files..."
cp "$ROOT_DIR/dist/start.bat" "$BUILD_DIR/start.bat"
cp "$ROOT_DIR/dist/stop.bat" "$BUILD_DIR/stop.bat"
cp "$ROOT_DIR/dist/README.txt" "$BUILD_DIR/README.txt"

# -----------------------------------------------------------
# 9. Create empty data/ and storage/ directories
# -----------------------------------------------------------
echo "[9/10] Creating data and storage directories..."
mkdir -p "$BUILD_DIR/data"
mkdir -p "$BUILD_DIR/storage"

# Keep empty dirs in the zip with .gitkeep
touch "$BUILD_DIR/data/.gitkeep"
touch "$BUILD_DIR/storage/.gitkeep"

# -----------------------------------------------------------
# 10. Create setup.bat for first-run pip install
# -----------------------------------------------------------
echo "[9b/10] Creating setup.bat..."
cat > "$BUILD_DIR/setup.bat" << 'BATEOF'
@echo off
echo.
echo  Installing dependencies...
echo  This may take a minute.
echo.
python\python.exe -m pip install --no-warn-script-location -r requirements-local.txt
echo.
echo  Done! You can now run start.bat
echo.
pause
BATEOF

# -----------------------------------------------------------
# 11. Create the ZIP
# -----------------------------------------------------------
echo "[10/10] Creating ZIP archive..."
rm -f "$OUTPUT_ZIP"
(cd "$BUILD_DIR" && zip -r "$OUTPUT_ZIP" .)

echo ""
echo "=== Build complete ==="
echo "Output: $OUTPUT_ZIP"
echo "Size:   $(du -h "$OUTPUT_ZIP" | cut -f1)"
