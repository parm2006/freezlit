# Windows storage and image previews

The Windows edition stores its current library in `library.sqlite3`, with immutable original images in `images/` and compressed WebP previews in `thumbnails/`. Cards, editor drafts and saved tests reference originals by a SHA-256 identifier. Normal card views request only previews (at most 480 × 480); clicking or keyboard-activating a preview opens the original. Closing the preview removes the original from the page.

Only changed records are sent to the local service. A text edit updates its card record and recovery-draft metadata. Autosave runs after an 800 ms pause, at most five seconds after typing starts without a pause, and on leaving an editor field. Explicit saves and normal native close flush pending work, including image uploads. Opening a field alone does not create edits; unchanged saves produce no database update. The UI reports failed saves and keeps dirty changes available for retry/export.

## Migration and recovery

On first use, the service converts a version 1 or 2 JSON library to image files and SQLite records. Original and preview files must be written successfully and references checked before the migration commits. The original `library.json` is retained unchanged. Unsupported future formats or invalid images fail without replacing it; partially prepared images are harmless unreferenced files.

SQLite transactions commit each set of edits together, using WAL and synchronous writes. A stale revision is rejected rather than overwriting another window's edits. The `previous_records` table retains the preceding committed state. Image collection retains references in both current and previous records, including unfinished editor drafts and test drafts. Unreferenced images also receive a seven-day grace period for interrupted/pending uploads. Collection runs when the library is opened, serialized with uploads and saves.

To back up the internal data folder, close the app first, then copy the entire folder (database, any SQLite sidecars, originals and thumbnails). The retained JSON is the pre-migration copy, not a continuously updated backup. Use Export library for a portable current backup.

## Portable files

Deck exports include only that deck and its referenced original images. Full-library exports also include images referenced by editor and test drafts. Export resolves references and embeds each original once in the existing version 2 JSON media table; missing originals fail the export instead of silently creating an incomplete file. Thumbnails are not substituted for originals. Reimport regenerates previews and stores the originals before rendering the imported cards. Existing JSON exports remain supported.

The native Swift macOS edition retains its existing storage bridge; this SQLite/file migration applies to the Windows/local-service edition. It does not migrate a native Mac library.

## Isolated verification

`build.py --name FreezlitClone` creates only `FreezlitClone.exe`. That executable uses an ephemeral port by default and a `clone-data` directory beside itself, never the production directory or legacy automatic migration paths. `FREEZLIT_CLONE_DATA_DIR` can override only the clone directory for tests.

- JavaScript checks: `npm test`.
- Python checks: install `requirements.txt`, then `python -m unittest discover -s tests -p "test_*.py"`.
- Browser scenarios: `npm install`; set `FREEZLIT_TEST_PYTHON` to a Python executable with Pillow, then run `npm run test:ui`. Uses installed Microsoft Edge, a randomly assigned local port, and synthetic data in `build/qa-data` only.
- Packaged clone: after building into `build/clone-dist`, run `python scripts/test-packaged-clone.py`. Tests migration, original bytes, thumbnails, changed-card persistence, packaged assets and restart recovery using a separate synthetic directory.

Remaining limit: portable JSON export still gathers originals in memory, and saving compares all metadata records to find changes. Ordinary edits never load originals or serialize image bytes; the app has not moved portable export to streaming archives. Close guards cannot protect against OS termination or power loss before an autosave has committed.

Save requests carry unique IDs. SQLite retains the latest 4096 operation receipts so retrying a committed save after a lost response acknowledges the original operation without applying it again. The client retries that exact request before saving newer edits, and accepts the confirmed revision from the response body if the header is unavailable. Different changes still require the current revision; receipts do not bypass another window's edits.
