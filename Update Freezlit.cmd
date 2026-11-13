@echo off
setlocal
set "FREEZLIT_UPDATER=%LOCALAPPDATA%\FreezlitDesktop\Update.exe"
if not exist "%FREEZLIT_UPDATER%" (
  echo Install FreezlitSetup.exe once to enable updates. Your decks will be kept.
  pause
  exit /b 1
)
start "" "%FREEZLIT_UPDATER%" start -- --update
