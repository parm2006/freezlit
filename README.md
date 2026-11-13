# freezlit

A free Windows study app that keeps your cards, images, and progress on your computer. No account or subscription. Independently built around familiar Quizlet study modes and Anki-style scheduled recall.

## Windows install

Close Freezlit, then download **FreezlitSetup.exe** from [Releases](https://github.com/parm2006/freezlit/releases/latest) and run it once. It installs for your Windows user and adds **Freezlit** and **Update Freezlit** shortcuts to your Desktop and Start Menu. No administrator access is needed. Existing decks, images and progress are preserved. This new installer replaces the old copy-based installation; older releases need this one-time installation before they can update themselves.

After that, open **Update Freezlit**, download the available update, close the study window, and choose **Install and reopen**. Both Freezlit and its updater are updated together. No repeated installer download is needed. Updates are checked only when you run the updater. See [UPDATES.md](UPDATES.md) for release publishing, verification and troubleshooting. The standalone one-file executable remains available for portable use, but needs the new installer to enable this update flow.

**Python is bundled in Freezlit.exe; no Python or pip installation is needed to use the release.** Windows 10/11, 64-bit, with Microsoft Edge WebView2 Runtime is required. Most Windows installations already have it. If the app reports it missing, install the [Microsoft WebView2 Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). The executable is unsigned; Windows may show a reputation warning.

## Supported platform

Windows is the only supported platform. macOS and Linux builds, testing, and releases are discontinued. Older Mac downloads and source are historical and unsupported.

## New in 1.3.3

Quizlet text import with literal quotes and Unicode preserved; clipboard image paste; safer saves, recoverable editor/test drafts, and clearer library compatibility messages. Windows also recovers an existing previous or legacy Recall library when the default library is missing.

## Import cards

Export your Quizlet set as text with tabs between terms and definitions and new lines between cards. In Freezlit, open **Import cards**, name the deck, select **Quizlet export (tab + new line)**, paste, and choose **Create deck from text**. This adds a new deck and keeps existing decks, drafts and study progress.

[Quizlet exports text only](https://help.quizlet.com/hc/en-us/articles/360034345672-Exporting-your-sets), without images. Add your own images in the editor. CSV, TSV and TXT imports also support an optional notes column and quoted multiline fields. Use a JSON backup to transfer Freezlit images and progress.

## Add images

Create or edit a deck, click a card’s **term or definition** field, and paste an image or screenshot with **Ctrl+V** / **Command+V**. The image attaches to that side; save the deck when finished. You can also use the image file picker.

Bitmap and embedded clipboard images are supported. An unreadable paste leaves the existing image intact. Each image is limited to 8 MB and is included in JSON backups.

## Study your way

- **Flashcards:** flip, shuffle, autoplay, listen, star, and choose either card direction.
- **Spaced review:** Again / Hard / Good / Easy, preview intervals, daily limits, bury, suspend, and independent forward/reverse progress.
- **Learn:** choices followed by written recall; each card must be recalled twice. Misses return.
- **Write and Spell:** typed answers, correction, retry missed cards; Spell uses available system voices.
- **Test:** request an exact question count, including more questions than the deck has cards; multiple choice, written, true/false, and matching questions; grade, accept your own answer, and practice mistakes. Larger tests repeat cards in shuffled cycles.
- **Games:** timed Match, Falling words, Quick quiz, quiz Blocks, match-three Charms, and shared-device Pass & play.
- **Authoring:** text and images on both sides, optional additional prompt information, notes, tags, stars, generated cloze cards, and rectangular image occlusion cards.
- **Portability:** CSV/TSV/TXT import, Quizlet tab-separated paste, and JSON export/import including images and progress.

To make a deck, use the **+** beside Your library. Images can be added independently to either side. In the editor, the cloze tool generates cards from a passage such as `The {{mitochondria}} produce {{ATP}}.` The image occlusion tool lets you drag a rectangle over a diagram label and type its answer.

**Answer with** selects definitions/backs or terms/fronts across every mode. **Starred only** narrows practice. Grading ignores case, common punctuation, and all whitespace unless **Exact grading** is enabled. Put alternate textual answers between `|`, for example `USA | United States`. Tests require a textual answer; image-only answers work in flashcards, review, and self-rated practice.

## Your data

The Windows source edition saves under `%LOCALAPPDATA%\Freezlit`: `library.sqlite3` holds changed records, `images/` holds originals, and `thumbnails/` holds compressed previews. Existing JSON libraries are migrated safely while their original file is retained; the previous committed state is retained in SQLite. Older installed releases continue using their existing JSON storage until rebuilt and updated. See [STORAGE.md](STORAGE.md) for migration, backup and recovery details. Export a full backup before moving computers or uninstalling. JSON imports add decks and preserve existing cards. Imported copies of existing deck IDs receive new IDs.

The Windows application binds only to your computer's loopback interface and checks request origins. Saves use atomic file replacement. No telemetry, accounts, external fonts, or hosted content. System speech voices may depend on internet connectivity. Total library limit: 100 MB; each uploaded image: 8 MB.

## Scope

Freezlit implements local study features; it does not cover full Quizlet/Anki parity. Scheduling is **SM-2-inspired**, with 1-minute and 10-minute learning steps; it is not FSRS. Games are local variants, particularly quiz Blocks and Charms. Pass & play uses one computer; network classroom play is not included. No Anki APKG import, synchronization, add-ons, arbitrary card templates, AI services, or hosted discovery. Cloze and rectangle masks generate ordinary cards rather than Anki-native notes. [FEATURES.md](FEATURES.md) records official references and coverage limits. No proprietary app was decompiled.

## Run from source

Python 3.10+ and WebView2 on Windows:

```powershell
python -m pip install -r requirements.txt
python server.py
```

The app opens in its own desktop window. A headless local-server mode for development is available with `python server.py --no-browser --port 8765`. `FREEZLIT_DATA_DIR` can select an isolated storage directory. Only Windows is supported and tested.

## Build and test

```powershell
python -m pip install -r requirements-build.txt
python build.py --output dist --work build
python -m unittest discover -s tests -p "test_*.py"
npm ci
npm test
```

See [VERIFICATION.md](VERIFICATION.md) for tested behavior. Automatic build and verification workflows target Windows only.

The source is MIT licensed. Bundled third-party runtime licenses are included with the release.
