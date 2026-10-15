# UI refinements and Arabic — 2026-10-15

Application source: `b91e552be74a4c8882a4c358a77a75d8f709b4e8` (includes `8234d22`).

## Changes

- Worlds and Servers use the shared gallery/list selector on Home shelves and their full pages. Each collection keeps its own view state.
- Collection headings now say **Contents**, including the instance tab and creation sections. Spanish uses **Contenidos**; other translations keep their natural collection labels. Internal tab IDs remain unchanged.
- Added Arabic with 567 dictionary entries and lazy loading. Language preview, Save and Discard apply/revert `lang` and `dir` together. The sidebar, dropdown affordances, text alignment, collection navigation, tab keys and pixel scrollbars support RTL. User names are isolated bidirectionally; paths, console output and command text retain LTR reading order. Lighting, artwork and non-directional icons remain unchanged. The customizable Home dock retains physical ordering and its explicitly named screen anchors, with Arabic labels and bounds adjusted for the mirrored sidebar.
- Count badges use the matched `surface`/`surface-text` palette pair. Also removed an old folder-field text override that caused unreadable dark-mode input text.
- Instance Settings has one form and one bottom **Save / Restore defaults** row. General, runtime and launch settings validate and persist in one atomic configuration update. Restoring defaults stages the launcher's default memory/Java and standard launch settings, preserving instance identity and versions. Tab, sidebar, menu and native exit navigation reuse the Save/Discard/Cancel dialog. Failed saves retain the draft, and pending saves block editing/discard.
- Removed Overview's Account row and redundant launch-settings reads on tab changes. The explicit launch account override remains available in Settings.
- Shared plain text actions, including news rows, have horizontal padding without increasing vertical padding. Rich description links also have a small inline inset.

The full browser run caught a dependency on the old instance-name text element. Instance reference sizing now uses a stable `.instance-name-text` class; crowded server cards collapse to a count and expand again when space returns.

## Validation

- Full local verification passed: **185 Chromium browser tests, 101 Core tests, 3 native tests and 25 script tests**; Svelte reports no errors or warnings. Release/auth configuration, licenses, strict Clippy and native compilation checks passed.
- **20 Retina WebKit tests passed**, including icon glyph stability, shared button effects, theme previews, unsaved instance settings/native quit, Arabic layout/scrolling and crowded server references.
- Native macOS app built successfully: **13,086,162 logical bytes**. Executable SHA-256: `52c64c092fd2a33eea87580da6f6b015cd1c280749f368c16f8d64b8b76f2e29`.
- Arabic adds one lazy translation chunk (approximately 35 KB, 12 KB compressed), without additional fonts or image assets.
- Reviewed the rendered Arabic Home, Settings and 360-pixel-wide Settings screenshots. Automated accessibility checks passed on the covered Arabic and settings screens.

Evidence is in [the saved evidence directory](evidence/2026-10-15-rtl-settings/). The local candidate record identifies the exact clean source revision and built executable hash. The repeatable command is documented in [the audit SOP](../audit-sop.md).

[Check Chest for the application revision](https://github.com/gardengim/chest/actions/runs/38810337360) is still running on Windows, macOS and Linux at this report's handoff. Local results do not imply those jobs passed.

## Human verification

Quit and reopen the rebuilt Chest app before reviewing. No native GUI acceptance is inferred from browser tests.

1. Switch Worlds and Servers shelves between Gallery and List independently.
2. Check Explore's category count badges and the instance folder field in Dark and Light modes.
3. Change both instance name/runtime and launch options; leave the tab/page and exercise Cancel, Discard and Save. Restore defaults should stage changes until Save.
4. Confirm Overview has no Account row; verify collection labels in English and Spanish.
5. Preview Arabic in Settings, check mirrored navigation and scrolling at narrow widths, then test Discard or Save. Review Arabic wording visually.
6. Hover news rows and other text actions; their highlight should leave horizontal space around the text.

Existing owner-confirmed launch/authentication checks remain recorded in [the completion report](2026-10-14-completion.md). No release, tag, distribution signing, notarization or consolidation was performed. Pause remains at human verification.
