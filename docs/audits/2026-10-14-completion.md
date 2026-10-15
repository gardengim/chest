# 0.1.0 completion and human-verification handoff

Started 2026-10-14; automated completion 2026-10-15 (America/Los_Angeles).
**Automated work completed. Owner verified unlocked Mac startup and both reported crash paths; remaining device acceptance is paused for human verification.**
A subsequent [button-rendering follow-up](2026-10-15-button-rendering.md) addresses
issues found during owner visual review; the historical candidate below retains its identity.

Application source candidate:
`8c69ee459d1ac944c88d6d653b3aab7fb2ea0a50`. Measurement records below identify their own source revisions;
the sustained idle sample predates the final focus and pending-operation fixes.
Local scripted verification/build uses `13316b4`; its application/build inputs match
the installer source, with only test/tooling/docs changes. The latest test-only
follow-up (`2156456`) measures toolbar geometry in one browser task to avoid cross-frame drift.
No tag, public release or consolidation is authorized
by this record.

## Engineering completion

| Item | Resolution | Evidence |
| --- | --- | --- |
| World Play / server Join abort | Resource launch is an async native command. Core obtains a runtime before reserving work and returns an ordinary error if called without one. | Runtime-less and asynchronous failure regressions; full core suite. Actual authenticated world/server entry is the first human task. |
| Home navigation and Windows text clipping | Preserve fixed drag layout only during reorder reveal; keep a chosen shelf aligned through lazy layout growth until manual input; allow dock clearance. Shared heading line boxes and inline-block count badges accommodate system fonts. | Home, responsive and card regressions, including narrow last-shelf navigation. |
| Validation failures | Preserve assertions; synchronize the toolbar measurement with rendered controls; correct CRLF fixture mutation and license line-ending comparison. | Complete local verification and platform CI below. |
| Abandoned downloads | New `.chest-part-UUID.download` files have an explicit ownership contract. A directory-level OS lock excludes cooperating writers in other processes; before a new write, reconcile owned orphans under that lock. | Lock exclusion, process exit without destructors, symlink/legacy preservation, download error/retry tests. No age-based guessing. |
| Large cached-file hashing | Check reusable files on blocking workers, sharing the verification helper before and after acquiring download ownership. | Download/retry/cache-hit tests and strict Clippy. |
| Log bursts | Pending frontend batches now have a global 16 MiB string budget, 2,000 lines/session and 1,000 pending sessions, plus omission markers. Disposal cancels the callback and releases pending strings. Native and displayed histories retain their independent bounds. | Burst, distinct-session and disposal tests; 100,000-line native workload. |
| Navigation ownership | A small reusable decision owner coordinates Settings, creation and exit requests. Save/create semantics remain distinct. Root App wires callbacks; log batching owns its timer and buffers. | Existing Settings, creation, native-menu and updater regressions remain intact. |
| Pending file operations and recovery | Copy/delete publish working state through the existing activity channel, disable conflicting mutations, and restore terminal state when done. Failed deletion preserves the record for retry and background refresh cannot erase its error. | Reservation/recovery tests, deletion retry after config-write failure, and browser pending/error persistence regressions. |
| Production modal focus | Return focus to the connected invoking control after a dialog is removed. | Production-asset keyboard/focus regressions. |
| Portable candidates | Build all four unsigned installer targets without release publication or signing secrets. Upload installers and inventory, excluding expanded platform staging trees. | Four-target build and download checks below. |

## Conditional decisions and implementation limits

- **Directory paging:** keep complete, deterministic enumeration on blocking workers
  and existing bounded card pagination. The 50,000-file workload verifies completeness
  and records enumeration cost on each host. A new directory index or paging protocol
  is not justified by these observations. No arbitrary pre-sort cap is restored.
- **Shared-game garbage collection:** retain shared binaries, assets and Java runtimes.
  Custom/offline loaders and legacy files do not provide a reliable complete ownership
  and reference ledger. Storage inventory and generated-image cleanup are functional;
  uncertain files are intentionally outside deletion. A full shared-game garbage
  collector is **not implemented**; accepting this conservative scope is part of
  the human review before consolidation.
- **Legacy download files:** preserve old ambiguous names. Only newly marked partials
  participate in reconciliation. Reconciliation is lazy at the next write in the same
  directory; it does not claim to scan every historical folder at startup.
- **Further App/sidebar restructuring:** the duplicated decision checks and pending-log
  lifetime have clear owners now. Existing reorder helpers and keyed sidebar lookups
  remain. A broad sidebar/state rewrite has no demonstrated correctness or performance
  benefit for this candidate and is excluded from this completion scope.
- **Virtualization:** retain existing 24-card pagination. Sidebar cost still scales with
  library size; synthetic measurements expose that limitation rather than hiding it.

## Repeatable procedure

Use the [candidate verification SOP](../audit-sop.md) and the single
`npm run audit:candidate` entry point. Its local mode runs verification/build in
sequence, records source and dirty files, and stops on failure. Collection validates
run success/source, all installer hashes and native readiness before writing the
human handoff. [Verified handoff](evidence/2026-10-14-remediation/completion-handoff.json)
records all run identities and the exact collector/inspector hashes. Repeated inspection and evidence summaries are now checked-in tooling.

## Automated verification

Local scripted run (`13316b4`, final application inputs): **174 browser tests, 100 core tests, 3 native library tests and
24 script tests pass**. Svelte reports **0 errors, 0 warnings**. Strict core Clippy,
native compilation, frontend build, release configuration and dependency-license
checks pass. [Full local output](evidence/2026-10-14-remediation/completion-validation.txt).

Final application [three-platform check](https://github.com/gardengim/chest/actions/runs/38737664009):
**passed on Windows, macOS and Linux**. UI workflows use compiled production assets;
source-module contracts run separately. All three run the 24 script, 100 Core,
3 native library and 174 browser tests. Failure traces are retained. The final dock
clamp follows its actual CSS size during expansion without asynchronous observer lag.
The final toolbar alignment assertion also reads both boxes in one browser task;
lazy shelves cannot move the page between those measurements.
Superseded failures and interrupted local runs are not counted as passes.

Final [portable installer builds](https://github.com/gardengim/chest/actions/runs/38736216868)
and [offline resource workloads](https://github.com/gardengim/chest/actions/runs/38735836497)
passed on every target. All downloaded installer sizes/hashes match their inventories.
Read-only DMG verification confirms both Mac payload architectures and version 0.1.0;
Debian metadata and AppImage ELF headers confirm Linux x64. Actual Windows/Linux
installation and gameplay remain native-device acceptance, not a static-file claim. The earlier four-target build also passed, but its
expanded Linux staging tree caused case-sensitive path collisions when downloaded onto
macOS. The corrected upload contains only installers and their inventory.

Packaged macOS negative cases at the sustained-sample revision (`2326cb2`) all exit **1**, preserve their original files,
and do not abort: unmarked nonempty profile, invalid marker, malformed config and
write denial. Isolated trace mode intentionally suppresses native dialogs during these
checks; human acceptance must inspect the actual error dialog.

The [packaged native startup run](https://github.com/gardengim/chest/actions/runs/38737535142)
passed using the final installer payloads and isolated profiles on all three
native CI hosts, for empty and 1,000-instance libraries (three samples each).
Linux runs under Xvfb with an actual D-Bus/accessibility session; the original
headless environment lacked that service and timed out. Windows now tolerates
already-removed WebView files and waits at most ten seconds for observed sharing-lock
teardown races, while retaining the original readiness deadline and failing other errors. It does not replace real Intel Mac,
minimum-OS, sign-in, screen-reader or gameplay acceptance.

| Native CI host / installer payload | Empty median | 1,000-instance median |
| --- | --- | --- |
| Windows x64 | 2,973 ms | 1,009 ms |
| Linux x64 (Xvfb + D-Bus) | 683 ms | 1,082 ms |
| macOS arm64 (virtual runner, mounted DMG) | 6,323 ms | 4,691 ms |

Three sequential samples per case; no controlled cold/warm classification. The
1,000-instance case initializes an empty profile before populating it, so the
lower Windows/Mac results are not evidence that a larger library improves startup. These
virtual hosts and mounted/extracted payloads do not establish user-device budgets.
[Native startup source identities and samples](evidence/2026-10-14-remediation/completion-native-startup-summary.json).

## Resource and artifact evidence

Local Apple M5 / 16 GiB / macOS 27.0.1 arm64. Isolated profiles and disposable data;
normal accounts and library are not used. Workloads are diagnostics, not performance
budgets or controlled comparisons with earlier audits.

- 50,000 screenshot metadata entries: three runs; all 50,000 returned.
- 2 GiB streamed local HTTP download: exact size and SHA-256 verified.
- 2 GiB duplicate: destination hash verified; deletion preserves source. APFS may clone
  files, so the very short copy time is not a physical disk-throughput claim.
- 100,000 lines across 100 sessions: 819,200,000 input bytes; retained history stays
  within the native byte budget plus omission markers.
- The fixture measures Core work, not GUI responsiveness or real provider installation.
  Timing can include host contention and does not establish target-device UX acceptance.

[Earlier local diagnostic samples](evidence/2026-10-14-remediation/completion-workloads.jsonl)
are retained for context; their raw JSONL did not record a commit, so they are excluded
from final-source acceptance. The table below uses explicitly identified CI evidence.
The separate three-host run records source, CPU, memory, architecture and Rust version.
It passed on all hosts at `e883725`, including the final file-operation activity changes.
The later candidate changes only the Home dock; its Core tree and resource workflow match exactly.
Rust 1.99.0; virtual M1/7 GiB/3 CPUs, Windows EPYC 7763/16 GiB/4 CPUs,
and Linux EPYC 9V74/about 16 GiB/4 CPUs.
Exact CPU and memory values remain in each host record.

| CI host | 50k enumeration median | 2 GiB SHA-256 | Verified local download | Duplicate | Delete duplicate | 100k logs |
| --- | --- | --- | --- | --- | --- | --- |
| Linux x64 | 140 ms | 1.33 s | 1.43 s | 7.05 s | 201 ms | 0.87 s |
| Windows x64 | 1993 ms | 1.68 s | 4.66 s | 21.55 s | 138 ms | 1.41 s |
| macOS arm64 | 173 ms | 9.13 s | 7.91 s | 0.92 ms | 66 ms | 2.16 s |

All three retained 16,730,164 bytes of native history including omission markers.
These hosts/filesystems differ; the table is not a ranking or a physical copy-speed
comparison. macOS cloning and ARM hashing paths especially affect interpretation.
[Host metadata and raw samples](evidence/2026-10-14-remediation/).

The sustained idle measurement used source `2326cb2`, with a local `.app` of
**13,068,642 logical bytes (12.46 MiB)**. Executable: **12,820,288 bytes**;
SHA-256 `0b44fc3496ee7948e73121d228286ac33b52b44d6e832470c50c025356a84903`.
[Idle artifact identity](evidence/2026-10-14-remediation/completion-idle-artifact.json).
The final rebuilt candidate (`13316b4`, identical application/build inputs to `8c69ee4`)
is **13,069,522 logical app bytes**, executable **12,821,168 bytes**, SHA-256
`88d904efdd5a64d134ecd45f616f3e7c58af799a1d2386703663c2e4e9882857`.
It has a separate [identity record](evidence/2026-10-14-remediation/completion-local-candidate.json).
This refers only to the rebuilt `.app`; adjacent historical updater archives/signatures
are not this candidate. Linker ad-hoc signature, no TeamIdentifier, no sealed resources:
**not distribution signed or notarized**. Embedded frontend bytes are not added again
when reporting installed app size.

| Final CI installer | Compressed bytes | Notes |
| --- | --- | --- |
| macOS arm64 DMG | 5,697,661 | Installed `.app`: 14,192,162 logical bytes |
| macOS x64 DMG | 5,830,271 | Installed `.app`: 14,052,058 logical bytes |
| Windows x64 NSIS / MSI | 3,838,340 / 5,419,008 | Alternative installers, not additive |
| Linux x64 deb / rpm | 5,841,318 / 5,841,984 | Require system GTK/WebKit libraries |
| Linux x64 AppImage | 83,950,072 | Includes portable runtime dependencies |

CI uses Rust 1.99.0; the local candidate uses Rust 1.95.0. These are distinct
artifact builds with separately recorded source revisions and hashes.
Do not equate compressed installer size with installed logical or allocated size.
[Verified installer hashes](evidence/2026-10-14-remediation/completion-artifact-verification.json)
and [static inspection](evidence/2026-10-14-remediation/completion-installer-inspection.json).

The separately identified `2326cb2` local executable completed **60.87 minutes** of empty-library
idle sampling after a five-second settle. Main-process mean/peak RSS:
**19.63 / 93.78 MiB**; **0.0047%** of one CPU core.
The companion group observation spans **59.35 minutes**, beginning
after readiness: mean/peak physical footprint **124.90 /
125.94 MiB**, CPU **0.0079%** of one core;
RSS **26.73 / 33.98 MiB**. RSS excludes compressed
memory and includes shared mappings; it is not interchangeable with physical footprint.

The group covers main, profile-UUID-confirmed WebContent/networking, and a GPU process
inferred from exclusive new-process timing and confirmed owner-exit lifetime. All
tracked processes exited; sampling reported no errors. Transient OS helpers, observer
overhead, unrelated apps and JVM are excluded, so `processTreeComplete` remains false.
Host contention/window visibility/lock state were not controlled; some other audit activity ran
during the early samples. There is no universal foreground, sustained-game or whole-system
memory/CPU guarantee. Both disposable Core and UUID-owned WebView directories were
confirmed removed. The superseded, intentionally interrupted run is not accepted as
an hour sample. [Full dated samples](../measurements/2026-10-15-completion.json).
No running/paused game or JVM resource claim is made from an empty-library idle run.

## Local foreground verification boundary

After the successful sustained sample, a supplementary sequential local startup
repeat did not reach the paint-ready signal within 30 seconds (setup, Core and
window construction completed). Exact-PID activation and an explicit isolated
LaunchServices launch were attempted; neither produced a painted-library signal.
The native UI tool then confirmed the Mac was locked and could not be unlocked
automatically. These attempts are **rejected measurements**, not zero-resource
results or proof that the foreground app is usable. The successful CI startup
samples remain separately identified. The idle record is not a controlled
unlocked/foreground baseline. No password was requested or lock protection bypassed.
All owned probe processes and disposable data were stopped/cleaned.

**Foreground gate resolved (owner report, 2026-10-15):** normal launch on the
unlocked Mac worked. The earlier locked-desktop probes remain rejected measurements;
this confirmation does not turn them into valid startup timings.

## Reported keychain prompts — under investigation

The owner reports roughly three macOS authorization prompts per game launch for
Chest's own `Chest Minecraft` keychain item. Authentication reads the saved refresh
token, then saves a rotated token; the macOS keyring backend also looks up the
existing item before updating it. Multiple protected operations may prompt when
access is allowed only once. The owner clarified that Always Allow works, but
prompts eventually return. Whether recurrence coincided with a rebuilt/replaced
binary is not established. No credential contents or keychain password were inspected.

The current local app has an ad-hoc designated requirement tied to its code hash.
Changed builds may require authorization again; stable distribution signing remains
an owner-controlled acceptance gate. See [Apple's keychain permission guidance](https://support.apple.com/en-ie/guide/keychain-access/kyca1243/mac)
and [code signing requirements](https://developer.apple.com/documentation/technotes/tn3127-inside-code-signing-requirements).
This is a diagnosis in progress, not a confirmed fix or completed credential-lifecycle check.

## Human verification — stop here after automated completion

### Owner-confirmed results — 2026-10-15

The owner confirmed normal unlocked foreground launch, then confirmed that both
previously reported crash paths work. The locally launched `.app` executable hash
was rechecked as `88d904efdd5a64d134ecd45f616f3e7c58af799a1d2386703663c2e4e9882857`
(the `13316b4` local build identified above). These are owner-reported functional
results on this Mac, not installer acceptance on all targets or measured startup times.

| Scenario | Result | Evidence |
| --- | --- | --- |
| Unlocked Mac, normal foreground launch | Pass | Owner: “unlock and launch normally, worked.” |
| Home → Worlds → instance → Play | Pass | Owner confirmed both requested launch paths work. |
| Home → Servers → instance → Join | Pass | Same confirmation; no reported recurrence of the abort. |
| Minecraft launch failure leaves Chest usable | Pass | Owner reported a Minecraft graphics-related launch crash while Chest stayed usable. Graphics cause not independently verified. |
| Launch again after a Minecraft crash without restarting Chest | Pass | Owner confirmed about seven repeated launch attempts through Chest. |
| Unsaved Settings Save / Discard / Cancel | Pass | Owner confirmed the described flow works. |
| Keyboard navigation and dialog focus | Pass | Owner confirmed Tab/Shift+Tab, selectors, focus trapping and restoration work. |
| Theme/view-switch visual review | Follow-up needed | Owner found inconsistent glyph thickness and transient content shadow loss; see rendering follow-up. |

The owner reports the same Minecraft graphics crash in Prism; it is tracked as
a separate game/environment issue outside Chest finalization blockers.
The remaining authentication, native screen-reader/accessibility, visual,
platform, gameplay/recovery and distribution checks below remain unverified.


Use the exact installer hash in the attached inventory and the
[packaged acceptance record](../ACCEPTANCE.md). Record device/OS, tester, hash,
result and evidence for each task. Test disposable worlds and profiles.

1. **Passed on the owner’s Mac:** unlocked normal launch, Home → Worlds → instance → Play,
   Home → Servers → instance → Join, and repeated launch after Minecraft crashes.
   Chest remains usable. No further repetitions of these checks are requested.
   The reported Minecraft graphics crash remains a separate unresolved issue.
2. **Live authentication:** Chest's own application ID, cancel sign-in, entitlement,
   refresh after restart, switch/sign-out, OS credential storage and actual gameplay.
   The owner reported successful sign-in; that is not evidence for every lifecycle route.
3. **Native interactions and accessibility on all four targets:** installer/reopen,
   menus/shortcuts/file pickers; keyboard-only and screen-reader operation; focus and
   modal behavior; close/quit/restart with dirty drafts, failed/pending saves and jobs.
4. **Visual review:** Light/Dark/System and imported schemes; both pixelated scrollbar
   axes; hover/pressed/selected tabs, radio segments and card actions; narrow windows,
   200% text and fractional DPI. Fluent review of all six languages remains human work.
5. **Gameplay/recovery:** compatible Vanilla, Fabric, Quilt, Forge and NeoForge;
   modpacks, backups/archive roundtrip/custom storage; offline/wrong Java/low disk;
   interruption/retry/pause/resume; multi-gigabyte work while using the UI. Measure
   running and paused sessions and JVM costs separately from launcher processes.
   Verify copy/delete pending controls, failed deletion retry, and error persistence.
   Include populated native 4K/8K/provider artwork, scroll pacing and complete process
   attribution; the automated empty-library group is not a substitute for that workload.
6. **Distribution/update acceptance:** configure signing credentials through the owner,
   sign/notarize as appropriate, and verify an isolated signed update A → B, rejection
   of a modified artifact, restart and data preservation. Repository secret-name
   inspection returned no configured signing secrets. No private key was read/uploaded.
   Unsigned candidate success cannot satisfy this gate or establish minimum OS support.

No consolidation, tagging or publication follows automatically from this handoff.

### Subsequent UI refinements — October 15

The [RTL and instance settings report](2026-10-15-rtl-settings.md) records the newer application revision `b91e552`, its local build identity, all seven requested refinements, final validation and the remaining human checks. It supersedes earlier UI build identities for this round of owner verification. Existing confirmed authentication and game-launch results remain applicable; this follow-up does not authorize release consolidation.
