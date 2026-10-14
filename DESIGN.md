---
name: freezlit
description: A calm local study space for active recall and playful practice.
colors:
  primary: "#236349"
  primary-hover: "#174d37"
  ground: "#f6f5ef"
  paper: "#ffffff"
  ink: "#243c33"
  muted: "#5d6d64"
  tint: "#e8eee6"
  line: "#d9dfd5"
  sidebar: "#edf0e8"
  selected-deck: "#dce6d9"
  danger: "#a43b37"
  clay: "#a26c50"
typography:
  display:
    fontFamily: "Georgia, serif"
    fontSize: "38px"
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: "-0.02em"
  deck-title:
    fontFamily: "Georgia, serif"
    fontSize: "36px"
    fontWeight: 500
    lineHeight: 1.18
    letterSpacing: "-0.02em"
  study:
    fontFamily: "Georgia, serif"
    fontSize: "30px"
    lineHeight: 1.5
  title:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
  label:
    fontFamily: "Segoe UI, Arial, sans-serif"
    fontSize: "13px"
rounded:
  small: "4px"
  control: "8px"
  panel: "12px"
  paper: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "12px 22px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-ghost:
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  study-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.paper}"
    padding: "28px 32px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  study-mode-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
---

# Design System: freezlit

## Overview

The user asked for a basic, pleasant local quiz app. Preserve the existing quiet study interface: warm paper, restrained green controls, familiar Windows body typography and serif recall prompts. This document refreshes the implemented system; it does not replace its direction or claim that the design workshop tools succeeded.

The library leads into one focused deck pane. Study modes, recall controls and editable content remain close together. The generous flashcard face supports text and images without ornamental dashboard panels.

**Key Characteristics:**

- Quiet paper surfaces with green action and selection states.
- Familiar controls and visible keyboard focus.
- A focused recall pane followed by straightforward card rows.

## Colors

Forest green carries primary actions; the darker ink carries text and the selected study mode. Muted green-gray supplies secondary labels. Warm ground, white paper and pale green tint separate the main pane, cards and feedback. Fine pale borders organize content without heavy outlines. Clay distinguishes an alternate deck; danger red marks failures and destructive controls.

## Typography

Segoe UI with Arial fallback is the body and control voice. Georgia gives deck headings and recall content a quiet reading character. The frontmatter captures desktop roles; at narrow widths, deck titles become 30px and the main flashcard face becomes 25px. Paragraphs use a 1.65 line height and a maximum measure of 70ch. Counters and timed data use tabular numerals. Utility labels intentionally range below body size; do not describe the implementation as uniformly 14px or larger.

## Layout

Desktop uses a 246px library sidebar and a flexible main pane, with a maximum main width of 1440px. The sidebar stays visible while the pane scrolls. Main horizontal padding is 48px, increasing to 64px above 1500px. At 1050px the sidebar narrows to 210px and main padding becomes 28px.

At 760px the sidebar becomes a compact header with a visible create-deck action, horizontally scrollable library, and utility row. The main pane uses 20px horizontal padding. Study modes scroll horizontally; card rows place the definition beneath its term. Editors and import panels collapse to one column. Use the spacing scale for grouping and generous separation between the active task and its supporting card list.

## Elevation & Depth

The interface is mostly flat, with pale tonal layers and fine borders. Flashcards use a faint offset shadow (`0 6px 22px #243c3308`) to lift the active recall surface. Toasts use a stronger offset shadow (`0 8px 24px #243c3326`) to separate temporary feedback. Keep these treatments tied to those roles rather than spreading shadows across every row.

## Shapes

Controls use softly rounded corners; flashcards use the larger paper radius. Editor and feedback panels sit between those sizes. Deck markers are small rounded squares. Icons are authored SVG with consistent strokes; game pieces can use simple geometric forms because their shape is part of play.

## Components

Primary buttons are solid green with white semibold labels; hover deepens the green. Secondary buttons use white paper and a fine border. Ghost buttons use secondary text. All preserve a visible focus outline, including the label around a keyboard-focusable file input.

Inputs use paper backgrounds, fine borders and green focus borders. File uploads remain keyboard accessible even when their native inputs are visually hidden. Checkboxes use the primary accent. Errors name the problem and offer a recovery action; saving status reflects the local persistence state.

Study cards center the content, keep front/back labels and reveal guidance subordinate, and contain images without stretching them. Revealed cards use a pale green surface. Recall ratings form a compact row with the next interval under each label. Deck lists and card lists use direct rows rather than nested cards.

Selected study modes use dark ink and white text. Library selection uses a pale green fill. Keyboard shortcuts apply to the study surface and preserve native button, link and form activation. Browser selection, scrollbars, underline offset and counters follow the existing palette.

## Do's and Don'ts

- Do preserve the calm paper-and-green palette and clear active study surface.
- Do keep imported images contained and readable on both card sides.
- Do preserve visible keyboard focus and native interactive control behavior.
- Do keep creation, editing, study direction and export actions easy to find.
- Don't replace the user's simple desktop brief with an ornamental dashboard.
- Don't turn secondary labels or utility controls into competing headings.
- Don't describe simplified games or generated cards as exact Quizlet or Anki implementations.
