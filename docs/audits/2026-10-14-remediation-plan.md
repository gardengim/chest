# 0.1.0 remediation plan and task breakdown

Planning baseline: audit of `f25d523`, report committed in `c0092c8`.
See [findings and measurements](2026-10-14-finalization.md).
Status: implementation is authorized and underway; this document retains the agreed
task breakdown. Verification and any remaining external gates are recorded separately.

## Outcomes and boundaries

Produce a candidate with green automated validation, usable release sign-in,
readable light/dark interfaces, controlled startup/shutdown failures, bounded image
work, deterministic collections, and recoverable storage operations. Then repeat
the audit and hand the candidate to human verification before consolidation.

Preserve configurable card dimensions; independent scheme/mode settings; neutral
bevels/outlines; original images; native credential storage; and explicit Save,
Discard, and Cancel semantics. Discard remains a danger action, with Korean
“저장 취소.” Do not add routine explanatory text to the interface. Put necessary
failure/recovery information at the point of failure.

No broad framework rewrite, generic state-machine library, automatic shared-game
cache deletion, new customization scope, or premature virtualization. Required
dependencies must be justified by measured need and checked for size/license cost.

## Execution order

1. T01 validation repairs and T02 reliable measurement harness.
2. T03 startup error handling and T04 contrast/style corrections.
3. T05 native operation responsiveness and T06 close/quit coordination.
4. T07 deterministic enumeration, then T08 bounded image delivery.
5. T09 download recovery and storage accounting.
6. T10 measured library/log optimization, T11 focused maintainability cleanup,
   and T12 current documentation/localization.
7. T13 repeat automated/native audit; T14 human verification; stop for review.

T00 Microsoft registration is an independent external track that should start
early. Its engineering integration can proceed while approval is pending; the
release gate cannot be satisfied without the approved ID and live acceptance.
Independent tasks can be scheduled independently without requiring concurrent agents.

## T00 — production authentication configuration (F2)

**Scope:** core configuration/authentication, release checks, development setup,
Microsoft registration instructions, account tests.

- T00.1: record Chest's own registration/approval status and owner-provided public
  client ID. The owner handles registration, consent and provider submission;
  engineering must not invent an ID or borrow another launcher's registration.
- T00.2: define one configuration resolution path: preserve a valid explicit saved
  ID; honor the documented deliberate development/test override; otherwise use
  Chest's approved compiled release default. An empty legacy saved value must not
  permanently mask that default. Keep the public ID separate from account tokens.
- T00.3: integrate build-time release configuration explicitly. A runtime-only
  environment lookup is insufficient. Add a release packaging check that rejects
  a missing or placeholder ID while allowing ordinary debug/test builds.
- T00.4: keep the manual application setup in Development as previously requested;
  production users should not have to register an application. Preserve existing
  nonempty custom IDs rather than silently replacing them.
- T00.5: exercise fresh config, existing empty config, existing custom ID, and
  test-profile isolation. After approval, verify callback cancellation, entitlement,
  token refresh after restart, switch/sign-out, OS credential storage and launch.

**Done:** a fresh candidate signs in through Chest's own approved registration,
existing configurations migrate correctly, and live results are recorded without
tokens. External approval remains an explicit blocker if unavailable.

## T01 — restore trustworthy validation (F1)

**Scope:** `core/src/artwork.rs`, four failing browser scenarios, verification workflow.

- T01.1: make the socket fixture consume the intended framed request using returned
  read amounts. Handle fragmentation and EOF; do not suppress the lint or demand
  an arbitrary full 512-byte buffer.
- T01.2: repair the checkbox scenario to resolve dirty Settings before navigating,
  while retaining keyboard, forced-color and text-scaling assertions.
- T01.3: repair navigation wording and explicitly test Cancel, Discard and Save
  when switching Settings tabs. Do not remove the navigation assertions.
- T01.4: revise draft-preservation coverage to distinguish instance drafts,
  creation drafts, Settings previews, and committed Settings. Assert what survives
  each explicit decision and reload.
- T01.5: make the pending-save scenario dirty before Save; verify repeated submits,
  guarded navigation, failed saves, retry and correct controls after completion.
- T01.6: run focused checks, then the complete verification suite. Let all CI
  platforms finish rather than cancelling the matrix on the first failure, so
  platform-specific failures remain visible. Include all three native library
  tests in routine validation, not only shortcut tests.

**Done:** all automated checks pass on macOS, Windows and Linux without weakened
assertions, increased timeouts hiding failures, or lint exceptions.

## T02 — make measurements reproducible and fail safely

**Scope:** measurement scripts, disposable fixtures and measurement records.

- T02.1: put logs/results outside uninitialized profile directories. Share the
  existing profile initialization procedure rather than duplicating marker logic.
- T02.2: require process liveness and the actual readiness signal before sampling.
  Exit, timeout or missing readiness is a failed sample, never zero CPU/RSS.
- T02.3: terminate/reap only owned processes; close handles and clean only owned
  disposable data. Preserve diagnostics after a failure.
- T02.4: identify main app, associated WebView/GPU/network processes and game JVM
  separately. If process attribution is uncertain, report incomplete totals rather
  than summing unrelated processes or presenting app-only RSS as total memory.
- T02.5: store source/artifact SHA, platform, hardware, tool versions, workload,
  warm/cold distinction, sample count and measurement boundary in each record.
  Cover empty and populated libraries, artwork, screenshots and logs.

**Done:** an intentional early-exit fixture is rejected; successful results can
be repeated; the normal data directory and credentials are never adopted. The
audit-induced crash is documented as a rejected profile plus startup abort, not
a spontaneous normal-profile crash or a valid zero-resource sample.

## T03 — controlled startup failures and recovery (F8; crash follow-up)

**Scope:** native startup/setup, profile/configuration validation and entry point.

- T03.1: identify expected failures before normal window setup: invalid profile,
  unreadable config, inaccessible data path, unsupported isolated-profile platform.
  Represent them with stable categories and concise user-facing messages.
- T03.2: handle those errors through a small startup error path with an accessible
  native dialog and controlled exit. Verify the installed Tauri lifecycle before
  wiring it: returning an error from setup currently causes the abort. Avoid broad
  panic-catching as a substitute for handling expected errors.
- T03.3: preserve the original config and profile restrictions. Never automatically
  clear configuration, adopt an unmarked directory, fall back to normal credentials,
  or start a partially initialized normal UI.
- T03.4: provide useful, sanitized recovery details and a way to retain diagnostics.
  A malformed config should direct recovery to the preserved file; recovery must
  not require a working main application window.
- T03.5: verify malformed config, unmarked nonempty profile, invalid marker, forbidden
  path, and write denial in disposable fixtures. Check exit status, file preservation,
  readable error presentation and absence of an abort for expected failures.

**Done:** the exact audit-script mistake fails clearly without a macOS crash report;
normal startup remains unchanged and failures cannot overwrite user data.

## T04 — accessible shared styling and pixel controls (F3, F9)

**Scope:** Card, hero styles, Button, shared symbols, component consumers, theme tests.

- T04.1: define the action-surface foreground/background pairing centrally. Keep
  actions translucent and blurred over real imagery, using the established overlay
  roles and roughly 80% dark fill where appropriate. Give cards without imagery
  a readable semantic control pairing. Do not add an opaque black layer underneath.
- T04.2: apply image-readability text shadows/scrims only where artwork is present.
  Use plain semantic text colors on image-free light/dark surfaces.
- T04.3: replace Close, More and Check font glyph exceptions with the shared pixel
  symbols. Preserve accessible labels, keyboard behavior and configurable sizing.
- T04.4: review layout switches, tabs, rail controls, dropdowns, dialogs, cards and
  scrollbars together. Keep selected segments pressed/highlighted/inert and
  unselected segments inheriting Button hover/press/focus feedback.
- T04.5: test built-in Light/Dark/System and representative imported schemes across
  bright/dark/missing/broken artwork, hover, pressed, selected and focus states.
  Arbitrary user palettes cannot be guaranteed accessible; keep semantic roles
  and a clear path back to built-in defaults rather than silently rewriting colors.
- T04.6: add the audit's populated light-world reproduction to routine axe coverage.
  Settle transitions before persistent-contrast assertions. Inspect both scrollbar
  axes and fractional scaling on native WebViews, not only Chromium.

**Done:** built-in themes meet applicable text/nontext contrast requirements;
neutral geometry stays independent of schemes; no clipped hover fills, stray tab
bottom borders, opaque action underlays or system-font control glyphs remain.

## T05 — responsive, safe instance filesystem operations (F4)

**Scope:** duplicate/delete native commands, core operation coordination, instance actions.

- T05.1: move recursive work into blocking workers behind async command boundaries,
  following the existing backup/copy pattern. Keep filesystem validation and
  operation ownership in Rust.
- T05.2: make busy ownership cover the entire worker lifetime, including the point
  before execution starts. Reject conflicting launch/edit/delete/duplicate requests;
  do not hold synchronous guards across async waits.
- T05.3: expose a concise pending state and prevent repeated action activation while
  leaving unrelated UI usable. Use existing activity conventions; do not invent
  percentage progress without trustworthy totals.
- T05.4: stage duplication safely and publish only a complete usable copy, or hide
  incomplete state until completion. Roll back owned partial data after failure.
  Deletion errors must retain an accurate record and a clear retry/recovery path.
- T05.5: validate large disposable trees, custom storage, permission errors, busy
  instances and simultaneous conflicting requests. Defer cancellation unless a
  safe rollback/checkpoint model exists; do not interrupt deletion halfway by design.

**Done:** multi-gigabyte operations do not block normal interaction, and failures
cannot expose an apparently complete duplicate or allow conflicting mutations.

## T06 — one close/quit decision path (F8)

**Scope:** frontend navigation guards, native menus, window close/exit events, updater restart.

- T06.1: reuse the existing Settings/creation decisions for native close and Quit.
  Keep one coordinator for pending navigation/exit requests rather than duplicating
  save/discard logic in menu and window handlers.
- T06.2: let clean state close immediately. For dirty state, use the existing dialog
  without ×: Cancel, danger Discard, and Save where the workflow supports saving.
  Creation keeps its own creation/discard semantics; do not invent implicit creation.
- T06.3: wait for pending writes, handle failed saves without exiting, coalesce
  repeated close requests and allow one explicit approved exit without a loop.
- T06.4: distinguish close from quit on each platform. Preserve the documented game
  lifecycle policy; do not silently kill running games or claim to reattach later.
  Integrate active installs/copies and updater restart without bypassing guards.
- T06.5: handle graceful OS shutdown where supported. Document that forced termination,
  power loss and kill signals cannot guarantee a prompt or completed write.

**Done:** close button, menu Close, Quit, shortcuts and supported shutdown routes
agree; failed/pending saves cannot be mistaken for completed preservation.

## T07 — deterministic large collections (F6)

**Scope:** instance file enumeration, screenshots/worlds/background pool, collection contracts.

- T07.1: define stable sort keys, including tie-breakers. Screenshots should order
  by their intended recency key consistently across local/global views; worlds keep
  their documented ordering. Never select the first arbitrary filesystem entries.
- T07.2: return bounded pages or a deterministic bounded selection with explicit
  completeness metadata. Prefer a simple existing-style paging contract; do not
  introduce a database or filesystem index merely to fix the cap.
- T07.3: propagate completeness/page information to collections and the unified
  background pool. Keep navigation hidden for genuinely fitting complete content;
  a truncated result must not masquerade as the whole collection.
- T07.4: handle deleted/added entries during refresh and reset stale page positions.
  Keep symlink confinement and invalid-entry handling intact.
- T07.5: verify more than 1,000 files, ordering ties, shuffled enumeration, missing
  directories, partial failures and cross-instance aggregation.

**Done:** large folders do not silently hide arbitrary recent screenshots/worlds,
and all consumers correctly distinguish a complete list from additional content.

## T08 — bounded image delivery (F5)

**Scope:** native screenshot/artwork service, unified backgrounds, Card/ScreenshotTile/preview.

- T08.1: use one native image derivative path for local screenshot card/background
  uses. Request a display-size/DPR bucket while leaving card dimensions configurable.
  Full-resolution originals are used only for deliberate preview/open/export.
- T08.2: validate dimensions/pixel count and encoded size before expensive allocation.
  Define decode, output and concurrent-work budgets using representative 4K/8K
  fixtures. Originals remain untouched; unsupported previews offer opening the file.
- T08.3: reuse a suitable existing decoder if available; otherwise add only required
  image formats, document the choice, regenerate notices and measure bundle cost.
  Start with bounded IPC thumbnails; introduce another delivery protocol only if
  profiling justifies the additional access-control/lifecycle complexity.
- T08.4: key derivatives by confined source identity, size/modification signature,
  resolution bucket and derivative format version. Bound memory and disk retention,
  share in-flight work, release stale/offscreen references and cancel obsolete work
  where the decoder permits it.
- T08.5: retain provider and screenshot membership in the same background pool;
  only delivery changes. Keep failed-image omission, visibility and reduced-motion
  behavior consistent. Measure remote provider images separately from local derivatives.
- T08.6: verify malformed/huge-dimension PNGs, stale derivatives, removed sources,
  rapid scrolling/navigation, preview close and refresh. Track full process memory
  and image workload concurrency, not just the string cache.

**Done:** cards do not load full-resolution local screenshots; work/retention limits
are testable; repeated browsing settles rather than retaining every visited image.

## T09 — download recovery and safe storage accounting (F7)

**Scope:** shared download helper, modpack/loader callers, app-owned caches, Storage UI.

- T09.1: define partial-file ownership and lifecycle across transport error, write
  error, mismatch, cancellation, interruption and successful atomic publication.
  Remove owned failed temporary files or retain them only under a documented,
  genuinely resumable policy. Preserve verified reusable files.
- T09.2: enforce trustworthy expected sizes when supplied and suitable explicit
  maximums otherwise. Check streamed bytes rather than trusting Content-Length.
  Reject overflow before disk exhaustion and keep final hash verification.
- T09.3: reconcile abandoned partial files safely at a controlled maintenance point;
  never race an active writer. Cover Windows rename/file-lock behavior and low disk.
- T09.4: inventory app size separately from shared binaries/assets, derivative caches,
  partial downloads and instance data. Scan asynchronously on demand, with bounded
  work; do not walk large libraries on every Settings render or double-count roots.
- T09.5: initially allow explicit cleanup only of clearly owned regenerable
  derivatives and inactive partial files, with a concrete size/selection preview.
  Never infer that all shared files are unused when an instance/receipt is unreadable.
- T09.6: design referenced-versus-unused shared-game cache collection separately.
  Implement only if reference analysis is reliable across supported loaders and
  receipts, including offline/custom instances. Otherwise keep inventory available
  and defer shared-binary deletion explicitly beyond 0.1.0.

**Done:** failures recover without orphan growth or lost verified files; accounting
is clear; cleanup cannot remove worlds, active work, credentials or uncertain references.

## T10 — measured library and log improvements (F5, performance follow-up)

**Depends on:** T02, T07 and T08 for comparable realistic measurements.

- T10.1: normalize search queries once, avoid unnecessary repeated instance lookups,
  and profile list recomputation/remounts. Keep keyed identity and keyboard focus.
- T10.2: run empty and populated 100/500/1,000-instance workloads in gallery/list,
  shelves/full pages, with screenshot/background rotation and rapid filtering.
- T10.3: if large-library interaction remains slow, implement the smallest bounded
  rendering change first. Use existing pagination where appropriate; adopt windowing
  only with demonstrated benefit and preserved focus, selection, drag and scroll state.
- T10.4: measure high-volume and multi-instance logs. Add a global byte-aware retention
  policy if per-instance caps still produce excessive memory, preserving useful recent
  diagnostics and explicitly marking omitted content. Avoid silent loss of active logs.
- T10.5: set documented per-platform regression budgets from repeatable populated
  baselines. Separate startup, filtering, frame pacing, idle CPU, total memory and
  retained data; broad five-second smoke checks are not interaction-quality targets.

**Done:** repeated measurements show bounded retention and acceptable interaction;
no complexity is introduced solely to improve an unrepresentative synthetic number.

## T11 — focused maintainability cleanup (F10)

**Depends on:** behavior contracts established by T01/T03/T05/T06.

- T11.1: extract a cohesive Settings/creation navigation-and-exit coordinator, retaining
  each workflow's distinct semantics. App remains the wiring layer.
- T11.2: separate sidebar reorder/grouping and startup subscription lifecycle ownership
  where it reduces duplicated state/cleanup. Reuse existing reorder/visibility helpers.
- T11.3: consolidate modal, form and shared-control CSS by responsibility; remove
  superseded rules only after resolving the actual cascade. Preserve pixel tokens,
  responsive dimensions and theme boundaries.
- T11.4: expand dense touched handlers/styles for readability; keep changes scoped.
  Remove demonstrated dead code/imports, not historical reference assets arbitrarily.
- T11.5: verify public props, persisted formats, cleanup of observers/timers/listeners,
  and visual states after each extraction. Avoid a generic component/state framework.

**Done:** each behavior has a clear owner, touched code is readable, duplicate rules
are reduced and existing workflows remain green without unrelated rewrites.

## T12 — documentation, text and translation alignment (F10)

- T12.1: update current baseline/settings/registration/recovery documentation to the
  final behavior and configuration precedence. Preserve historical dated audit records.
- T12.2: expand acceptance coverage to all six languages, five loaders, new error
  routes, close/quit, cache cleanup and full resource measurement boundaries.
- T12.3: translate new actionable labels/messages through the existing dictionaries;
  verify placeholders, singular/plural/context and native menu/dialog coverage.
- T12.4: retain minimized interface descriptions, consistent Cancel/Discard wording,
  danger styling, and Korean “저장 취소.” Schedule fluent-language review separately
  from automated key-parity validation.

**Done:** current instructions match the candidate; all new text is localized;
historical evidence is not rewritten to imply it validated later changes.

## T13 — repeat audit and produce a candidate for human verification

- T13.1: run the complete frontend/scripts/core/native/browser checks after focused
  checks pass; require complete successful CI results for all supported host OSes.
- T13.2: rerun contrast, keyboard/focus, forced-color, responsive, hover/push and
  reduced-motion coverage; inspect real WebView scrollbar/pixel presentation.
- T13.3: measure warm/cold startup, populated images, copy/delete/install/hash work,
  filtering, scroll pacing, log volume and one-hour idle/running/paused workloads.
  Include associated WebView processes and report JVM costs separately.
- T13.4: build candidate artifacts for macOS arm64/x64, Windows x64 and Linux x64;
  record sizes, hashes and resource inventories. Preserve notices; do not claim
  signed/notarized delivery merely because an unsigned build succeeds.
- T13.5: write a findings disposition: fixed with evidence, awaiting external/human
  verification, or explicitly deferred with reason/risk. Do not silently close F2
  while registration or live sign-in is still unavailable.

**Done:** immutable candidate identity and reproducible evidence are ready. Stop
for human verification; do not tag, publish or consolidate automatically.

## T14 — human verification before consolidation

- T14.1: run unfamiliar-user tasks on the actual candidate: create/play, add content,
  recover failure, inspect logs, find screenshots, back up a world and edit settings.
- T14.2: verify native authentication, file pickers, credential storage, shortcuts,
  menus, close/quit, DPI/zoom, keyboard-only use and screen readers on actual targets.
- T14.3: verify compatible Vanilla/Fabric/Quilt/Forge/NeoForge gameplay and offline,
  disk-full, wrong-Java, interrupted-download and custom-storage recovery scenarios.
- T14.4: verify artifact signing/notarization as applicable and an isolated signed
  update A → B, signature rejection, restart and preserved data. Never use the
  normal irreplaceable library to test failure paths.
- T14.5: record tester/device/build SHA, result, evidence and issue for each scenario;
  fix failures and repeat affected checks. Establish minimum supported OS versions
  from actual successful testing.

**Done:** human results and remaining limitations are reviewed. Consolidation is
a later explicit decision, not a side effect of completing this task list.

## Delivery checkpoints

| Checkpoint | Required evidence | Work that must remain explicit |
| --- | --- | --- |
| A: dependable development baseline | T01/T02 green, trustworthy failure reporting | Platform CI failures are still failures |
| B: core behavior repaired | T03–T09 targeted checks, F3 contrast reproduction fixed | T00 approval/live auth may still be pending |
| C: maintainable measured candidate | T10–T13 complete, documented findings disposition | No guessed total-memory/CPU or signing claims |
| D: human acceptance | T14 records for candidate artifacts | Release/consolidation requires subsequent review |

Recommended 0.1.0 scope includes the definite correctness, accessibility and recovery
fixes; bounded thumbnails; deterministic listing; and conservative partial-file/cache
handling. Full shared-game cache garbage collection and virtualization remain
conditional on safe reference analysis and measured benefit. This avoids expanding
the finalization work into a new launcher architecture.
