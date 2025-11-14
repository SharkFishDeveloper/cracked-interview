@echo off
setlocal enabledelayedexpansion

set "OBS_PATH=D:\obs-record\obs-studio\bin\64bit"

REM Check if OBS is running
tasklist /FI "IMAGENAME eq obs64.exe" 2>nul | find /I "obs64.exe" >nul
if %errorlevel%==0 (
    echo 🔴 OBS is running — stopping it now...
    taskkill /IM obs64.exe /F >nul 2>&1

    REM WAIT 2 seconds using PowerShell (safe inside concurrently)
    powershell -command "Start-Sleep -Seconds 2"

    echo ✅ OBS stopped.
) else (
    echo 🟢 Starting OBS silently...
    del "%AppData%\obs-studio\crashmarker.txt" >nul 2>&1
    cd /d "%OBS_PATH%"
    start "" obs64.exe --startstreaming --minimize-to-tray
    echo ✅ OBS started and streaming in background.
)

exit /b
