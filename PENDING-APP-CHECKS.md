# Pending rebuild and app checks — November 5, 2026

Source changes are ready. The running installed app has not been replaced or restarted. Manual checks below remain pending until a new Windows executable is built and opened. Use a temporary test deck for card-editing checks.

## After rebuilding

- [ ] Export deck appears beside Edit deck with a visible button style. Export contains only the selected deck; import that JSON into an isolated library and check text and images. Export library still exports everything.
- [ ] Library plus → New deck → Back returns to the previous deck. Entered draft content can be resumed. Also check Back in an existing deck and Back to editor from both authoring tools.
- [ ] Save cards with only front text, only back text, only an image, or one blank side. Reopen and confirm unused fields remain blank.
- [ ] Add completely empty new cards, including whitespace-only cards; save and confirm they are stripped. Notes-only, additional-info-only, tagged, starred, suspended and existing cards are retained. Saving a deck containing only blank new cards leaves an empty deck.
- [ ] Right-click a red-underlined misspelling in the Windows editor: native spelling suggestions appear, selecting one replaces the word, and Cut/Copy/Paste work. Deck-list right-click actions still work.
- [ ] Type continuously and with short pauses in Japanese Periods, then in an image-heavy test deck. Characters should appear smoothly without bursts. Check title, description, term, definition, notes, additional info and tags.
- [ ] Type test answers in a deck containing images; confirm smooth typing and correct saved answers after returning to the test.
- [ ] Paste an image while typing; confirm it attaches to the intended card, then save immediately and reopen. Scroll image-heavy editors and confirm previews appear. Original images should remain intact.
- [ ] Type edits, wait for Saved on this device, leave and resume the editor, then restart the app and confirm the latest text persists. Also check immediate Save deck after typing and closing with pending changes.

## Automated evidence

- JavaScript engine, starter-data and storage suites passed after the changes, including 25 storage tests.
- Regression checks cover live draft persistence without image cloning, independent encoded snapshots, saved test answers, blank-side validation and empty-new-card filtering.
- All 13 Python tests passed for the Windows spelling-menu change; its test verifies UI-thread dispatch and that enabling menus does not enable developer tools.
- Synthetic Node benchmark, not a measurement of the user's library: 40 cards referencing a 256 KiB image on both sides, 30 edits. Old draft-copy path: 763.89 ms total; new draft updates: 0.26 ms total; new library encoding: 2.75 ms with one deduplicated image.

## Implementation notes

Typing no longer clones an entire image-filled editor draft on each key. Test-answer snapshots copy question records without cloning image strings. Save encoding replaces images with references before cloning and validates each unique image once per save. Editor previews use lazy loading and asynchronous decoding. Autosave waits for an 800 ms typing pause; explicit save/flush still writes immediately. Storage remains the existing JSON format; there is no image-quality reduction or database migration.

Full-library JSON serialization still happens during autosave. If rebuilt-app typing remains slow, profile a representative isolated deck before adding a worker or changing storage. No performance claim about the running installed app has been verified yet.
