# Shared UI and performance audit — October 13, 2026

## Scope

Reviewed the shared card/grid, button, icon/artwork, toolbar, navigation, dialog/menu,
visibility and scrollbar implementations and their consumers across Home, instance
Overview/Content/Worlds/Servers/Screenshots/Settings/Log, discovery, creation, accounts,
launcher settings, news and About. Also inspected the native artwork/screenshot I/O
boundary and existing performance workloads. This extends the earlier responsive,
card and navigation audits; it does not replace their configurable layouts.

## Findings and fixes

| Finding | Resolution |
| --- | --- |
| Missing/broken collection artwork generated generic cube or grass foregrounds and synthetic backdrops. | Cards now render only real available artwork. Selected pack and project detail views also omit absent artwork. Project detail removes the empty icon frame after a failed load. Card media geometry remains shared and configurable. Intentional Minecraft instance identity in the sidebar/header and the signed-out user symbol remain available. |
| Instance Overview retained a file refresh icon unrelated to its summary. | Removed it. Resource tab refresh controls remain. Deleted its unused panel-heading styling. |
| Instance actions duplicated context-menu placement, dismissal, focus and keyboard traversal. | InstanceMenu now supplies its actions and identity heading to ContextMenu. Capturing the trigger before dismissal preserves focus when parent state changes. |
| Replacing an activity object on each download progress event triggered another instance file scan. | Derive the status separately; scans now follow identity/status transitions, not progress. A five-event reproduction caused six total scans before the fix and one afterward; pause still refreshes files. |
| Unrelated config updates reset the log search and repeated loader update lookups. | Depend on instance identity for log-search reset and on game/loader/version values for update checks. Normalize the log query once per change. |
| Shelf descendants repeatedly disconnected/reconnected resize observation during artwork/icon updates. | Reuse direct-child observations; coalesce scroll-width measurements into one animation frame; cancel queued work on teardown. |
| Toolbar action-array recreation reset overflow measurement unnecessarily; pending animation frames survived teardown. | Use a stable action signature and cancel queued frames. Existing responsive priorities and overflow behavior remain. |
| Static cards/backdrops registered visibility observations without any lazy work or rotation. | Observe only asynchronous card artwork and gallery/rotating backdrops. |
| Screenshot tiles fetched full image strings again after scrolling/remounting. | Reuse the shared pending artwork cache, keyed by instance/file/modification time, and retain loaded tiles while offscreen. |
| An entry-count-only cache could retain excessive full screenshot strings. | Limit retained artwork to 64 entries and a conservative 16 MiB string-byte budget. Share pending work, evict least recently used entries, expire after one minute and remove failed requests for retry. This budget excludes browser-decoded images and currently rendered component data. |
| Card/header gallery requests could duplicate pending native reads. | Share pending requests per instance; focus still refreshes receipts rather than serving a long-lived stale gallery cache. |
| Modpack gallery metadata performed synchronous filesystem reads on an async worker. | Move bounded, confined metadata reads onto the blocking pool; retain asynchronous legacy-receipt network lookup and existing URL/path/size validation. |
| Instance reference images used nearest-neighbor scaling while other foreground artwork differed. | Share pixelated image rendering through ArtworkImage. Screenshot media explicitly retains photographic image rendering. Symbolic icons continue using the existing cached 24×24 pixel renderer; no source resolution change. |
| Dock scrolling suppressed native scrollbar presentation even when constrained by the viewport. | Let constrained docks inherit the global square, beveled scrollbar style. |
| Regression checks still required placeholder artwork and obsolete card selectors. | Update checks to actual shared markup and absent-artwork behavior, scope dialog actions to their dialog, and retain the intentional settings form heading. |

## Styling and behavior retained/verified

- Shared Card/CardGrid dimensions, responsive columns and configurable media ratio;
  screenshot cards share the shell rather than a separate width/height implementation.
- Card actions use 80% black translucent surfaces with blur and shared button feedback.
- Horizontal native tracks and the custom vertical overlay share size/color/square-bevel
  tokens. Dialogs, dropdowns, console and constrained docks inherit the global native
  scrollbar rules. Firefox uses its supported square native fallback; WebKit styling
  requires platform verification in the packaged app.
- Search fields, action spacing, pixel bevels and navigation arrows remain shared.
- Fitting shelves/single-page collections hide unnecessary navigation; narrow toolbars
  prioritize primary actions and retain navigation outside the overflow menu.
- Dock reveal/reorder, sidebar grouping, keyboard focus, reduced motion, translations,
  chooser dialogs and resource navigation remain covered by existing regressions.

## Verification

- Svelte diagnostics: zero errors/warnings.
- Production build and translation coverage checks pass.
- All 85 Rust core tests pass; local socket fixture tests require permission to bind
  loopback ports. Desktop Rust integration compiles successfully.
- Browser coverage includes missing/broken artwork, cache request reuse and byte eviction,
  responsive pages/dialogs at 320–1920 widths and 100%/200% text scaling, pixel geometry,
  scrollbars, navigation, menus and dock interactions. The final complete browser
  suite passes: 131 tests, zero failures (two workers, local Chrome).
- The existing 100/500/1,000-instance browser workloads remain below the five-second
  library-readiness and two-second filtering budgets. These use mocked IPC and do not
  establish a native startup or memory improvement percentage.

## Measurement limits

No packaged WebView CPU/RSS, cold startup, decoded-image memory, cross-platform scroll
frame pacing or long-running game/idle soak measurements were taken in this pass.
Browser regression results and bounded retained data are evidence for the specific
fixes above, not proof that every platform-specific performance issue is eliminated.
