"""Exercise real update packages in a disposable portable installation; no user install/shortcuts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from zipfile import ZipFile

import velopack

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from updater import app_lock


def manager(root, feed):
    locator = velopack.VelopackLocatorConfig(root, root / 'Update.exe', root / 'packages',
        root / 'current/sq.version', root / 'current', True)
    return velopack.UpdateManager(str(feed), locator=locator)


def read_state(process, port):
    for _ in range(100):
        if process.poll() is not None:
            raise AssertionError(f'Packaged app exited early: {process.returncode}')
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/state', timeout=1) as response:
                return json.load(response)
        except OSError:
            time.sleep(.2)
    raise AssertionError('Packaged app did not start')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--release-dir', type=Path, default=ROOT / 'dist/windows-release')
    parser.add_argument('--app-dir', type=Path, default=ROOT / 'build/updatable/Freezlit')
    parser.add_argument('--vpk', type=Path)
    args = parser.parse_args()
    build = ROOT / 'build'
    build.mkdir(exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix='updater-qa-', dir=build))
    install = work / 'installed'
    portable = next(args.release_dir.glob('*-Portable.zip'))
    with ZipFile(portable) as archive:
        archive.extractall(install)
    data = work / 'study-data'
    data.mkdir()
    fixture = {'version': 1, 'decks': [{'id': 'qa', 'title': 'Preserved deck', 'cards': [
        {'id': 'qa-card', 'term': '日本', 'definition': 'Japan', 'schedule': {}}]}],
        'settings': {'newLimit': 20, 'reviewLimit': 200}, 'history': [], 'records': {}}
    (data / 'library.json').write_text(json.dumps(fixture), encoding='utf-8')
    env = {**os.environ, 'FREEZLIT_DATA_DIR': str(data)}
    payload = work / 'payload'
    shutil.copytree(args.app_dir, payload)
    marker = payload / '_internal/web/updater.js'
    marker.write_text(marker.read_text(encoding='utf-8') + '\n// QA: updated updater UI\n', encoding='utf-8')
    before = hashlib.sha256((install / 'current/_internal/web/updater.js').read_bytes()).hexdigest()
    initial = manager(install, args.release_dir).get_current_version()
    version = initial.split('.')
    version[-1] = str(int(version[-1]) + 1)
    target = '.'.join(version)
    feed = work / 'feed'
    command = [str(args.vpk.resolve())] if args.vpk else ['dotnet', 'tool', 'run', 'vpk', '--']
    subprocess.run(command + ['pack', '--packId', 'FreezlitDesktop', '--packTitle', 'Freezlit',
        '--packVersion', target, '--packDir', str(payload), '--mainExe', 'Freezlit.exe',
        '--runtime', 'win-x64', '--channel', 'win', '--noInst', '--outputDir', str(feed)],
        check=True, cwd=ROOT)
    with socket.socket() as connection:
        connection.bind(('127.0.0.1', 0))
        port = connection.getsockname()[1]
    app = subprocess.Popen([str(install / 'current/Freezlit.exe'), '--no-browser', '--port', str(port)],
                           env=env, creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        state_before = read_state(app, port)
        assert state_before['decks'][0]['title'] == 'Preserved deck'
        try:
            with app_lock(install):
                raise AssertionError('A running study session must prevent installation')
        except BlockingIOError:
            pass
        mgr = manager(install, feed)
        update = mgr.check_for_updates()
        assert update.TargetFullRelease.Version == target
        progress = []
        mgr.download_updates(update, progress.append)
        with ZipFile(next(feed.glob('*-full.nupkg'))) as package:
            assert (install / 'Update.exe').read_bytes() == package.read('lib/app/Squirrel.exe'), 'Native updater must also be refreshed'
    finally:
        app.terminate()
        app.wait(timeout=10)
    # Wait for the native helper itself: its manifest changes before final cleanup completes.
    with app_lock(install):
        subprocess.run([str(install / 'Update.exe'), '--silent', 'apply', '--norestart',
            '--package', str(install / 'packages' / update.TargetFullRelease.FileName)],
            check=True, cwd=ROOT, timeout=90)
    assert manager(install, feed).get_current_version() == target
    assert hashlib.sha256((install / 'current/_internal/web/updater.js').read_bytes()).hexdigest() != before
    app = subprocess.Popen([str(install / 'current/Freezlit.exe'), '--no-browser', '--port', str(port)],
                           env=env, creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        assert read_state(app, port) == state_before, 'Study data must survive replacement and relaunch'
    finally:
        app.terminate()
        app.wait(timeout=10)
    # A tampered full package must fail before it can replace the app or updater.
    damaged_install = work / 'damaged-install'
    with ZipFile(portable) as archive:
        archive.extractall(damaged_install)
    damaged_feed = work / 'damaged-feed'
    shutil.copytree(feed, damaged_feed)
    package = next(damaged_feed.glob('*-full.nupkg'))
    with package.open('r+b') as handle:
        handle.seek(-1, os.SEEK_END)
        value = handle.read(1)
        handle.seek(-1, os.SEEK_END)
        handle.write(bytes([value[0] ^ 1]))
    original_updater = (damaged_install / 'Update.exe').read_bytes()
    damaged_manager = manager(damaged_install, damaged_feed)
    try:
        damaged_manager.download_updates(damaged_manager.check_for_updates())
    except Exception:
        pass
    else:
        raise AssertionError('A tampered update must be rejected')
    assert damaged_manager.get_current_version() == initial
    assert (damaged_install / 'Update.exe').read_bytes() == original_updater
    report = {'passed': True, 'from': initial, 'to': target, 'appReplaced': True,
        'updaterReplaced': True, 'studyDataPreserved': True, 'runningAppBlocked': True,
        'tamperedPackageRejected': True, 'isolatedDirectory': str(work)}
    (work / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
