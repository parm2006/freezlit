# freezlit

A free Windows study app that keeps your cards, images, and progress on your computer. No account or subscription. Independently built around familiar Quizlet study modes and Anki-style scheduled recall.

## Install

Download **Freezlit-Windows-v1.1.zip** from [Releases](https://github.com/parm2006/freezlit/releases), extract it, then run **Install Freezlit.cmd**. It installs for your Windows user and adds Desktop and Start Menu shortcuts. No administrator access is needed. You can also run **Freezlit.exe** directly from the extracted folder.

**Python is bundled in Freezlit.exe; no Python or pip installation is needed to use the release.** Windows 10/11, 64-bit, with Microsoft Edge WebView2 Runtime is required. Most Windows installations already have it. If the app reports it missing, install the [Microsoft WebView2 Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). The executable is unsigned; Windows may show a reputation warning.

## Version 1.1

Fresh installations include only the **Active Recall** starter deck. Right-click a deck in the library and choose **Delete deck** to remove it. Keyboard users can focus a deck and press **Shift+F10**. Deletion asks for confirmation and also removes that deck’s saved tests and progress. Upgrades preserve your existing library; older starter decks can be removed through this menu.

The interface, app window and executable use the splayed flashcard-deck icon.

Study screens use compact controls and omit the tagline, breadcrumb, local-only badge, save-status footer, deck-description line, End session control, and duplicate card list beneath the activity. Tests now produce the requested count: for example, 20 questions from 8 cards use shuffled repeat cycles. The active test, its question order, answers, grading settings and result persist when switching study-mode tabs or reloading; **New test** explicitly starts another test. Test setup remembers the selected count and question types per deck.

The editor's **Additional info (optional)** field adds readable prompt context in Flashcards, Spaced review, Write, Learn, Spell and Test. It can be left blank. It does not become part of the definition or required answer: a Kofun Period card can ask for `300-538` while showing separate context about burial mounds. Existing cards remain compatible.

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

**Answer with** selects definitions/backs or terms/fronts across every mode. **Starred only** narrows practice. Grading ignores case, common punctuation, and repeated spaces unless **Exact grading** is enabled. Put alternate textual answers between `|`, for example `USA | United States`. Tests require a textual answer; image-only answers work in flashcards, review, and self-rated practice.

## Your data

Saved under `%LOCALAPPDATA%\Freezlit\library.json`, with `library.previous.json` retained after each successful update. Images are embedded in the library. Export a full backup before moving computers or uninstalling. JSON imports add decks and preserve existing cards. Imported copies of existing deck IDs receive new IDs.

The application binds only to your computer's loopback interface, checks request origins, and uses atomic file replacement. No telemetry, accounts, external fonts, or hosted content. System speech voices may depend on internet connectivity. Total library limit: 100 MB; each uploaded image: 8 MB.

## Scope

Freezlit implements local study features; it does not cover full Quizlet/Anki parity. Scheduling is **SM-2-inspired**, with 1-minute and 10-minute learning steps; it is not FSRS. Games are local variants, particularly quiz Blocks and Charms. Pass & play uses one computer; network classroom play is not included. No Anki APKG import, synchronization, add-ons, arbitrary card templates, AI services, or hosted discovery. Cloze and rectangle masks generate ordinary cards rather than Anki-native notes. [FEATURES.md](FEATURES.md) records official references and coverage limits. No proprietary app was decompiled.

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
