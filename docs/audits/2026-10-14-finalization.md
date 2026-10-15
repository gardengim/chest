# 0.1.0 finalization audit — October 14, 2026

Audited commit: `f25d523c53d8dbce465e238afda50cdd5b78624d`, pushed to
`origin/main` before this audit. GitHub's branch SHA was independently verified.
No application fixes, release tags, publication, or consolidation were performed.
This report and its evidence are audit outputs.

**Verdict: not ready for 0.1.0 consolidation.** The current build works across a
substantial automated workflow matrix, but validation is red, fresh release sign-in
is not configured, and the expanded accessibility audit finds light-mode contrast
failures. Packaged human acceptance and complete resource measurements remain open.

## Evidence and boundaries

Local environment: macOS 27.0.1, Apple Silicon, Node 26.11.1, Rust 1.95.0,
installed Google Chrome. Exact browser version and measurements are in
[the measurement record](../measurements/2026-10-14-finalization.json).
Native runs used disposable test profiles; real accounts and user libraries were
not used. Source review covered frontend state/lifecycles, shared controls, themes,
localization, native commands/menus, storage, artwork, downloads, logging, and release
configuration. Existing regression suites covered the application pages and dialogs.

| Check | Current result |
| --- | --- |
| Version/updater configuration | Pass |
| Script tests, including translation coverage | 12 passed |
| Svelte/TypeScript diagnostics | Zero errors and warnings |
| Production frontend build and license coverage | Pass |
| Rust core tests | 87 passed |
| Strict Rust core lint, all targets | **Fail**, `artwork.rs:290` |
| Native desktop compilation | Pass, local macOS arm64 |
| Native library tests | 3 passed, including color-scheme roundtrip |
| Complete browser suite, two workers | **163 passed, 4 failed** |
| Additional production-browser settings/dropdown axe scans | No violations in settled light and dark modes |
| Additional populated world-page axe scans, absent artwork | **Light fails; dark passes** |
| Local release executable and unsigned macOS app bundle | Build successfully |
| GitHub checks on audited commit | **Fail** on macOS lint; Windows/Linux jobs cancelled by matrix fail-fast |

GitHub evidence: [Check Chest run](https://github.com/gardengim/chest/actions/runs/38675619095).
Local logs and visual evidence are under [evidence/2026-10-14](evidence/2026-10-14).
The verification script stops on its first failure; native and browser checks were
therefore run separately afterward. No failed check was silently treated as passing.

## Findings, in priority order

### F1 — P1: release validation cannot pass

`core/src/artwork.rs:290` discards the byte count returned by `socket.read()` in
the status-icon socket fixture. Strict Clippy rejects `unused_io_amount` locally
and on GitHub. The fixture also assumes a single read sufficiently consumes the
request. Handle the actual framed request/read amount rather than suppressing the
lint or blindly using `read_exact` on an arbitrary 512-byte buffer.

Four browser tests still assume behavior from before the Settings transaction:

- `tests/graphics-checkbox.spec.ts:31`: edits Reduce motion, then attempts instance
  navigation without resolving the new save/discard dialog; the error snapshot
  shows that dialog, not a checkbox rendering failure.
- `tests/navigation.spec.ts:81`: expects the old “Default settings” heading, then
  would switch tabs without accounting for unsaved changes.
- `tests/presentation.spec.ts:68`: expects navigation and retained settings drafts
  across pages without resolving the deliberate save/discard decision.
- `tests/presentation.spec.ts:99`: attempts Save on an unchanged, correctly disabled
  form; subsequent expectations also predate the pending-save navigation guard.

These failures are stale test contracts on inspected evidence, not four proven
production regressions. Update the scenarios to exercise the intended decisions
and real dirty/pending states, preserving their original coverage. Require a green
complete suite and all three CI platforms before consolidation.

### F2 — P1: a fresh release has no usable default sign-in configuration

`core/src/store.rs:75` defaults the public client ID from a runtime environment
variable, otherwise empty. `src/SettingsPage.svelte:73–89` disables Sign in when
empty and exposes application setup only in the development tab. The release
workflow does not supply an approved built-in ID. A normal fresh release therefore
cannot sign in without external configuration. Setting a variable only during a
build would not bake this runtime lookup into the executable.

Obtain/configure Chest's own approved public application ID, integrate the release
default, then verify ownership, callback cancellation, refresh after restart,
account switching, credential storage, sign-out, and actual launch. Existing saved
configurations and migration from an empty ID need explicit handling. Registration
and live authentication acceptance are external gates, not established by mocks.

### F3 — P1: light-mode contrast fails on a populated instance page

Reproduction: built-in Light mode; installed Vanilla instance; Worlds tab; a world
without artwork. Settled production-browser axe reports enabled Play and Back up
text at **4.20:1**, below WCAG AA's 4.5:1 requirement for their 12px text.
Instance header metadata/status also reports **4.44:1**.

`src/Card.svelte:82` combines a fixed translucent black action surface with inherited
dark light-theme text. `src/style.css:1170` applies a dark text shadow to the hero
even without an image; the screenshot visibly shows muddy text on the light page.
Give action surfaces and foregrounds a reliable contrast pairing while retaining
transparency, and apply image-readability shadows only where needed. Verify both
missing-artwork and bright/dark-image cases; theme customization requires more than
checking only the default dark palette.

Evidence: [light world cards](evidence/2026-10-14/light-world-cards.png),
[dark world cards](evidence/2026-10-14/dark-world-cards.png), and node-level axe results
in the measurement record. A separate initial scan caught contrast during a theme
transition; settled scans of Settings passed. That transient result is not counted
as a persistent Settings defect.

### F4 — P2: large filesystem operations still execute in blocking commands

`src-tauri/src/lib.rs:382–387` invokes recursive instance duplication/deletion from
synchronous Tauri commands. `core/src/lib.rs:509–546` and `core/src/store.rs:286–300`
perform recursive copy/remove while holding operation coordination. Tauri's installed
command wrapper directly executes these synchronous bodies; these paths lack the
blocking-pool boundary already used for world copying, backups, imports, exports,
and screenshot scans.

Move expensive filesystem work to asynchronous command wrappers with a blocking
worker, retain operation safety, and expose a pending/progress state. Measure with
multi-gigabyte disposable instances. This is a source-confirmed blocking path;
the duration and platform-specific UI impact were not measured here.

### F5 — P2: screenshot and large-library memory costs need stronger bounds

`core/src/instance_files.rs:96–102` returns full PNGs as base64, checking signature
and a 16 MiB file limit but not image dimensions. `src/ScreenshotTile.svelte:14–24`
retains loaded data in mounted tiles; backdrops retain current/previous frames.
The shared 16 MiB cache bounds only its retained strings, not mounted component
data, in-flight requests, browser-decoded images, or GPU memory. A single allowed
16 MiB PNG can become roughly 42.7 MiB of conservatively counted UTF-16 base64
text, before decoding. This is a size calculation, not a measured allocation.

Generate bounded thumbnails for cards/backgrounds, retain full resolution only for
preview/open, validate dimensions, and bound concurrent reads. Measure populated
4K screenshot libraries through repeated scrolling/navigation, including WebKit
processes. Do not describe the cache limit as a total application memory limit.

The instance library mounts every matching card (`src/InstanceLibrary.svelte:55`),
including horizontal shelves. The 1,000-instance synthetic production workload
reached 15,114 DOM nodes and 36.0 MiB JavaScript heap, with a 185ms filter interaction.
It passes the existing broad smoke budget but exceeds a frame budget. Consider
windowing/pagination if realistic-library profiling confirms the need; avoid a
large virtualization rewrite without that evidence. Normalize the search query
once rather than inside each filter predicate (`:31`).

### F6 — P2: file enumeration silently truncates before sorting

`core/src/instance_files.rs:26–39` stops after 1,000 valid directory entries, then
sorts. Filesystem enumeration order is unspecified, so a large screenshot directory
can omit recent files, with no truncation indicator. World listings use the same
helper. The global screenshot library cannot distinguish complete from truncated
results. Use deterministic bounded selection/pagination and communicate any limit;
test with more than 1,000 entries whose enumeration differs from display order.

### F7 — P2: download and cache storage recovery is incomplete

`core/src/install.rs:53–79` streams into `.download`; checksum mismatch removes it,
but transport/write errors return early and leave the partial file. Retrying the
same target truncates it, so this is not repeated accumulation for that target.
Abandoned targets can retain files, and this helper has no explicit response-byte
cap. Shared libraries/assets also remain after instance deletion, without storage
accounting or a supported cleanup action. Their reuse is valuable; do not delete
them indiscriminately.

Add cleanup/retry semantics for incomplete files, suitable download bounds, and a
safe storage accounting/cleanup policy. Verify interrupted downloads, disk-full
recovery, and referenced versus unused shared data. Actual populated library size
was not measured; no real game downloads were made for this audit.

### F8 — P2: internal navigation guards do not cover window close/quit

The Settings and creation save/discard guards cover frontend navigation.
`src-tauri/src/menu.rs:79–80` directly exits/closes the window; no corresponding
window-close/exit guard or frontend unload handler exists in the reviewed sources.
Native close, Quit, and OS shutdown can therefore bypass those decisions. This
extends beyond the user's original tab-leave requirement, but matters for desktop
usage. Decide the desired close behavior and test pending saves/installations;
avoid presenting successful preservation until the write completes.

Unreadable settings also abort startup through `Core::new_scoped(...)?` in the
native setup hook (`src-tauri/src/lib.rs:518` onward), rather than offering recovery
inside the application. `core/src/store.rs:131–132` correctly preserves the original
file. A visible, non-destructive startup recovery path is desirable before wider
beta testing; do not silently replace malformed configuration with defaults.

### F9 — P3: shared styling is substantially improved, but glyph exceptions remain

Shared Button, SegmentedControl, Card/CardGrid, Toolbar, navigation and scrollbar
tokens now provide the essential geometry/feedback. Bevels/outlines use neutral
white/black independently of palette data, and card dimensions remain configurable.
The full responsive matrix and pixel geometry/hover regressions pass.

Some controls bypass the shared pixel symbol renderer: `×` in InstanceChooser and
Screenshots, `⋮` in WorldList/InstanceFiles/Toolbar, and `✓` in Select. These depend
on system-font glyphs, unlike the shared icon paths. Reuse Close/More/Check symbols
where their meaning matches. Check 24-cell icons rendered at smaller rem sizes,
fractional desktop scaling, native zoom, and both scrollbar axes on actual WebViews.
Browser crisp-edge tests do not prove uniform device-pixel appearance everywhere.

### F10 — P3: maintainability and documentation still need a focused cleanup

`src/App.svelte` combines navigation transactions, sidebar grouping/dragging,
startup subscriptions, instance/account operations, and multiple draft stores.
`src/style.css` has 1,573 lines and repeated `.modal` rules across several late
override sections. Dense one-line state/async handlers and CSS make ownership and
cascade effects difficult to review. Existing small shared primitives are useful;
prefer extracting state owners and consolidating rules over adding abstractions
or rewriting all components. Keep archived prototypes/backups outside shipping
imports; the production inventory does not include them.

Documentation drift is confirmed: `docs/BASELINE.md:57` describes immediate preference
persistence, whereas current preferences preview until Save; Microsoft registration
instructions still point to Settings → Settings instead of Development. Historical
validation/acceptance documents also list older test counts, language coverage and
loader scenarios. Preserve dated history, but make the current acceptance checklist
explicitly cover six languages and Forge/NeoForge. Update tests alongside behavior
changes to prevent another stale-contract failure.

## Measured performance and size

| Measurement | Current local observation | Important limit |
| --- | --- | --- |
| Unsigned macOS arm64 `.app` logical bytes | 12,708,018 bytes / 12.12 MiB | Not signed/notarized; no installer or other platform measurements |
| Release executable | 12,410,288 bytes / 11.84 MiB | Includes embedded web resources; do not add frontend size again |
| Frontend distribution logical bytes | 2,029,794 bytes / 1.94 MiB | Separate inventory of embedded resources, not extra installed bytes |
| Initial JS | 200,224 bytes raw; 69,382 gzip | Gzip is a comparison measure, not native IPC transfer size |
| Largest web resource | `licenses.json`, 1,295,820 bytes | About loads notices lazily; retain required attribution |
| Rich-description chunk | 78,545 bytes raw; 25,749 gzip | Loaded on demand |
| Native empty-profile startup, median of 3 | 510.8ms | Process spawn to receipt of library-ready IPC; first sample 966.8ms; not Finder cold launch |
| Native 1,000-instance startup, median of 3 | 819.1ms | Synthetic missing-artwork library; not installed games or filled image cache |
| Native main-process idle, 30.3 seconds | 97.83 MiB mean RSS; 110.14 MiB peak; 0.30% of one CPU core | **Excludes WebKit/GPU/network XPC processes and game JVM**; not a soak |
| Missing-icon scans, median of 5 | 0.35 / 1.64 / 3.37ms at 100 / 500 / 1,000 | Files absent; not populated icon decoding |

The native core-construction single samples were 120.36 / 76.26 / 77.15ms; these
include initialization and are not comparable to historical quiet timings without
controlling caches/load. No improvement or regression percentage is claimed.

Production Chromium synthetic library observations, one sample per count:

| Instances | DOM-ready | Filter interaction | JS heap after forced GC | Renderer task time over 5 idle seconds |
| --- | --- | --- | --- | --- |
| 100 | 74.4ms | 28.7ms | 6.27 MiB | 18.4ms |
| 500 | 131.6ms | 88.9ms | 19.40 MiB | 50.8ms |
| 1,000 | 196.0ms | 185.1ms | 36.03 MiB | 102.7ms |

These mock native IPC and omit actual artwork, storage, authentication and game
processes. Renderer task time is not whole-process CPU; JS heap is not RSS.
One sample per count establishes observations, not percentiles or regression targets.

Positive resource findings: optional work is deferred past initial readiness;
visibility/reduced-motion stop backdrop rotations; artwork requests share pending
work; cache retention is bounded; logs are batched and bounded per instance;
filesystem image scans use workers. Log retention is not globally bounded across
all instances, so long/high-volume multi-game sessions still need measurement.

## Coverage and remaining human verification

Automated evidence covers Home/dock reorder and hidden items, overflow/navigation,
instance creation and drafts, content/modpack selection, provider description
sanitization, worlds/servers/screenshots, settings transactions, menus, translations,
keyboard paths, reduced motion, and responsive layouts from 320–1920 CSS pixels with
100%/200% text. It does not constitute platform acceptance or fluent-language review.

Before consolidation, resolve F1–F3, disposition the remaining findings, then record
human results against the actual candidate artifact and SHA:

1. **All four native targets:** macOS arm64/x64, Windows x64, Linux x64; fresh
   install/reopen, native menus, file pickers, OS credential store, shortcuts, zoom,
   full screen, both scrollbars, minimum supported OS decisions.
2. **Authentication and gameplay:** Chest-owned approved application; ownership,
   cancel/retry, refreshed sessions, switch/sign-out; Vanilla, Fabric, Quilt, Forge,
   NeoForge within supported versions; compatible mods/packs/shaders and real launch.
3. **Failure and data preservation:** low disk, interrupted downloads, offline
   providers, wrong/missing Java, duplicate/delete, custom storage, archive roundtrip,
   world backup/copy, corrupted settings, close/quit during dirty or pending operations.
4. **Accessible visual interaction:** keyboard-only completion, screen reader,
   focus return/traps, forced colors, Light/Dark/System, bright/dark/missing artwork,
   fractional display scales, 200% text and native zoom; fluent English/Korean/
   Spanish/Japanese/Simplified Chinese/Traditional Chinese review.
5. **Performance:** complete app/WebView process memory and CPU, populated artwork
   and large screenshots, install/hash/extraction, scroll frame pacing, high-volume
   logs, one-hour idle/running/paused soak; app and shared-data size on every target.
6. **Delivery:** independently verify actual signing/notarization and signature
   rejection, candidate downloads/install/uninstall, real signed update A → B,
   restart and preserved data. Workflow configuration is not evidence these work.

Use `docs/ACCEPTANCE.md` as the record template, expanded for this matrix. Human
verification has not been marked complete, and no release/consolidation was attempted.
