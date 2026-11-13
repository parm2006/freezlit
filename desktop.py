"""Packaged entry point: handle installer hooks before importing the study app."""
import sys


def main():
    if sys.platform == 'win32':
        import velopack
        from updater import update_shortcuts
        # Installation and fast-exit hooks must run before server/storage startup.
        velopack.App().set_auto_apply_on_startup(False).on_first_run(
            lambda version: update_shortcuts()
        ).on_before_uninstall_fast_callback(
            lambda version: update_shortcuts(remove=True)
        ).run()
    from updater import app_lock, installation_root, run_updater
    if '--update' in sys.argv:
        return run_updater()
    from server import main as run_app
    root = installation_root()
    if root is None:
        return run_app()
    try:
        with app_lock(root):
            return run_app()
    except BlockingIOError:
        import ctypes
        ctypes.windll.user32.MessageBoxW(None, 'Freezlit is already open or an update is being installed.', 'Freezlit', 0x40)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
