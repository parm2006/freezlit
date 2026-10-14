# Verification — v1.0.0

Tested on Windows on October 14, 2026. Test data was isolated from the user's library.

- **24 engine tests passed:** learning/graduation/lapse intervals, bounded scheduling, independent directions, daily card limits, exclusion of ordinary practice from review limits, due-learning handling, suspension/burying, grading, test generation, quoted CSV/TSV, and imported-data validation.
- **9 local runtime tests passed:** JSON persistence, retained previous copy, schema preservation, request origin/Host checks, path traversal rejection, body-size limits, and security headers.
- **Browser interaction checks passed for all 12 modes:** Flashcards, Spaced review, Learn, Write, Spell, Test, Match, Falling words, Quick quiz, Blocks, Charms, and Pass & play. No browser JavaScript errors observed.
- **Authoring checks passed:** Unicode text, image attachment, saved images after reload, generated cloze cards, rectangle-masked image cards, and written-practice completion.
- **Native Windows WebView2 integration passed:** card flip/navigation/reverse, persistent scheduled review, mode launching, mixed test generation/grading, editor image upload, restart persistence, and full JSON backup export through the native save handler. The automated export test substituted the human file-dialog selection and verified the exported file contents.
- **Layout inspected:** 1360px desktop and 600px/390px narrow widths, without document overflow. Keyboard image uploads, focused-button Space activation, and narrow create-deck access corrected after independent review.

Packaging verification and artifact checksums are supplied with the release. These checks do not establish full Quizlet/Anki compatibility, universal Windows hardware compatibility, offline availability of every installed speech voice, or network classroom support.
