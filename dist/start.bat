@echo off
title AdhocPrintStudio
echo.
echo  ========================================
echo   AdhocPrintStudio - Local Edition
echo  ========================================
echo.

REM Create directories if needed
if not exist "data" mkdir data
if not exist "storage" mkdir storage

REM Check if dependencies are installed
if not exist "python\Lib\site-packages\fastapi" (
    echo First run detected - installing dependencies...
    echo This may take a minute...
    python\python.exe -m pip install --no-warn-script-location -r requirements-local.txt
    echo.
)

echo Starting server at http://localhost:8000
echo Press Ctrl+C to stop.
echo.

REM Open browser after 2 second delay
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8000"

REM Start the server
python\python.exe -m uvicorn app.main_local:app --host 127.0.0.1 --port 8000
