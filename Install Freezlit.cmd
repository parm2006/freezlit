@echo off
setlocal
if not exist "%~dp0Freezlit.exe" (
  echo Freezlit.exe must be beside this installer.
  pause
  exit /b 1
)
set "FREEZLIT_INSTALL_SOURCE=%~dp0Freezlit.exe"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; $target = Join-Path $env:LOCALAPPDATA 'Programs\Freezlit'; New-Item -ItemType Directory -Force -Path $target | Out-Null; Copy-Item -LiteralPath $env:FREEZLIT_INSTALL_SOURCE -Destination (Join-Path $target 'Freezlit.exe') -Force; $shell = New-Object -ComObject WScript.Shell; $link = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Desktop')) 'Freezlit.lnk')); $link.TargetPath = Join-Path $target 'Freezlit.exe'; $link.WorkingDirectory = $target; $link.Save(); $menu = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs\Freezlit.lnk'; $link = $shell.CreateShortcut($menu); $link.TargetPath = Join-Path $target 'Freezlit.exe'; $link.WorkingDirectory = $target; $link.Save(); Write-Host 'Freezlit installed. Open Freezlit from your desktop or Start menu.'"
if errorlevel 1 echo Installation did not complete. Close Freezlit if it is running and try again.
pause
