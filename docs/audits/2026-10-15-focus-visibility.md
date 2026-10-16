# Focus visibility follow-up — 2026-10-15

The skip link now uses the scheme's paired panel/background text roles and shared
pixel border/bevel styling. Previously it combined a panel fill with page text,
which made its label unreadable in the default dark palette.

Shared focused buttons and radio labels rise above neighboring controls. Sidebar
entries and member rows also rise so group stacking does not cover the ring. The
scrolling instance rail reserves space for the outer ring and selected-tab join,
uses logical padding for both directions, and suspends its edge fade while focus
is inside. Scrolling and the existing pixel-aligned button feedback are retained.

Validation:

- Chromium: 15 focused tests passed (focus visibility, buttons, sidebar groups,
  pixel rendering).
- Retina WebKit: 9 focused tests passed (focus visibility, buttons, pixel rendering).
- Skip-link contrast checked with Axe in both built-in modes; Enter focuses main.
  WebKit's default keyboard policy skips links, so that contrast fixture focuses
  the link explicitly; Chromium also verifies the initial Tab route.
- Screenshot pixel checks sample all four ring edges around grouped, selected,
  unselected and scrolled sidebar items in both LTR and RTL.
- Svelte check: zero errors and warnings.

Human review remains pending. These changes do not resolve or supersede the
release findings in [the final audit](2026-10-15-final-release-audit.md).
