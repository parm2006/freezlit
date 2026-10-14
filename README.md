# freezlit

A free Windows study app that keeps your cards, images, and progress on your computer. No account or subscription. Independently built around familiar Quizlet study modes and Anki-style scheduled recall.

## Install

Download **Freezlit-Windows.zip** from [Releases](https://github.com/parm2006/freezlit/releases), extract it, then run **Install Freezlit.cmd**. It installs for your Windows user and adds Desktop and Start Menu shortcuts. No administrator access is needed. You can also run **Freezlit.exe** directly from the extracted folder.

Windows 10/11, 64-bit, with Microsoft Edge WebView2 Runtime is required. Most Windows installations already have it. If the app reports it missing, install the [Microsoft WebView2 Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). The executable is unsigned; Windows may show a reputation warning.

## Study your way

- **Flashcards:** flip, shuffle, autoplay, listen, star, and choose either card direction.
- **Spaced review:** Again / Hard / Good / Easy, preview intervals, daily limits, bury, suspend, and independent forward/reverse progress.
- **Learn:** choices followed by written recall; each card must be recalled twice. Misses return.
- **Write and Spell:** typed answers, correction, retry missed cards; Spell uses available system voices.
- **Test:** customize count and multiple choice, written, true/false, and matching questions; grade, accept your own answer, and practice mistakes.
- **Games:** timed Match, Falling words, Quick quiz, quiz Blocks, match-three Charms, and shared-device Pass & play.
- **Authoring:** text and images on both sides, notes, tags, stars, generated cloze cards, and rectangular image occlusion cards.
- **Portability:** CSV/TSV/TXT import, Quizlet tab-separated paste, and JSON export/import including images and progress.

To make a deck, use the **+** beside Your library. Images can be added independently to either side. In the editor, the cloze tool generates cards from a passage such as `The {{mitochondria}} produce {{ATP}}.` The image occlusion tool lets you drag a rectangle over a diagram label and type its answer.

**Answer with** selects definitions/backs or terms/fronts across every mode. **Starred only** narrows practice. Grading ignores case, common punctuation, and repeated spaces unless **Exact grading** is enabled. Put alternate textual answers between `|`, for example `USA | United States`. Tests require a textual answer; image-only answers work in flashcards, review, and self-rated practice.

## Your data

Saved under `%LOCALAPPDATA%\Freezlit\library.json`, with `library.previous.json` retained after each successful update. Images are embedded in the library. Export a full backup before moving computers or uninstalling. JSON imports add decks and preserve existing cards. Imported copies of existing deck IDs receive new IDs.

The application binds only to your computer's loopback interface, checks request origins, and uses atomic file replacement. No telemetry, accounts, external fonts, or hosted content. System speech voices may depend on internet connectivity. Total library limit: 100 MB; each uploaded image: 8 MB.

## Scope

This is a working first release, not full Quizlet/Anki parity. Scheduling is **SM-2-inspired**, with 1-minute and 10-minute learning steps; it is not FSRS. Games are local variants, particularly quiz Blocks and Charms. Pass & play uses one computer; network classroom play is not included. No Anki APKG import, synchronization, add-ons, arbitrary card templates, AI services, or hosted discovery. Cloze and rectangle masks generate ordinary cards rather than Anki-native notes. [FEATURES.md](FEATURES.md) records official references and coverage limits. No proprietary app was decompiled.

## Run from source

Python 3.10+ and WebView2 on Windows:

```powershell
python -m pip install -r requirements.txt
python server.py
```

The app opens in its own desktop window. A headless local-server mode for development is available with `python server.py --no-browser --port 8765`. `FREEZLIT_DATA_DIR` can select an isolated storage directory. Source can also run with pywebview's platform prerequisites on macOS/Linux; the packaged release is tested on Windows only.

## Build and test

```powershell
python -m pip install -r requirements-build.txt
python build.py --output dist --work build
python -m unittest discover -s tests -p "test_*.py"
node tests/test_engine.mjs
```

See [VERIFICATION.md](VERIFICATION.md) for tested behavior. The source is MIT licensed. Bundled third-party runtime licenses are included with the release.
