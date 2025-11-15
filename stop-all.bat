@echo off

echo 🔴 Stopping all cracked services...

REM === Stop Electron overlay ===
taskkill /IM cracked.exe /F >nul 2>&1

REM === Stop OBS streamer (obs64.exe) ===
taskkill /IM obs64.exe /F >nul 2>&1

REM === Stop Node servers (transcriber, frontend dev) ===
taskkill /IM node.exe /F >nul 2>&1

REM === Stop any leftover npm windows ===
taskkill /IM cmd.exe /F >nul 2>&1
taskkill /IM powershell.exe /F >nul 2>&1

echo 🟢 All services stopped.
exit /b
