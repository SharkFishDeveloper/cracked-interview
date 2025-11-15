@REM @echo off

@REM @REM REM === 1. Start Electron Overlay (hidden) ===
@REM @REM powershell -WindowStyle Hidden -Command ^
@REM @REM "Start-Process 'C:\Users\shahz\Desktop\cracked\frontend\out\cracked-win32-x64\cracked.exe' -WindowStyle Hidden"


@REM @REM REM === 2. Start Transcriber Backend (hidden, no npm.ps1 bug) ===
@REM @REM powershell -WindowStyle Hidden -Command ^
@REM @REM \"Start-Process 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory 'C:\Users\shahz\Desktop\cracked\transcriber-bd' -WindowStyle Hidden\"

@REM @REM REM === 3. Start Obs-streamer-to-capture-obs (hidden, no npm.ps1 bug) ===
@REM @REM powershell -WindowStyle Hidden -Command ^
@REM @REM \"Start-Process 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory 'C:\Users\shahz\Desktop\cracked\obs-streamer' -WindowStyle Hidden\"

@REM REM === 4. Start OBS streaming service (hidden) ===
@REM powershell -WindowStyle Hidden -Command ^
@REM "Start-Process 'C:\Users\shahz\Desktop\cracked\obs-streamer\obs.bat' -WindowStyle Hidden"

@REM exit
