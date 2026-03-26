@echo off
echo Stopping AdhocPrintStudio...
taskkill /F /FI "WINDOWTITLE eq AdhocPrintStudio" 2>nul
echo Done.
timeout /t 2 /nobreak >nul
