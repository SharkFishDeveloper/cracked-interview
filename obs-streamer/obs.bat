@echo off
setlocal

set "OBS_PATH=D:\obs-record\obs-studio\bin\64bit"

REM 🔍 Check if OBS is already running
tasklist /FI "IMAGENAME eq obs64.exe" | find /I "obs64.exe" >nul
if %errorlevel%==0 (
    echo 🟢 OBS is already running. Nothing to do.
    exit /b
)

REM 🚀 Start OBS silently
echo 🟡 OBS not running — starting now...
del "%AppData%\obs-studio\crashmarker.txt" >nul 2>&1
cd /d "%OBS_PATH%"
start "" obs64.exe --startstreaming --minimize-to-tray

echo ✅ OBS started in background.
exit /b
