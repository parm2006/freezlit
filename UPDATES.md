# Windows updates

Install `FreezlitSetup.exe` once, then use the **Update Freezlit** Desktop or Start Menu shortcut. `Update Freezlit.cmd` is an alternative launcher for the default installation. Choose **Download update**, close Freezlit normally so pending work is saved, then choose **Install and reopen**. The updater will refuse to install while this installation's study window is running. A failed connection or package verification leaves the current application available and can be retried.

The application is installed under `%LOCALAPPDATA%\FreezlitDesktop`. Decks remain under `%LOCALAPPDATA%\Freezlit`, outside the directory replaced by updates. The new setup replaces the existing Desktop/Start Menu app shortcuts; an old copy under `Programs\Freezlit` can remain unused. No library needs to be copied or deleted. Custom installation paths retain the normal Freezlit shortcut; run `current\Freezlit.exe --update` there to launch the updater.

Updates use [Velopack](https://docs.velopack.io/getting-started/python), pinned to the same version in Python requirements and `.config/dotnet-tools.json`. Its GitHub source checks recent public releases of `parm2006/freezlit` for matching Windows `releases.win.json` feeds, ignoring drafts and prereleases. Releases without a Windows feed are skipped, so a newer Mac-only release does not block Windows updates. The framework compares versions, verifies package hashes and size, downloads to staging, and runs its separate native helper after the updater window exits. The entire application directory is replaced, including `updater.py` and its interface. Velopack also refreshes the native `Update.exe` from the package. Upgrading the pinned framework version in a future release therefore updates that component too. Startup auto-apply is disabled so opening the study app does not unexpectedly install an update.

Releases are currently unsigned, as the existing app was. HTTPS plus package hashes detects damaged downloads; it does not provide independent publisher authentication if the release account is compromised. Authenticode signing requires a publisher signing identity, which is not configured in this repository. There is no automatic rollback of a user's library schema after launching a new app version; retain export backups when changing storage formats. macOS updates are unchanged.

## Build and publish

On Windows with Python 3.12 and .NET SDK 10:

```powershell
python -m pip install -r requirements-build.txt
dotnet tool restore
python build.py --updatable --output build/updatable --work build/updatable-work
python scripts/package-windows.py --app-dir build/updatable/Freezlit
python scripts/test-updater-package.py
```

The normal `python build.py` still builds the legacy standalone executable. Use `--updatable` for an installer/update package: Velopack requires PyInstaller's directory output.

Bump `package.json` and `package-lock.json` for each release. The Windows release workflow runs tests, builds the installer and feed, and creates a **draft** GitHub release for a matching `v<version>` tag. A manual workflow run produces downloadable artifacts without publishing a release. Review and publish the draft when ready. The regular Windows checks also build and test real update packages in an isolated portable installation with synthetic data; they do not install into the runner's user profile.

Every published Windows release used by the updater must include **all three**: `FreezlitSetup.exe`, `releases.win.json`, and `FreezlitDesktop-<version>-full.nupkg`. Include any generated delta packages and `SHA256SUMS-Windows.txt` as well. Publishing only the installer leaves existing updaters without an update package. Keep previous published releases as recovery downloads. Until an updater-enabled release is published, the updater reports no newer version; a draft is intentionally invisible to installed clients.

For a code-signed distribution, configure Velopack's documented signing options in the packaging command and supply the publisher certificate through the build environment. Never commit signing secrets.

## Checks

`tests/test_updater.py` covers offline retry, out-of-order and duplicate requests, download verification failure, and refusal to apply while a study session is open. `scripts/test-updater-package.py` builds a second version, updates a disposable portable installation with the real native helper, checks that updater UI files and `Update.exe` are refreshed, relaunches the app with the same synthetic library, and rejects a tampered package. It leaves its report under `build/updater-qa-*/report.json`. The automatic relaunch request is covered by the controller test; the package test starts the updated executable explicitly to keep test processes bounded.
