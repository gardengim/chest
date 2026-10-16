# Stable card foreground and caption — 2026-10-15

The owner's first-hover displacement was reproduced in WebKit against the prior
card structure. The outer card stayed 260×346.66 while media height changed from
129.5 to 140.05 and the title moved down by about 10.55 pixels. The controlled
[before-fix regression](evidence/2026-10-15-card-hover-layout/before-fix.txt) fails
on that geometry change; it is diagnostic evidence, not a passing acceptance run.

## Correction

The ratio guide and foreground now occupy one shared grid cell. Media and caption
are laid out by a flex column within the foreground, avoiding WebKit's spanning
multi-row redistribution on hover. A flexible upper media region balances the
icon above a natural-height caption. Title, metadata and actions form distinct
caption groups with consistent spacing. Instance status uses the shared metadata
spacing rather than a large independent margin.

Gallery cards keep the 3:4 preference; screenshots keep 4:3 and centered cover
cropping. Long/enlarged labels still grow the card as needed. List foregrounds
remain horizontal. Shared Button hover/press feedback remains; internal geometry
stays fixed relative to the card through hover, exit and repeated hover.

Screenshot cards only provide the optional action slot on failure. Successful
screenshots therefore no longer reserve an empty action row below their caption.

## Verification

- Svelte diagnostics: zero errors/warnings.
- 38 targeted Chromium tests and the same 38 WebKit/Retina tests passed.
- New regression measures relative media/body/title geometry through three hover
  and exit cycles, gallery/list content cards and content action-button hover.
- Existing checks cover ratios, centered image bounds, artwork recovery,
  transparency, glyph paint, resource menus, delayed refresh and narrow/200% reflow.

[Chromium evidence](evidence/2026-10-15-card-hover-layout/chromium.txt),
[WebKit evidence](evidence/2026-10-15-card-hover-layout/webkit.txt),
[diagnostics](evidence/2026-10-15-card-hover-layout/check.txt).

Pause for human visual review. Earlier untried data roundtrips, slow-storage/heavy
workloads and whole-app performance checks remain pending; no release is published.

Application revision: `03e1e00f7c750c9118a84f6376871879a0ce41f2`. The optimized local app was rebuilt
and its ad-hoc signature passed deep/strict verification.
[Artifact identity](evidence/2026-10-15-card-hover-layout/candidate.json),
[build log](evidence/2026-10-15-card-hover-layout/build.txt),
[instance caption](evidence/2026-10-15-card-hover-layout/instance-card.png),
[screenshot caption](evidence/2026-10-15-card-hover-layout/screenshot-card.png).
