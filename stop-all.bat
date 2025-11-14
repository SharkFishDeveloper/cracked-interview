@echo off

REM === Stop OBS if running ===
tasklist /FI "IMAGENAME eq obs64.exe" 2>nul | find /I "obs64.exe" >nul
if %errorlevel%==0 (
    echo 🔴 Closing OBS...
    taskkill /IM obs64.exe /F >nul 2>&1
    echo ✅ OBS closed.
) else (
    echo 🟢 OBS was not running.
)

REM === Stop cracked Electron overlay if running ===
tasklist /FI "IMAGENAME eq cracked.exe" 2>nul | find /I "cracked.exe" >nul
if %errorlevel%==0 (
    echo 🔴 Closing cracked overlay...
    taskkill /IM cracked.exe /F >nul 2>&1
    echo ✅ cracked overlay closed.
) else (
    echo 🟢 cracked overlay was not running.
)

REM === Stop PM2 silently ===
cd /d "C:\Users\shahz\Desktop\cracked"
powershell -WindowStyle Hidden -Command "pm2 delete all" >nul 2>&1
powershell -WindowStyle Hidden -Command "pm2 kill" >nul 2>&1

echo 🗑️ PM2 apps deleted silently.

exit /b
