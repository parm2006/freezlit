import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from updater import Updater, app_lock, create_manager, installation_root


class UpdaterTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.release = SimpleNamespace(TargetFullRelease=SimpleNamespace(Version='1.5.1'))
        self.manager = Mock()
        self.manager.get_current_version.return_value = '1.5.0'
        self.manager.check_for_updates.return_value = self.release
        self.api = Updater(lambda: self.manager, self.root)

    def ready(self):
        self.assertEqual(self.api.check()['stage'], 'available')
        self.manager.download_updates.side_effect = lambda update, callback: callback(75)
        self.assertEqual(self.api.download()['stage'], 'ready')

    def test_available_version_and_installed_version(self):
        state = self.api.check()
        self.assertEqual((state['stage'], state['current'], state['version']), ('available', '1.5.0', '1.5.1'))

    def test_no_update_does_not_download_or_install(self):
        self.manager.check_for_updates.return_value = None
        self.assertEqual(self.api.check()['stage'], 'current')
        self.api.download()
        self.api.install()
        self.manager.download_updates.assert_not_called()
        self.manager.wait_exit_then_apply_updates.assert_not_called()

    def test_offline_check_is_retryable(self):
        self.manager.check_for_updates.side_effect = OSError('offline')
        self.assertEqual(self.api.check()['stage'], 'error')
        self.manager.check_for_updates.side_effect = None
        self.assertEqual(self.api.check()['stage'], 'available')

    def test_corrupt_download_cannot_be_installed(self):
        self.api.check()
        self.manager.download_updates.side_effect = ValueError('bad checksum')
        self.assertEqual(self.api.download()['stage'], 'error')
        self.api.install()
        self.manager.wait_exit_then_apply_updates.assert_not_called()

    def test_download_progress_and_verification_complete_before_ready(self):
        self.ready()
        self.assertEqual(self.api.state()['progress'], 100)
        self.manager.download_updates.assert_called_once()

    def test_duplicate_operation_is_ignored(self):
        with self.api._busy:
            self.api.check()
            self.api.download()
            self.api.install()
        self.manager.check_for_updates.assert_not_called()
        self.manager.download_updates.assert_not_called()
        self.manager.wait_exit_then_apply_updates.assert_not_called()

    @unittest.skipUnless(sys.platform == 'win32', 'Windows installation locking')
    def test_running_study_app_prevents_install_until_closed(self):
        self.ready()
        with app_lock(self.root):
            state = self.api.install()
        self.assertEqual(state['stage'], 'ready')
        self.assertIn('Close Freezlit', state['message'])
        self.manager.wait_exit_then_apply_updates.assert_not_called()
        try:
            self.assertEqual(self.api.install()['stage'], 'applying')
            self.manager.wait_exit_then_apply_updates.assert_called_once_with(self.release, restart=True, restart_args=[])
        finally:
            self.api._apply_lock.__exit__(None, None, None)

    @unittest.skipUnless(sys.platform == 'win32', 'Windows installation locking')
    def test_failed_helper_start_releases_lock_and_keeps_window_open(self):
        self.ready()
        self.api._window = Mock()
        self.manager.wait_exit_then_apply_updates.side_effect = OSError('helper failed')
        self.assertEqual(self.api.install()['stage'], 'error')
        self.api._window.destroy.assert_not_called()
        with app_lock(self.root):
            pass

    def test_source_checkout_is_not_mistaken_for_an_installation(self):
        with patch('updater.sys.executable', str(self.root / 'Freezlit.exe')), patch('updater.sys.frozen', True, create=True):
            self.assertIsNone(installation_root())
            (self.root / 'sq.version').write_text('manifest')
            self.assertEqual(installation_root(), self.root.parent)

    def test_uninstalled_updater_has_actionable_message(self):
        with patch('updater.installation_root', return_value=None):
            with self.assertRaisesRegex(RuntimeError, 'Install FreezlitSetup.exe'):
                create_manager()


if __name__ == '__main__':
    unittest.main()
