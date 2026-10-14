@echo off
cd /d "%~dp0"
if exist "Freezlit.exe" (
  start "" "%~dp0Freezlit.exe" %*
  exit /b
)
where py >nul 2>nul
if not errorlevel 1 (
  py -3 server.py %*
) else (
  where python >nul 2>nul
  if not errorlevel 1 (
    python server.py %*
  ) else (
    echo Install Python 3.10 or later from https://www.python.org/downloads/ and pywebview, or use Freezlit.exe.
    pause
  )
)
