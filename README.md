# freezlit

A free Windows and Mac study app that keeps your cards, images, and progress on your computer. No account or subscription. Independently built around familiar Quizlet study modes and Anki-style scheduled recall.

## Windows install

Download **Freezlit-Windows-v1.1.zip** from [Releases](https://github.com/parm2006/freezlit/releases), extract it, then run **Install Freezlit.cmd**. It installs for your Windows user and adds Desktop and Start Menu shortcuts. No administrator access is needed. You can also run **Freezlit.exe** directly from the extracted folder.

**Python is bundled in Freezlit.exe; no Python or pip installation is needed to use the release.** Windows 10/11, 64-bit, with Microsoft Edge WebView2 Runtime is required. Most Windows installations already have it. If the app reports it missing, install the [Microsoft WebView2 Evergreen Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/). The executable is unsigned; Windows may show a reputation warning.

## Mac install

Download **Freezlit-macOS.dmg** or **Freezlit-macOS.zip** from the same release. Open the disk image and drag **Freezlit.app** to Applications, or extract the ZIP and move the app there. macOS 13 or later is required; the app is built for Apple Silicon and Intel. No Python, Node, or paid Apple Developer membership is needed to run it.

This build is ad-hoc signed for bundle integrity but is not Developer-ID signed or notarized. macOS may block the first launch. See [Apple’s instructions for opening an app from an unknown developer](https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac). The normal approval is made by the person using the Mac; no security settings are disabled by the app.

The native Mac app embeds the study interface and uses macOS files, save dialogs, and speech. It does not start Python or a local HTTP server. Its data is stored in `~/Library/Application Support/Freezlit/library.json`, with a previous copy. Export/import JSON moves study decks and progress between Windows and Mac; there is no automatic synchronization.

## Mac verification

GitHub’s macOS runner builds both processor architectures, runs native storage/bridge tests and the actual application, and captures test results and screenshots. The release uses the successful cloud build. These checks establish behavior on the tested cloud Mac, rather than on every Mac model. Build source and commands are documented in [macos/README.md](macos/README.md). iOS shares the JavaScript study logic in principle but is not included in this Mac release.

## Version 1.1

Fresh installations include only the **Active Recall** starter deck. Right-click a deck in the library and choose **Delete deck** to remove it. Keyboard users can focus a deck and press **Shift+F10**. Deletion asks for confirmation and also removes that deck’s saved tests and progress. Upgrades automatically retire the unchanged Spanish starter set shipped in older versions. Its original cards and progress remain archived inside the exported library; edited Spanish decks remain visible. Other decks can be removed through the library menu.

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

See [VERIFICATION.md](VERIFICATION.md) for tested behavior. The native Mac build uses `npm ci`, `npm run native:web`, XcodeGen and Xcode on macOS; Windows users can use the repository’s macOS GitHub Actions build. The study engine and starter/storage contracts are shared.

The source is MIT licensed. Bundled third-party runtime licenses are included with the release.
