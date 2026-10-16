# Stable refresh and ratio-based cards — 2026-10-15

Owner confirmed relative last-played wording works. The requested follow-up keeps
previously loaded UI visible during background refresh, corrects icon-button
alignment, and uses 3:4 gallery cards with 4:3 screenshot cards (width:height).

## Implementation

- Worlds retain their mounted list during focus refresh; servers and screenshots
  only display loading placeholders on first load. Existing cards and pagination
  remain usable while the next response is pending. Read failures retain old data.
- Screenshot tiles retain old thumbnails while replacements load. Their images
  fill the media frame with centered cover cropping; full preview stays contained.
- Shared gallery sizing uses a hidden grid-spanning ratio guide. The guide defines
  preferred dimensions while intrinsic caption/media rows can grow for wrapped
  names and enlarged text. This avoids enforcing a fixed height or clipping text.
  Screenshots explicitly pass the reusable `aspectRatio="4 / 3"` override; other
  gallery cards default to 3:4. List rows remain content-driven.
- Captions share small vertical gaps. Ellipsis actions use the shared square
  icon-button dimensions and a 24-grid glyph, replacing custom font/padding rules.
  Hover/press/focus feedback remains owned by Button.
- Context menus prevent focus-driven scrolling, ignore their own scrolling, and
  subscribe to external scroll dismissal after the opening scroll has settled.
  Taller cards therefore preserve existing bookmark and other context actions.

## Human recheck

Return to Chest repeatedly: existing lists should stay visible without a loading
replacement. Check regular and screenshot ratios, centered screenshot cropping,
hover alignment and menu actions. Long labels or enlarged text may expand a card
beyond its preferred ratio so content stays accessible.

Earlier untried data roundtrips, slow-storage/heavy workloads and whole-app
performance checks remain pending. This follow-up does not publish a release.

## Regression verification

All 34 focused Chromium tests and the same 34 WebKit/Retina tests passed. Coverage
includes actual card ratios, image/frame bounds and centered cover fit, icon-button
centering during hover, backdrop transparency, retained DOM identity through a
delayed focus refresh, resource menu actions and narrow/200% text reflow.

[Chromium evidence](evidence/2026-10-15-stable-card-layout/chromium.txt),
[WebKit evidence](evidence/2026-10-15-stable-card-layout/webkit.txt).
