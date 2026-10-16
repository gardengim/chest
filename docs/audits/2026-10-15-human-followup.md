# Human-verification follow-up — 2026-10-15

This records the owner's numbered observations against the prior handoff. It does
not approve publication or transfer old candidate measurements to the new build.

## Owner observations

| Prior observation | Result |
| --- | --- |
| 1 Startup | Good |
| 2 Focus | Good except clipped Home card outline; addressed below |
| 3 Menus/window | Good; minimum native window requested |
| 4 World pagination | Works |
| 5 Resource deep links | Good |
| 6 Refresh / late data | Apparently works; delayed-data scenario not fully tried. Resource-tab discovery/removal issue found |
| 7 Artwork | Intermittent missing vanilla icon found |
| 8 Screen reader | Not tested; VoiceOver instructions supplied |
| 9 Themes | Good |
| 10 Cards/menus | Generally good; transparency, menu parity, metadata and feedback issues found |
| 11 Languages/responsiveness | Seems good; not a fluent review of every translation |
| 12 Unsaved changes | Good |
| 13 Authentication | Good; sign-out/project buttons and callback-page styling requested |
| 14 Compatible games/loaders/modpacks | Good |
| 15 Error/recovery paths | Good |
| 16 Data roundtrips | Not tried |
| 17 Slow external storage | Not tried |
| 18 Heavy artwork/log workloads | Not tried |
| 19 Complete native performance | Not tested; owner requests optimized build measurements |

The local candidate is an optimized release-profile app with an ad-hoc macOS
signature. It is not a published/notarized distribution. Previous CPU/memory
measurements apply only to their recorded source/device/workload.

## Implemented corrections

- Home shelves reserve paint space around all four focus-outline edges.
- Native minimum window size is 720×540 logical pixels. Layout remains responsive
  with rem/em/clamp/grid sizing. Device-aligned pixel-art strokes and measured
  native/DOM coordinates intentionally remain pixel based.
- Shared coalesced focus/visibility refresh covers local contents, worlds, servers,
  screenshots, instance artwork and visible logs. Instance pages discover optional
  resource tabs from every tab, retain old data after read failures, and leave a
  successfully emptied tab for the previous available tab or Overview. Local
  Refresh buttons are removed; mutation/retry callbacks remain.
- Instance artwork has an explicit bundled Minecraft fallback, including broken
  custom icons; content without artwork still omits a fabricated icon.
- All card descendant buttons share translucent blurred surfaces and existing
  button hover/press/focus/disabled feedback.
- Instance/world/server menus share MenuItem (a Button extension), icon spacing,
  keyboard navigation and separators. World menus include Play; server menus
  include Join, choosing an eligible owning instance when needed. Existing
  rename, folder, backup, copy, data-pack and bookmark operations remain.
- World card references omit version; actual NBT game mode and last-played
  timestamp appear when available. Compatibility checks still use version data.
- Errors and informative/success feedback reuse paired message palettes with
  frames and depth; their actions inherit the message palette.
- Sign out uses a danger Button; project destinations use standard Buttons.
- OAuth callback has a responsive light/dark static panel, no external resources,
  no-store/referrer protections and a hash-limited close script. It does not claim
  authentication succeeded before token exchange. Automatic close is best effort;
  browsers may require manually closing this tab.

## Remaining human checks

1. Tab through the first/last Home instance cards; all focus-outline edges remain
   visible. Check missing/broken vanilla icons after returning to Chest.
2. Add/remove the last world or server outside Chest, then return while Overview,
   Worlds or Servers is selected. Tabs appear/disappear without manual refresh;
   an emptied selected tab returns to an available tab.
3. Check card action transparency, hover/press feedback and world/server context
   menus in both themes. Confirm Play/Join targets the intended instance.
4. Check readable framed error/information messages, sign-out/project buttons,
   minimum window resizing and the sign-in browser page.
5. Enable macOS VoiceOver with Command–F5 (Fn–Command–F5 on some keyboards), or
   System Settings → Accessibility → VoiceOver. Check tab/menu names, loader
   failure announcements and Retry reading/focus order.
6. Complete untried data roundtrips, slow-storage, heavy-artwork/log and complete
   app/WebView performance observations on the optimized packaged build. Minimum
   supported OS/device and Windows/Linux screen-reader checks remain separate.

Use [ACCEPTANCE.md](../ACCEPTANCE.md) for device/build identity and evidence. No
release tag, published installer or consolidation is authorized by this record.

## Validation and local artifact

Application revision: `61841d8036b345134f1440fb3366f3d62729b7c8`. The existing
sequential `audit:candidate local` SOP passed on a clean application revision:

- 202 Chromium browser tests, 104 Core tests, 4 native tests and 26 script tests.
- Svelte diagnostics, Core Clippy with warnings denied, release/authentication
  configuration guards, license checks and production frontend build passed.
- 29 additional WebKit/Retina tests passed, including all four painted card-focus
  edges, icon recovery, translucent compositing, RTL scrollbar endpoints and
  callback-page contrast/reflow.
- Optimized local app built and its ad-hoc signature passed deep/strict verification.
  Logical bundle size is 13,795,785 bytes (13.16 MiB). Packaged macOS minimum is 14.0.
- Native smoke test reached rendered-library acknowledgement with an isolated
  empty profile; the script terminated only its owned process and removed that
  profile. One sample took 1.21 seconds from process creation to acknowledgement.
  This is a startup smoke check, not cold-start or whole-app performance evidence.

[Verification log](evidence/2026-10-15-human-followup/verify.txt),
[WebKit log](evidence/2026-10-15-human-followup/webkit.txt),
[build log](evidence/2026-10-15-human-followup/build.txt),
[artifact identity](evidence/2026-10-15-human-followup/local-candidate.json),
[native smoke evidence](evidence/2026-10-15-human-followup/native-startup.json).

Visual evidence: [complete card outline](evidence/2026-10-15-human-followup/complete-card-focus.png),
[dark callback page](evidence/2026-10-15-human-followup/callback-dark.png),
[light callback page](evidence/2026-10-15-human-followup/callback-light.png).

The new packaged revision still needs the targeted human observations above;
prior owner passes are retained as history, not automatically transferred to a
changed artifact. Windows/Linux and minimum-supported-Mac device acceptance are
not established by the local macOS/browser checks.
