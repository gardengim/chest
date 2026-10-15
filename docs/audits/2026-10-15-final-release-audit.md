# Final pre-release audit — performance, accessibility and maintainability

**Decision: hold the release build.** Two high-priority findings remain, followed by four focused pre-release corrections. Passing the existing test suite does not cover these boundaries.

Application revision: `b91e552be74a4c8882a4c358a77a75d8f709b4e8`.
Audit checkout: `d75cfde95ff50089bd16bbc92b829b648da19de3` (later commits are documentation only).
No application code, normal user profile, account, world, release tag or distribution artifact was changed. Disposable audit fixtures were removed after recording their source and results.

## Findings, in priority order

### A1 — P1: declared Mac compatibility permits broken core controls

The current app's `Info.plist` declares `LSMinimumSystemVersion=10.13` ([artifact record](evidence/2026-10-15-final-audit/artifact.json)). Shared dropdowns unconditionally call `showPopover()` and `hidePopover()` in [Select](../../src/Select.svelte); the toolbar overflow uses the same dependency. There is no capability fallback.

Removing those methods in an otherwise functional production-browser session reproduces `showPopover is not a function` when opening the mod-loader dropdown. This is a capability simulation, not a claim of testing an actual 10.13 device. [Recorded result](evidence/2026-10-15-final-audit/compatibility.json).

Popover support arrived in Safari 17, according to [WebKit's release notes](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/). [Apple's notes](https://developer.apple.com/documentation/safari-release-notes/safari-17-release-notes) list Sonoma, Ventura and Monterey availability. Those notes do not establish Chest's supported minimum OS by themselves.

**Required:** decide and test the minimum supported OS/WebView, then make installer metadata, documentation and runtime behavior agree. If older engines remain supported, provide a usable fallback for dropdowns **and** toolbar overflow, and check other modern CSS/DOM dependencies. Do not merely catch and suppress the exception. Validate the chosen minimum on a packaged device.

### A2 — P1: instance icon loading has no aggregate or decoded-size bound

[Core::instance_icons](../../core/src/lib.rs) reads and base64-encodes every instance icon, allowing up to 2 MiB per file. It checks format signatures, but does not bound decoded dimensions, resize icons, or limit the aggregate response. [App.refreshIcons](../../src/App.svelte) loads the whole response into the shared artwork map on startup and reloads. Sidebar images load eagerly.

A disposable fixture with **100 valid tiny PNGs padded to 1 MiB each** returned all 100 icons and **139,812,600 encoded string bytes (133.34 MiB)** in a single response. This establishes an allowed-input payload problem; padded files are a stress fixture, not a typical-user average. The evidence's UTF-16 projection is a conservative string-accounting estimate, **not measured WebView memory**. Browser string/image sharing may vary. [Result](evidence/2026-10-15-final-audit/icons.json), [fixture](evidence/2026-10-15-final-audit/icon-workload.rs.txt).

**Required:** use bounded icon decoding and small thumbnails, with a bounded cache/payload strategy. Reuse the existing thumbnail/cache infrastructure where appropriate. Cover oversized dimensions and aggregate library behavior. Preserve original artwork and missing-icon behavior.

### A3 — P2: synchronous native commands still perform filesystem work on the UI thread

Examples in [the native command layer](../../src-tauri/src/lib.rs): `get_content`, `toggle_content`, `save_instance`, `save_settings`, bookmark mutations and account selection. Their Core/store calls enumerate directories, rename files or write configuration. These commands remain ordinary synchronous `#[tauri::command]` functions.

The installed Tauri command macro's synchronous wrapper calls the function inline. [Tauri's documentation](https://github.com/tauri-apps/tauri-docs/blob/v2/src/content/docs/develop/calling-rust.mdx) also documents this main-thread behavior. A slow directory, external instance location or delayed write can therefore stall native input and repaint. This is a verified execution-path risk; the audit did not inject a real stalled device or measure a user-visible hang.

**Required:** move filesystem/lock-bound work to blocking workers through async command boundaries, following the pattern already used for screenshots, storage scans, duplication and deletion. Keep response shapes and validation unchanged. Do not move UI-owned native dialogs indiscriminately.

### A4 — P2: resource collections bypass the existing bounded-card pattern

[ResourceLibrary](../../src/ResourceLibrary.svelte), [WorldList](../../src/WorldList.svelte), [InstanceFiles](../../src/InstanceFiles.svelte) and [ContentCollection](../../src/ContentCollection.svelte) render entire collections. Instances and screenshots already use 24-card pages.

Synthetic Home data containing 1,000 worlds and 1,000 servers rendered **2,000 cards / 27,155 DOM nodes**. The final GC-assisted Chromium observation used approximately **108 MiB of JavaScript heap**. A 1,000-mod view rendered all 1,000 cards / 8,118 nodes, using about **67 MiB** in the final observation. Filtering it to one result took **167 ms** on this host. These are diagnostic samples, not controlled cross-device benchmarks or evidence that every large library is slow. [Final samples](evidence/2026-10-15-final-audit/resource-ui.json).

Repeated linear lookups compound this scaling: `ResourceLibrary` finds an owner inside each world filter, and `InstanceFiles` maps folders using `worldDetails.find` for each folder. The latter is quadratic in world count when both arrays grow together.

**Required:** reuse bounded collection paging and existing Pagination controls. Preserve complete search/sorting and make every item reachable; do not truncate data before filtering. Deep links must select the page containing the highlighted world/server before focusing it. Use derived ID/folder maps for repeated lookups. Prefer these small shared changes over a new virtualized-list framework.

### A5 — P2: asynchronous loader failures are not announced

[LoaderPicker](../../src/LoaderPicker.svelte) renders its asynchronous error as a plain `.inline-error` div. It has no alert/status/live semantics and no live ancestor. A simulated loader request failure confirmed all three are absent. The loader-version control becomes disabled with “Unavailable,” leaving keyboard/screen-reader users without a timely explanation. [Recorded semantics](evidence/2026-10-15-final-audit/loader-announcement.json).

**Required:** announce the error and associate it with the affected field while retaining Retry and the current focus. Add a failure-path accessibility regression. Automated contrast/ARIA scans alone cannot detect missing status announcements.

### A6 — P2: release documents contradict implemented behavior

- [README](../../README.md) says there is no bundled Microsoft application ID and directs users to a setup field under the ordinary Settings tab. Core now supplies Chest's public client ID; setup is on the development-only tab.
- [Product baseline](../BASELINE.md) still excludes Light mode and lists only four languages. The app supports Light/Dark/System, imported paired schemes, Chinese and Arabic.
- The baseline still mentions Stay/Discard and the old Content label. Current dialogs use Cancel; collections use Contents.
- [Acceptance template](../ACCEPTANCE.md) does not include Arabic/RTL in the language scenario.

**Required:** synchronize README, baseline and acceptance instructions with the current behavior and the chosen platform minimum. Treat implementation, public support promises and human acceptance as separate facts. A broad App/sidebar rewrite is not warranted by this finding.

## Checks and measurements

The existing application revision passed [Check Chest on Windows, macOS and Linux](https://github.com/gardengim/chest/actions/runs/38810337360). The prior exact-source local verification includes **185 browser tests, 101 Core tests, 3 native tests and 25 script tests**, plus **20 focused Retina WebKit checks**; see [the UI refinement report](2026-10-15-rtl-settings.md). Those results were verified rather than rerunning an unchanged complete suite just to reproduce the same evidence.

This audit added **six disposable browser diagnostics**, all completed successfully. Their success means the observations were recorded, including demonstrated failure conditions; it does not mark the findings fixed. [Diagnostic output](evidence/2026-10-15-final-audit/diagnostics.txt), [reproducible fixture](evidence/2026-10-15-final-audit/diagnostic-ui.spec.ts.txt).

### Performance

Current packaged macOS arm64 executable SHA-256:
`52c64c092fd2a33eea87580da6f6b015cd1c280749f368c16f8d64b8b76f2e29`.
Installed `.app`: **13,086,162 logical bytes / 12.48 MiB**. No new release build was produced by this audit.

On macOS 27.0.1, with disposable account-free profiles:

| Measurement | Result | Boundary |
| --- | --- | --- |
| Empty startup, 3 samples | median **442 ms**, range 433–1,004 ms | Parent process creation to library-ready IPC |
| 1,000-instance startup, 3 samples | median **553 ms**, range 537–575 ms | Populated fixture initializes an empty profile first |
| Empty idle, 3 × 20 seconds after 5-second settle | main-process mean RSS **110–115 MiB**, peak **115.63 MiB**; CPU **0–0.05%** of one core | **Excludes WebView, GPU, networking and JVM processes** |
| 50,000 screenshot metadata entries, 3 samples | median **79 ms**; all returned | Core enumeration, not rendered UI |
| 2 GiB SHA-256 | **3.76 s** | Disposable local file |
| 2 GiB verified local HTTP download | **3.98 s** | Loopback only; not provider/network throughput |
| 2 GiB duplicate / delete | **0.55 ms / 43 ms** | APFS can clone; not physical copy throughput |
| 100,000 log lines across 100 sessions | **552 ms**; retained **16,730,164 bytes** | Native history, not UI frame latency |

[Empty startup/idle](evidence/2026-10-15-final-audit/native-empty.json), [populated startup](evidence/2026-10-15-final-audit/native-1000.json), [offline resource workloads](evidence/2026-10-15-final-audit/core-workloads.jsonl).

No controlled cold/warm classification or contention isolation was performed. These short main-process idle samples must not be compared directly with the earlier hour-long whole-group footprint observation or used as a leak/whole-app CPU guarantee. Current workload results do not replace native Windows/Linux/Intel Mac device acceptance.

Existing strengths remain: streamed verified downloads, bounded native/pending/displayed log strings, visibility-aware image rotation, limited screenshot decoding, lazy translations/descriptions, background filesystem workers on major operations, and conservative storage cleanup. Shared-game garbage collection remains intentionally unimplemented rather than guessing ownership.

### Accessibility

Fresh automated scans, including WCAG 2.2 AA tags, found **zero rule violations** on sampled populated Home, Worlds, Servers, Contents and instance Settings screens. [Resource screens](evidence/2026-10-15-final-audit/resource-accessibility.json), [Settings](evidence/2026-10-15-final-audit/settings-accessibility.json).

Home world context-menu geometry, hit testing and focus were also checked; the suspected clipping issue **did not reproduce**. [Result](evidence/2026-10-15-final-audit/menu.json).

Native VoiceOver/NVDA/Orca announcements and reading order remain human checks. Passing Axe, keyboard/browser tests or API-removal simulation does not establish native assistive-technology or minimum-OS acceptance. A5 is a missing announcement not reported by the static rules.

### Maintainability

The shared Button, segmented radio selector, Card, Toolbar, Pagination, palette roles and navigation decision owner are useful existing boundaries. The combined instance settings transaction is preferable to independent partial saves. No additional architecture framework or wholesale root-component rewrite is justified for 0.1.0.

The focused work is to reuse those boundaries consistently: one paging convention, bounded artwork handling, async filesystem command boundaries, derived lookup maps, and accurate user-facing documentation. The six fixtures/evidence records below make the gaps concrete without changing production behavior during review.

## Fix order and acceptance

1. **A1:** agree the platform minimum/fallback policy; verify packaging metadata and core controls on that minimum.
2. **A2:** bound decoded and aggregate instance artwork; rerun the icon fixture and startup/heap checks with populated icons.
3. **A3:** offload remaining filesystem commands; verify their existing failure semantics and input/repaint during slow work.
4. **A4:** apply shared paging/maps to resources and content; test first/last pages, search, mutation clamping and world/server deep links.
5. **A5:** add error announcement/field association and a failed-loader keyboard test; confirm it with a native screen reader.
6. **A6:** synchronize release documentation and the acceptance template.
7. Run the relevant regressions, then full verification and cross-platform checks for the fixed revision. Build a new verification candidate and record its own identity; do not transfer this binary's timings to it.
8. Complete remaining human/device acceptance before release consolidation or publication.

Use [the audit SOP](../audit-sop.md) for the normal validation/build flow. The saved diagnostic spec can be copied to a temporary file in `tests/`, run with `npm test -- <that file>`, and removed afterward. Set `CHEST_AUDIT_OUTPUT` to an existing disposable output directory; it defaults to `/tmp`. The saved icon workload can similarly be copied temporarily into `core/examples/` and run with Cargo. It owns and removes its synthetic files. These diagnostics describe the audited behavior; convert them into prevention tests when implementing the fixes rather than preserving assertions of the defects.

Only the audit report and sanitized evidence are committed. **Release build and implementation remain paused for review of the findings.**
