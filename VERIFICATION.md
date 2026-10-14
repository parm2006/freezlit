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
- The frozen executable opened its own 1180 � 800 native WindowsForms/WebView2 window, ran the frontend, created only the Active Recall starter deck, and closed normally.
- The native window icon pixels matched the source ICO through the Windows icon-handle rendering path.
- The bundled ICO matched the source bytes; all seven executable icon-resource resolutions matched the source image frames.
- Python is embedded in the executable. These launch checks did not use a separate Python installation to run Freezlit.exe. Microsoft Edge WebView2 Runtime remains a system prerequisite.
- Release ZIP integrity and SHA-256 checksums were verified; earlier release and candidate archives were preserved.
