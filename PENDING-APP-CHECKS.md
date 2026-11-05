# App checks — November 5, 2026

The source has been tested in an isolated FreezlitClone worktree with synthetic data. The production executable has not been rebuilt, replaced or restarted, and the live library has not been migrated. Rebuilding/installing the production app requires the user's explicit approval.

## Automated checks completed

- [x] Export deck beside Edit deck; export contains one deck with all referenced original images, and re-import restores them.
- [x] New-deck Back returns to the deck view and drafts can be resumed.
- [x] One-sided cards save with blank unused fields; completely empty new cards are stripped. Metadata-only cards and existing cards are preserved by regression tests.
- [x] Separate original image files and compressed WebP thumbnails; image views use thumbnails until clicked. Original preview closes and releases its DOM reference; clicking a flashcard image does not flip the card.
- [x] Migration retains the original JSON, checks references, and commits atomically. Invalid images and unsupported future formats do not initialize a replacement library.
- [x] Draft/test images and the previous saved state survive cleanup. Unreferenced uploads receive a seven-day grace period.
- [x] Text edits send changed records rather than the full library. Continuous typing saves at a five-second deadline; pause/field-exit saves happen sooner. No idle writes.
- [x] Synthetic 60-card image-heavy Japanese Periods browser scenarios: typing, clipboard image paste, upload, draft recovery, export/reimport, preview, reload and 760px layout.
- [x] Separate FreezlitClone.exe was built and its packaged local service passed migration, original SHA-256, thumbnail, changed-card save, bundled-asset and restart checks.
- [x] Native close guard unit tests: successful saves close, failed saves keep the window open, and an unresponsive renderer permits an explicit close-anyway confirmation.

## Still requires a rebuilt production app and manual check

- [ ] Smooth typing in the user's actual Japanese Periods deck and other real image-heavy decks.
- [ ] Native spelling suggestions: right-click an underlined misspelling and choose a correction. The Windows menu configuration has a passing unit test; the computer-use native clone launch approval timed out, so the popup is not manually verified.
- [ ] Immediate native close after a real OS screenshot paste, then restart and verify the latest draft/image. Browser paste/flush and native close behavior have separate automated coverage.
- [ ] Review the imported/migrated real library, including images, study progress and unfinished drafts, before treating the update as production-verified.

## Evidence and limits

JavaScript: 42 engine, 10 starter-data and 29 storage tests passed. Python: 22 tests passed. Browser and packaged-clone reports are retained in `build/clone-verification/` after removing the temporary clone.

In the synthetic typing run, changed-card requests were about 650–700 bytes after the initial recovery snapshot; no typing tasks exceeded 50 ms. This is not a measurement of the live user library and does not prove that every out-of-memory case is fixed.

See STORAGE.md for the current storage format, migration, cleanup, backups and remaining limits. Portable JSON exports still gather original images in memory. Keep full data-folder backups while the app is closed; the retained legacy JSON is a pre-migration copy, not a current backup.
