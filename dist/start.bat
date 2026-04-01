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

echo Starting server at http://localhost:8000
echo Press Ctrl+C to stop.
echo.

REM Start the server in the background
start /b python\python.exe -m uvicorn app.main_local:app --host 127.0.0.1 --port 8000

REM Wait for server to be ready (poll health endpoint)
echo Waiting for server to start...
:wait_loop
timeout /t 1 /nobreak >nul
python\python.exe -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" >nul 2>&1
if errorlevel 1 goto wait_loop

echo Server is ready!
start http://localhost:8000

REM Keep window open so the server keeps running
echo.
echo Server running. Close this window or press Ctrl+C to stop.
cmd /k
