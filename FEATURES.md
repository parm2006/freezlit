# Recall feature research and scope

Research date: October 14, 2026. This is a public-documentation evidence ledger and implementation checklist. It records documented behavior, proposed local equivalents, and gaps. It is not proof that every checklist item is implemented; use the app's README and verification results for delivered coverage.

## Evidence boundary

The requested reverse-engineer-anything skill was read. Its workflow requires observations, inferences, and unknowns to remain distinct. No supplied Quizlet binary, application package, authenticated session, or Anki build was decompiled in this research. No proprietary source, algorithms, network protocol, or full feature parity was established. Public official help pages were used to guide an independently written local application. Some Quizlet marketing pages returned HTTP 403; their search excerpts are identified below.

## Core local app checklist

| Feature | Official documented behavior | Local implementation target |
|---|---|---|
| Flashcards | Flip, navigate, shuffle, autoplay, sort into learning/known groups, choose which side appears first, audio. [Quizlet Flashcards](https://help.quizlet.com/hc/en-ca/articles/360030988091-Studying-with-Flashcards) | Manual flip, shuffle, keyboard controls, term/definition/both orientation, optional browser speech and known/learning sorting. |
| Long-term review | Anki separates new, learning, review, and relearning cards. [Anki basics](https://docs.ankiweb.net/manual/getting-started) | Persist due dates and review history; schedule due cards ahead of optional practice. |
| Recall ratings | Show answer, then Again/Hard/Good/Easy with next review time. Hard means recalled with difficulty; forgotten answers use Again. [Anki studying](https://docs.ankiweb.net/manual/studying) | Four honest recall ratings, interval previews, immediate relearning, keyboard shortcuts. |
| Scheduling | FSRS is an alternative to legacy SM-2; desired retention balances workload and recall. Optimization uses review history. [Anki deck options](https://docs.ankiweb.net/deck-options.html) | Clearly identify the actual scheduler. A simple SM-2-inspired scheduler must not be called FSRS or an exact Anki implementation. |
| Learn | Goal/familiarity-based path; term/definition direction, starred-only, shuffle, included question types, missed-answer retyping. [Quizlet Learn](https://help.quizlet.com/hc/en-us/articles/360030986971-Studying-with-Learn) | Mix recognition and written recall; retry mistakes; track local mastery. Explain the rule-based progression instead of claiming Quizlet's machine learning. |
| Write | Typed responses; later rounds emphasize misses; a full round requires two correct answers per item; manual correctness override. [Quizlet Write](https://help.quizlet.com/hc/en-us/articles/360030990531-Studying-with-Write-mode) | Dedicated written recall with correction and retry; usable with either card direction. |
| Spell | Hear a term/definition, type it, retry mistakes; two correct spellings finish an item. [Quizlet Spell](https://help.quizlet.com/hc/en-us/articles/360030645752-Studying-with-Spell-mode) | Speech prompt and written response when installed browser/OS voices are available. Offline voice support depends on the device. |
| Test | Choose count/types, submit, review score, print; starred-only option. [Quizlet Test](https://help.quizlet.com/hc/en-us/articles/360030642972-Studying-with-Test-mode/) | Configurable multiple choice, written, true/false and matching; scored review and missed-question retry; printable results. |
| Grading | Quizlet has strict, moderate and semantic relaxed grading; single-answer grading can accept one of several supplied answers. [Quizlet grading](https://help.quizlet.com/hc/en-us/articles/360048313652-Using-grading-options-US) | Local normalization and explicit alternate answers, optional manual override. String similarity is not equivalent to semantic/NLP grading. |
| Match | Timed pairing; six pairs per round; incorrect match adds one second. [Quizlet Match](https://help.quizlet.com/hc/en-us/articles/360031183611-Playing-Match) | Timed local term/definition or image/text pairing; local best score. |
| Text and images | Anki provides basic, reverse, typed-answer, cloze, and image-occlusion note types. [Anki note types](https://docs.ankiweb.net/manual/getting-started) | Text and locally imported images on either side, sensible image fitting and accessible text; reversible study direction. |
| Cloze and occlusion | Anki hides text spans; native image occlusion supports rectangle, ellipse, polygon and grouped areas. [Anki editing](https://docs.ankiweb.net/editing.html) | Cloze syntax and simple rectangle masks are useful extensions; disclose the narrower image editor if those are the only supported shapes. |
| Local portability | Independent product choice, not an inference about Quizlet. | No required account; local data and image persistence; export/import backup including media; install or launch instructions for another person. |

## Documented games beyond Match

- **Blast:** Match answers on moving asteroids; documented classroom settings include speed, answer choices and duration. A single-player page also exists. A locally written asteroid challenge can cover the practice mechanic, but does not establish classroom/multiplayer parity. [Quizlet classroom Blast](https://help.quizlet.com/hc/en-us/articles/27393733229965-Playing-a-game-of-Blast), [single-player page; search excerpt only](https://quizlet.com/features/blast-single-player).
- **Blocks:** Correct answers earn three puzzle pieces; placing them fills rows/columns and earns points; play ends when pieces cannot fit. [Quizlet Blocks](https://help.quizlet.com/hc/en-us/articles/37203179032717-Playing-a-game-of-Blocks).
- **Charms:** Match three or more colored pieces; special question pieces offer additional moves for correct answers. This is documented in the current help center and should not be omitted from a claim about all current Quizlet games. [Quizlet Charms](https://help.quizlet.com/hc/en-us/articles/47712424067341-Playing-Charms).
- **Quizlet Live:** Collaborative classroom play is a separate capability requiring participants and shared session state. A local solo app does not cover it. [Quizlet study modes](https://quizlet.com/features/study-modes).

## Important current-product distinction

Quizlet now also documents spaced repetition within Flashcards: Repeat/Hard/Okay/Easy ratings, due-card sessions and a new-cards-per-day limit. It is therefore inaccurate to say only Anki has spaced repetition. This documentation establishes visible controls and approximate return times, not Quizlet's underlying scheduler. [Quizlet spaced repetition](https://help.quizlet.com/hc/en-us/articles/48324742264077-Studying-with-Spaced-Repetition).

## Scope that must remain explicit

The public current study index includes Ask Quizlet, AI practice tests, podcasts, audio notes, study with friends, expert solutions and other services. They are separate from ordinary flashcard-based local tests. Listing them in the official index does not establish their private implementation or supply content for reproduction. [Quizlet current study index](https://help.quizlet.com/hc/en-us/sections/360005938691-Studying).

A useful first local release should cover creation/editing, image/text cards, reversible prompts, due review, flashcards, adaptive practice, Write, Spell, customizable Test, Match, at least one arcade challenge, and full portable backup. Blocks and Charms are additional game mechanics if implemented and tested. A complete parity claim would additionally require classroom multiplayer, hosted discovery/sharing, AI services, diagram labeling, extensive grading behavior, Anki templates/add-ons and full scheduling semantics. Those are not established by this evidence or implied by an MVP.

Anki APKG compatibility, exact Anki card generation, independent forward/reverse scheduling, sibling burying, suspend/bury behavior, FSRS optimization and synchronization must each be claimed only if actually implemented and verified. Changing the front/back orientation alone is not equivalent to Anki's separately scheduled reverse cards. [Anki basics](https://docs.ankiweb.net/manual/getting-started), [Anki studying](https://docs.ankiweb.net/manual/studying).

## Claims supported by this research

Supported wording: "An independently written local study app inspired by documented Quizlet study modes and Anki's spaced review workflow."

Unsupported wording: "Decompiled Quizlet," "all Quizlet and Anki features," "exact Quizlet Learn algorithm," "FSRS" without an actual FSRS implementation, or guaranteed offline speech on every device.

## Verified engine behavior in this release

The independently written review engine uses SM-2-inspired interval growth with Again/Hard/Good/Easy ratings, one-minute relearning, ten-minute learning, and a maximum interval of 36,500 days. It is not FSRS. Forward and reverse schedules are stored independently. Daily new/review limits apply per deck and direction: the frontend supplies history for the selected deck. Practice/game events do not consume the review allowance; learning repeats remain available after the review limit; review allowance counts distinct cards.

Automated engine contract checks verify review transitions, independent directions, daily caps, grading, generated test consistency, quoted CSV/TSV parsing and library validation. Imports validate IDs, history, settings, scheduling bounds and embedded image data syntax; actual image decoding remains the browser's responsibility. Image-only answers support manual recall in flashcards/review. Automatically graded tests need answer text, so image-only answers are excluded in the selected direction; reversing an image-only-answer card allows its image to be the prompt when the other side has text.

## Delivered mode coverage and remaining gaps

The app exposes these twelve modes directly from a deck: Flashcards, Spaced review, Learn, Write, Spell, Test, Match, Falling words, Quick quiz, Blocks, Charms, and Pass & play. Text and images can be attached to both card sides; study direction, starred-only selection, shuffle and exact grading controls are available. Local JSON import/export carries content and media; CSV/TSV supports text exchange. Engine verification currently has 24 passing contract checks.

The game names describe this app's independently written activities. **Blocks** is a question-clearing board, not Quizlet's shape-placement puzzle. **Charms** awards swaps for answering questions and scores adjacent match-three moves; it is a simplified variant. **Falling words** uses typed recall and is not a reproduction of Quizlet's current Blast mechanics. **Pass & play** uses one device and does not implement networked Quizlet Live, shared classrooms or cross-device competition. Quick quiz is a timed local practice activity.

This release does not implement cloze note types, image-occlusion editing, labeled Quizlet diagram sets, APKG import/export, Anki template programming/add-ons, FSRS/parameter optimization, sibling burying, cloud synchronization, hosted community decks, semantic AI grading, AI-generated materials, podcasts or expert solutions. Cards may be manually suspended or buried; this does not imply all Anki suspension/burying semantics. Spell uses browser speech voices and needs answer text. Image-only answers use manual self-assessment instead of automatic text grading in supported practice modes; automatically graded tests skip them. These gaps prevent any claim of all-feature parity.
