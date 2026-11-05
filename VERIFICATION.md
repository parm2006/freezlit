# Verification — v1.1



Source and release checks on October 14, 2026. All checks used isolated data.



- **9 local runtime tests passed** again for v1.1, covering persistence, backups, request validation and storage limits.

- **33 engine tests passed:** the original scheduling/import checks plus exact requested test counts, shuffled repeat cycles, unique question IDs, cycle-boundary repeat avoidance, single-card decks, direction-specific image filtering, invalid counts, and optional additional-information validation. The Kofun Period regression preserves burial-mound context while grading only `300-538`, including strict grading and reverse direction.

- **Browser regressions passed:** 20 questions from an 8-card deck; all four test input types; switching among ten study-mode tabs without losing the test; reload persistence; answer/score persistence; explicit New test generation with 3 questions; additional-information editing, prompt display and answer-only grading. These browser results were supplied by the implementation check, distinct from the independent engine run.

- **Independent visual review found no material blockers:** updated desktop and narrow screenshots remove the user-rejected interface text, deck description, End session control and duplicate card list. Write displays additional prompt context above its answer field. The sidebar create action remains available at narrow widths. The layout keeps the existing basic, pleasant desktop direction.



The following records describe the previously verified v1.0.0 release. Version 1.1 packaging checks are recorded separately below.



## Previously released v1.0.0



Tested on Windows on October 14, 2026. Test data was isolated from the user's library.



- **24 engine tests passed:** learning/graduation/lapse intervals, bounded scheduling, independent directions, daily card limits, exclusion of ordinary practice from review limits, due-learning handling, suspension/burying, grading, test generation, quoted CSV/TSV, and imported-data validation.

- **9 local runtime tests passed:** JSON persistence, retained previous copy, schema preservation, request origin/Host checks, path traversal rejection, body-size limits, and security headers.

- **Browser interaction checks passed for all 12 modes:** Flashcards, Spaced review, Learn, Write, Spell, Test, Match, Falling words, Quick quiz, Blocks, Charms, and Pass & play. No browser JavaScript errors observed.

- **Authoring checks passed:** Unicode text, image attachment, saved images after reload, generated cloze cards, rectangle-masked image cards, and written-practice completion.

- **Native Windows WebView2 integration passed:** card flip/navigation/reverse, persistent scheduled review, mode launching, mixed test generation/grading, editor image upload, restart persistence, and full JSON backup export through the native save handler. The automated export test substituted the human file-dialog selection and verified the exported file contents.

- **Layout inspected:** 1360px desktop and 600px/390px narrow widths, without document overflow. Keyboard image uploads, focused-button Space activation, and narrow create-deck access corrected after independent review.

- **Packaged executable passed:** isolated headless startup, all four bundled frontend assets matched their source bytes, and embedded image/Unicode text saved to local JSON.

- **Frozen native executable passed:** the packaged app opened its own 1180 × 800 WindowsForms/WebView2 window, ran its bundled frontend, created the starter library locally, and closed normally. No separate Python installation was used to launch the executable.



Packaging verification and artifact checksums are supplied with the release. These checks do not establish full Quizlet/Anki compatibility, universal Windows hardware compatibility, offline availability of every installed speech voice, or network classroom support.



## Version 1.1 library and icon checks



- Fresh isolated launch creates exactly one eight-card Active Recall deck.

- Right-click and Shift+F10 open the deck deletion menu; Escape dismisses it.

- Cancelled deletion leaves the deck intact. Confirmed deletion removes the selected deck, its history, saved test/configuration and game records; changes survive reload.

- Deleting the last deck leaves an empty library after restart; starter cards are not reintroduced.

- Authored flashcard SVG/favicon and Windows ICO cover 16, 24, 32, 48, 64, 128 and 256 pixel sizes. Native and executable icon packaging is verified during the release build.



All browser deletion checks used isolated test data.



## Version 1.1 packaged executable checks



- Isolated headless startup passed; all five frontend assets, including the new SVG favicon, matched the source bytes exactly.

- Unicode text and embedded image data saved successfully in an isolated local library.

- The frozen executable opened its own 1180 × 800 native WindowsForms/WebView2 window, ran the frontend, created only the Active Recall starter deck, and closed normally.

- The native window icon pixels matched the source ICO through the Windows icon-handle rendering path.

- The bundled ICO matched the source bytes; all seven executable icon-resource resolutions matched the source image frames.

- Python is embedded in the executable. These launch checks did not use a separate Python installation to run Freezlit.exe. Microsoft Edge WebView2 Runtime remains a system prerequisite.

- Release ZIP integrity and SHA-256 checksums were verified; earlier release and candidate archives were preserved.


## Corrected 1.1: legacy starter cleanup and Mac port

- 59 JavaScript contract tests pass: 33 study engine, 10 starter/migration, 16 native/Windows storage adapter.
- Desktop browser checks verify old Spanish default retirement with archived progress, idempotent restart, preservation of authored Spanish decks, and 20-question test persistence after the shared-storage refactor.
- Native Mac build/runtime evidence is supplied by the macOS CI workflow and attached artifacts. Windows browser tests do not establish macOS runtime behavior.

## Corrected 1.1 native Mac verification result

[Successful native macOS workflow](https://github.com/parm2006/freezlit/actions/runs/38609075619), app source commit `d09929458735c2f8c7b81cab07b2098f52b0f743`.

- Eight native tests passed, zero failed or skipped, on ARM64 macOS 15.7.9: six local-store tests, one WKWebView bridge test, and one native GUI test.
- The release executable contains both `x86_64` and `arm64` slices; its ad-hoc bundle signature passed verification. Intel was compiled, not executed on an Intel host.
- The actual release app launched with isolated data and verified one eight-card Active Recall starter deck, flashcard reveal, editor image/additional-info persistence, exactly 20 test questions, tab/grading/reload persistence, native JSON export, speech cancellation, and blocked outbound navigation.
- Desktop and narrow snapshots from the actual native app were inspected. `native-proof.json` reports all seven runtime checks passed. The automated export check substitutes only the destination so no interactive save-panel approval is needed during CI.
- Mac ZIP integrity and SHA-256 values were checked after download. The packaged app includes the native executable, local study bundle, flashcard icon and licenses.
- The corrected frozen Windows executable matches all seven current web assets; startup, legacy Spanish retirement with archived progress, preservation of edited decks, Unicode/images, icon and ZIP checks passed. Python remains bundled; WebView2 is a Windows system prerequisite.

These checks do not establish runtime behavior on Intel hardware, every macOS version, or a physical Mac owned by the user. The app is not Developer ID signed or notarized.

## Version 1.2 checks

- 61 shared JavaScript tests pass (35 engine, 10 starter, 16 storage), including all-whitespace/case normalization, strict grading, and accepted test answers preserving original input.
- Nine Windows server tests pass.
- Isolated desktop browser checks use a fixed random source to verify shuffled review order, no repeated review cards, daily new-card limits and normal schedule updates.
- Wrong-answer overrides are checked in Write, Spell, Blocks, Charms and Falling words: a single attempt and history entry becomes correct, with mode progress updated. Learn preserves mastery earned before the typo; a last-life Falling words answer can be corrected before ending the round.
- Normal grading accepts `19-1 2` for `19-12`; Exact grading rejects a changed internal space.
- Test correction preserves the original typed answer, corrects the existing saved history entry, and persists the corrected score across tabs and reloads.
- The Mac release workflow runs the actual native app with additional checks for Write correction and accepted Test persistence. Release workflow results determine native build/runtime status.

Browser and native diagnostics use isolated data rather than the user's library.

Version 1.2 keyboard check: letters, numbers, Space, Enter and arrow keys advance after correct feedback exactly once. Wrong feedback does not advance on a letter; Tab, modifier/system shortcuts, composing input and held-key repeats retain their behavior. The native Mac diagnostic also checks normal-key advancement.

Version 1.2 removes the old demo card content and fixtures from the current source. Exact old-stock recognition uses a SHA-256 fingerprint; cleanup deletes matching stock and its linked history/tests/records plus known retired demo archives. Custom content is preserved. The migration saves the cleaned library twice so the automatic previous copy is also cleaned. Earlier verification paragraphs describe historical releases.

## 2026-11-05 — isolated incremental storage and thumbnail verification

Implemented in `codex/freezlitclone`, independently of the installed application and live data. Tests used generated screenshots and a synthetic 60-card Japanese Periods fixture.

- `npm test`: 42 engine + 10 starter-data + 29 storage tests passed.
- Python discovery: 22 tests passed, covering legacy/v2 migration, original and preview files, draft/previous-state retention, cleanup grace, stale writers, missing references, close-save handling and existing HTTP safety.
- Headless Microsoft Edge: browser scenarios passed for five-second continuous-typing saves, pause and field-exit flushes, idle no-op, thumbnails, full-resolution preview, flashcard thumbnail clicks, clipboard PNG paste, upload, single-deck export and reimport with five original images, draft recovery, one-sided cards, empty-new-card filtering, Back, reload and narrow layout. No page errors; no long tasks over 50 ms during the synthetic typing segment. After the initial recovery snapshot, typing-save requests measured 655–689 bytes.
- `FreezlitClone.exe`: PyInstaller build passed; packaged local-service smoke test verified retained legacy JSON, original SHA-256, WebP thumbnail delivery, a 338-byte changed-card save, matching packaged assets, and restart persistence.
- Desktop interactive smoke test was limited by a computer-use app-launch approval timeout. Native spelling popup and immediate close after a real OS clipboard paste remain manual checks; they are not claimed as verified.

Proof files are retained under `build/clone-verification/`. Temporary clone data and its executable are disposable test artifacts, not production backups. No production build or live-library migration was performed. The user's approval is still required before rebuilding/installing the main app.


## v1.4.0 publication and local upgrade — 2026-11-05

Published [v1.4.0](https://github.com/parm2006/freezlit/releases/tag/v1.4.0) from `29253bc59c53b71d5313bc556ea7553ea33ace84` after explicit approval. Windows CI [42101609741](https://github.com/parm2006/freezlit/actions/runs/42101609741) passed on that commit; Mac CI [42101228864](https://github.com/parm2006/freezlit/actions/runs/42101228864) passed on `6eb9a80`, whose native Mac sources, shared UI and version metadata are identical. Local checks: 42 engine, 10 starter-data, 29 storage and 23 Python tests (104 total), plus packaged Windows migration/save/restart smoke checks.

Release ZIP contents matched the tested executable and contained no private library data. Published asset digests were checked before installing. The installed executable SHA-256 is `c00a28ca93e048fc3eeb028ba10bae1863ab3ff3b4f0361837ae09e7324cc1c8`. A private copy of the existing library passed full metadata comparison, original-image byte checks and frontend validation before the live upgrade. The installed app then answered `/api/state`, retained its deck/card/draft/image totals, and opened a native window. Original JSON and a complete pre-update folder/executable backup were retained. Private backup location is recorded locally in `build/v1.4.0/backup-path.txt`.

Real typing feel, the native spelling popup and immediate close following a real OS screenshot paste remain manual checks; no automated editing was performed on the live user's cards.
