"""Package an onedir build as a Velopack installer and GitHub update feed."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--version', default=json.loads((ROOT / 'package.json').read_text())['version'])
    parser.add_argument('--app-dir', type=Path, default=ROOT / 'dist' / 'Freezlit')
    parser.add_argument('--output', type=Path, default=ROOT / 'dist' / 'windows-release')
    parser.add_argument('--vpk', type=Path, help='Optional vpk executable; otherwise use the pinned dotnet tool.')
    args = parser.parse_args()
    if not (args.app_dir / 'Freezlit.exe').is_file():
        parser.error('Run python build.py --updatable first.')
    command = [str(args.vpk.resolve())] if args.vpk else ['dotnet', 'tool', 'run', 'vpk', '--']
    subprocess.run(command + ['pack', '--packId', 'FreezlitDesktop', '--packTitle', 'Freezlit',
        '--packVersion', args.version, '--packDir', str(args.app_dir.resolve()), '--mainExe', 'Freezlit.exe',
        '--runtime', 'win-x64', '--channel', 'win', '--icon', str(ROOT / 'assets/freezlit.ico'),
        '--outputDir', str(args.output.resolve())], check=True, cwd=ROOT)
    shutil.copy2(args.output / 'FreezlitDesktop-win-Setup.exe', args.output / 'FreezlitSetup.exe')
    for name in ['Install Freezlit.cmd', 'Update Freezlit.cmd', 'LICENSE', 'THIRD_PARTY_NOTICES.md']:
        shutil.copy2(ROOT / name, args.output / name)
    shutil.copytree(ROOT / 'third-party-licenses', args.output / 'third-party-licenses', dirs_exist_ok=True)
    # Publishing only Setup would leave existing updaters without a package/feed.
    assets = [args.output / 'FreezlitSetup.exe', args.output / 'releases.win.json', *args.output.glob('*.nupkg')]
    checksums = []
    for asset in sorted(assets):
        with asset.open('rb') as handle:
            checksums.append(f'{hashlib.file_digest(handle, "sha256").hexdigest()}  {asset.name}')
    (args.output / 'SHA256SUMS-Windows.txt').write_text('\n'.join(checksums) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
