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

REM Reuse an existing AdhocPrintStudio server if it is already healthy
python\python.exe -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)" >nul 2>&1
if not errorlevel 1 goto already_running

REM Give a clear message when another program owns the required port
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" >nul 2>&1
if not errorlevel 1 goto port_in_use

REM Start the server in the background
start /b "" python\python.exe -m uvicorn app.main_local:app --host 127.0.0.1 --port 8000 > data\server.log 2>&1

REM Wait for server to be ready (poll health endpoint)
echo Waiting for server to start...
set /a WAIT_COUNT=0
:wait_loop
timeout /t 1 /nobreak >nul
python\python.exe -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')" >nul 2>&1
if not errorlevel 1 goto server_ready
set /a WAIT_COUNT+=1
if %WAIT_COUNT% GEQ 30 goto startup_failed
goto wait_loop

:server_ready
echo Server is ready!
start http://localhost:8000

REM Keep window open so the server keeps running
echo.
echo Server running. Close this window or press Ctrl+C to stop.
cmd /k
exit /b 0

:already_running
echo AdhocPrintStudio is already running. Opening it in your browser...
start http://localhost:8000
timeout /t 2 /nobreak >nul
exit /b 0

:port_in_use
echo.
echo AdhocPrintStudio could not start because port 8000 is being used by another program.
echo Close the other program, then double-click start.bat again.
echo.
pause
exit /b 1

:startup_failed
echo.
echo AdhocPrintStudio did not start within 30 seconds.
echo Details were saved to data\server.log.
echo Close this window, review that file, then try start.bat again.
echo.
pause
exit /b 1
