@REM @echo off


@REM REM --- Start Overlay EXE (non-blocking) ---
@REM start /min "" "C:\Users\shahz\Desktop\cracked\frontend\out\cracked-win32-x64\cracked.exe"


@REM REM --- Start OBS streamer (non-blocking) ---
@REM start /min "" "C:\Users\shahz\Desktop\cracked\obs-streamer\obs.bat"


@REM @REM REM === Start PM2 ecosystem silently (non-blocking) ===
@REM @REM cd /d "C:\Users\shahz\Desktop\cracked"
@REM @REM start "" pm2 start ecosystem.config.cjs >nul 2>&1

@REM exit


@echo off

powershell -WindowStyle Hidden -Command "Start-Process 'C:\Users\shahz\Desktop\cracked\frontend\out\cracked-win32-x64\cracked.exe' -WindowStyle Hidden"