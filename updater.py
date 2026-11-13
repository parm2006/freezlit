"""User-initiated Windows updates. Velopack owns package verification/replacement."""
from contextlib import contextmanager
from pathlib import Path
import os
import subprocess
import sys
import threading

REPOSITORY = 'https://github.com/parm2006/freezlit'


def resources():
    return Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))


def installation_root():
    folder = Path(sys.executable).resolve().parent
    if getattr(sys, 'frozen', False) and (folder / 'sq.version').is_file():
        return folder.parent
    return None


@contextmanager
def app_lock(root):
    """Keep installation from terminating a running study session with unsaved work."""
    import msvcrt
    with (Path(root) / '.freezlit-running.lock').open('a+b') as handle:
        handle.seek(0, os.SEEK_END)
        if handle.tell() == 0:
            handle.write(b'\0')
            handle.flush()
        handle.seek(0)
        try:
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise BlockingIOError('Close Freezlit, then choose Install and reopen again.') from exc
        try:
            yield
        finally:
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)


def update_shortcuts(remove=False):
    root = installation_root()
    if root is None:
        return
    # A custom/QA installation must not change the user's real shortcuts.
    if root != (Path(os.environ.get('LOCALAPPDATA', '')) / 'FreezlitDesktop').resolve():
        return
    command = ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
               '-File', str(resources() / 'scripts' / 'updater-shortcuts.ps1'), '-InstallRoot', str(root)]
    if remove:
        command.append('-Remove')
    subprocess.run(command, check=True, timeout=20, creationflags=subprocess.CREATE_NO_WINDOW)


def create_manager():
    import velopack
    if installation_root() is None:
        raise RuntimeError('Install FreezlitSetup.exe once to enable updates. Your decks will be kept.')
    source = velopack.HttpSource(REPOSITORY + '/releases/latest/download',
                                velopack.HttpOptions([], 120_000))
    return velopack.UpdateManager(source)


class Updater:
    def __init__(self, manager_factory=create_manager, root=None):
        self._factory = manager_factory
        self._root = root if root is not None else installation_root()
        self._manager = None
        self._update = None
        self._busy = threading.Lock()
        self._state = dict(stage='idle', current='', version='', progress=0, message='Check for a new version of Freezlit.')
        self._apply_lock = None
        self._window = None

    def state(self):
        return self._state.copy()

    def _set(self, stage, message, **values):
        self._state = {**self._state, **values, 'stage': stage, 'message': message}

    def check(self):
        if not self._busy.acquire(blocking=False):
            return self.state()
        try:
            self._set('checking', 'Checking GitHub for updates…')
            self._update = None
            self._manager = self._factory()
            self._state['current'] = self._manager.get_current_version()
            self._update = self._manager.check_for_updates()
            if self._update is None:
                self._set('current', 'You have the latest version.')
            else:
                self._set('available', 'A new version is ready to download.', version=self._update.TargetFullRelease.Version)
        except Exception:
            message = ('Install FreezlitSetup.exe once to enable updates. Your decks will be kept.'
                       if self._root is None else
                       'Could not check for updates. Check your connection and try again later.')
            self._set('error', message)
        finally:
            self._busy.release()
        return self.state()

    def download(self):
        if not self._busy.acquire(blocking=False):
            return self.state()
        try:
            if self._state['stage'] != 'available' or self._update is None:
                return self.state()
            self._set('downloading', 'Downloading and verifying the update…', progress=0)
            self._manager.download_updates(self._update, lambda value: self._state.update(progress=value))
            self._set('ready', 'Download verified. Close Freezlit before installing.', progress=100)
        except Exception:
            self._set('error', 'The update could not be downloaded or verified. Freezlit has not been replaced. Check again to retry.')
        finally:
            self._busy.release()
        return self.state()

    def install(self):
        if not self._busy.acquire(blocking=False):
            return self.state()
        try:
            if self._state['stage'] != 'ready' or self._update is None:
                return self.state()
            self._apply_lock = app_lock(self._root)
            self._apply_lock.__enter__()
            try:
                self._manager.wait_exit_then_apply_updates(self._update, restart=True, restart_args=[])
            except Exception:
                self._apply_lock.__exit__(*sys.exc_info())
                self._apply_lock = None
                raise
            self._set('applying', 'Installing the update. Freezlit will reopen shortly.')
            if self._window is not None:
                self._window.destroy()
            # Keep the installation lock until this process exits, as the helper waits for us.
        except BlockingIOError as exc:
            self._apply_lock = None
            self._set('ready', str(exc))
        except Exception:
            self._set('error', 'Could not start installation. Your decks are unchanged. Close this updater and try again.')
        finally:
            self._busy.release()
        return self.state()


def run_updater():
    import webview
    api = Updater()
    window = webview.create_window('Update Freezlit', str(resources() / 'web' / 'updater.html'),
                                   width=580, height=440, min_size=(420, 380),
                                   js_api=api, background_color='#F6F5EF')
    api._window = window
    window.events.closing += lambda: api.state()['stage'] not in ('checking', 'downloading')
    webview.start(gui='edgechromium', private_mode=True, icon=str(resources() / 'assets' / 'freezlit.ico'))
    return 0
