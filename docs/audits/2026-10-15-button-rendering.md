# Button and glyph rendering follow-up

Initial rendering change: `1d75620`; message-action follow-up: `c6e071e` below.
Mac owner visual review remains pending after rebuilding.
The earlier [completion candidate](2026-10-14-completion.md) and its measurements keep
their original identities. This follow-up changes shared control rendering.

## Findings and correction

- Icon-only radio padding and an SVG max-width override squeezed a 24-unit glyph
  into a 22-pixel box at default text scale. Removed that override and reduced
  padding within the existing elastic control dimensions. Icon sizes stay owned
  by `Icon.svelte`; gallery/list no longer has a second sizing policy.
- Shared hover/press transforms animated a one-pixel movement through fractional
  positions. Relative integer offsets now provide the same lift/press without a
  transform layer or subpixel motion. Color, border highlight and bevel transitions
  remain. Selected segments and joined tabs remain anchored; dropdown options keep
  their existing stationary behavior.
- Native checkbox/radio feedback had the same interpolation issue. It now uses
  integer offsets too. Invisible inputs inside segmented controls retain their
  stationary hit area and native keyboard semantics.
- Content tabs applied drop-shadow filters to their whole subtree. Replaced this
  with the shared bevel/drop-shadow tokens on the panel surface, so descendant
  hover cannot promote the whole tabbed interface into a filtered raster layer.
- Symbol geometry and the one-conversion-per-symbol cache remain unchanged.
  No hover-triggered icon conversion or independent replacement icon set was added.

## Validation

Before the fix, focused regressions failed on the squeezed icon width and
fractional hover positions. After the fix:

- Retina WebKit: 11 focused tests pass, covering Home Instances, Explore, instance
  Content, plus buttons, native checkboxes, radio/keyboard/disabled states, tab
  outlines and Settings decisions.
- Glyph screenshot masks remain identical at rest, hover and press; checks include
  all three gallery/list contexts and Add. Panel shadow and icon dimensions stay stable.
- Full local verification: **177 Chromium browser, 100 Core, 3 native library and
  24 script tests pass**; Svelte reports 0 errors and 0 warnings. The sequential
  unsigned `.app` build also passed. [Candidate identity](evidence/2026-10-15-button-rendering/candidate.json)
  records the source and executable SHA-256; [build output](evidence/2026-10-15-button-rendering/build.txt)
  records the completed bundle.

[Full verification](evidence/2026-10-15-button-rendering/verification.txt),
[Retina WebKit checks](evidence/2026-10-15-button-rendering/webkit.txt), and
[pre-fix failures](evidence/2026-10-15-button-rendering/before-fix.txt).

The [three-platform CI check](https://github.com/gardengim/chest/actions/runs/38799685128)
passed on Windows, macOS and Linux for `1d75620`. Earlier
installer inventories identify the pre-fix candidate and are not this rebuild.

WebKit checks are repeatable through `CHEST_TEST_BROWSER=webkit npm test -- ...`;
see the [SOP](../audit-sop.md). WebKit engine tests do not replace visual review of
macOS's actual system WebView, display scaling and GPU behavior.

## Owner verification carried forward

The owner confirmed unsaved Settings Save/Discard/Cancel behavior and keyboard
navigation/dialog focus. The reported Minecraft graphics failure also occurs in
Prism according to the owner; it is tracked outside Chest's finalization blockers.
Chest staying usable and accepting repeated launch attempts is already verified.

Relaunch the rebuilt Chest app and review the reported Home Instances, Explore,
instance Content and Add hover/press cases. No release/tag/consolidation follows
from these results.

## Shared action and message-palette follow-up

Source: `c6e071e`.

View all, shared Copy, crash Log/acknowledge, notification dismiss and inline Retry
now use the standard raised Button variant. Copy remains one reusable component
with its clipboard result announcement. Icon-only controls share the existing
elastic control size and central padding rather than individual local button rules.

Colored messages own `--message-fill` and `--message-text`; their surfaces and
nested Button colors read the same values. Hover colors still derive from the shared
button fill. Error notifications now use the opaque danger surface and its paired
foreground, matching crash banners; success messages use their own palette.
No red literal is embedded in a Button. Inline error actions use the danger palette.
Message actions wrap in narrow layouts instead of overflowing.

Retina WebKit: **11 focused checks pass**, including red and custom-color messages,
success dismissal in Light mode, log/error clipboard contents, error dismissal,
View all navigation, pixel stability and 320-pixel crash-action containment. A
pagination focus-retention check now activates via keyboard explicitly because
Safari pointer clicks do not establish button focus. The focus assertion remains.

Sequential local verification passes **177 browser, 100 Core, 3 native library
and 24 script tests**, with 0 Svelte errors/warnings. The unsigned `.app` build passes.
[Verification](evidence/2026-10-15-button-rendering/message-actions-verification.txt),
[WebKit checks](evidence/2026-10-15-button-rendering/message-actions-webkit.txt),
[build output](evidence/2026-10-15-button-rendering/message-actions-build.txt), and
[current candidate identity](evidence/2026-10-15-button-rendering/message-actions-candidate.json)
are retained. The earlier installer inventories remain historical.

The [message-action platform check](https://github.com/gardengim/chest/actions/runs/38801591271)
is in progress at handoff and is not recorded as a pass. Native visual acceptance
of these message actions remains pending; quit and reopen the rebuilt app to review.
