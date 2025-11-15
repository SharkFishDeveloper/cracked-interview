@echo off

@REM REM === 1. Start Electron Overlay (hidden) ===
@REM powershell -WindowStyle Hidden -Command ^
@REM "Start-Process 'C:\Users\shahz\Desktop\cracked\frontend\out\cracked-win32-x64\cracked.exe' -WindowStyle Hidden"


@REM REM === 2. Start Transcriber Backend (hidden, no npm.ps1 bug) ===
@REM powershell -WindowStyle Hidden -Command ^
@REM \"Start-Process 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory 'C:\Users\shahz\Desktop\cracked\transcriber-bd' -WindowStyle Hidden\"

@REM REM === 3. Start Obs-streamer-to-capture-obs (hidden, no npm.ps1 bug) ===
@REM powershell -WindowStyle Hidden -Command ^
@REM \"Start-Process 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory 'C:\Users\shahz\Desktop\cracked\obs-streamer' -WindowStyle Hidden\"

REM === 4. Start OBS streaming service (hidden) ===
powershell -WindowStyle Hidden -Command ^
"Start-Process 'C:\Users\shahz\Desktop\cracked\obs-streamer\obs.bat' -WindowStyle Hidden"

exit
