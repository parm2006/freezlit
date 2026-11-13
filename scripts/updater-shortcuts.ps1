param([Parameter(Mandatory)][string]$InstallRoot, [switch]$Remove)
$ErrorActionPreference = 'Stop'
$updaterPath = Join-Path $InstallRoot 'Update.exe'
$shell = New-Object -ComObject WScript.Shell
foreach ($folder in @([Environment]::GetFolderPath('Desktop'), (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'))) {
    $shortcutPath = Join-Path $folder 'Update Freezlit.lnk'
    if ($Remove) {
        if (Test-Path -LiteralPath $shortcutPath) {
            $shortcut = $shell.CreateShortcut($shortcutPath)
            if ($shortcut.TargetPath -eq $updaterPath) { Remove-Item -LiteralPath $shortcutPath }
        }
    } else {
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $updaterPath
        $shortcut.Arguments = 'start -- --update'
        $shortcut.WorkingDirectory = $InstallRoot
        $shortcut.IconLocation = (Join-Path $InstallRoot 'Freezlit.exe') + ',0'
        $shortcut.Save()
    }
}
