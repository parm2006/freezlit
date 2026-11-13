@echo off
setlocal
if not exist "%~dp0FreezlitSetup.exe" (
  echo FreezlitSetup.exe must be beside this installer.
  echo Download the new Windows installer from https://github.com/parm2006/freezlit/releases/latest
  pause
  exit /b 1
)
start "" /wait "%~dp0FreezlitSetup.exe" %*
if errorlevel 1 (
  echo Installation did not complete. Close Freezlit and try again.
  pause
  exit /b 1
)
