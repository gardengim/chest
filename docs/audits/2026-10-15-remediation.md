# Final-audit remediation — 2026-10-15

Application fixes: `8edb23b47e01df4b244afe4cb46134fef083afbc`.
[Task breakdown](2026-10-15-fix-tasks.md); [original findings](2026-10-15-final-release-audit.md).

All six findings have implementation changes and local regression evidence. Release
acceptance remains pending; this report does not approve publication.

| Finding | Change | Remaining acceptance |
| --- | --- | --- |
| A1: WebView compatibility | Bundle minimum and release preflight require macOS 14.0. README/baseline state the runtime policy. The packaged plist and compiled deployment target both read 14.0. | Real macOS 14 device on each architecture; accepted Windows/Linux WebView versions |
| A2: artwork payload | PNG/JPEG/WebP decode is bounded by 2 MiB input, 4,096-pixel axes, 4 million pixels and 32 MiB decoder allocation. Derivatives fit 128×128 and 96 KiB; responses cap artwork strings at 8 MiB and 512 icons. The existing thumbnail cache/lock is reused. Original artwork is preserved; missing/rejected/over-budget icons use the existing fallback. | Representative native libraries and complete app/WebView memory observation |
| A3: UI-thread filesystem work | Settings, instance/content/bookmark/account mutations and configuration/folder reads use async commands with a shared blocking-worker helper. Sign-out credential work also runs on a blocking worker. Validation and response shapes are retained. | Slow external storage on packaged devices |
| A4: collection rendering | Shared 24-item page size and existing Pagination bound resource/content views. Shelves show 24 and offer View all. Filtering covers all records before paging; refresh clamps pages; deep links reveal the page before focus. Owner/folder maps replace repeated linear searches. | Human keyboard/navigation review on large real libraries |
| A5: loader failure announcement | Stable error ID, alert role, invalid state and field description; Retry returns focus to the stable loader control and does not steal focus on completion. | VoiceOver/NVDA/Orca announcement and reading order |
| A6: documentation | README, baseline, release guidance and acceptance template describe bundled Microsoft identity, debug-only override, appearance modes, paired schemes, seven languages/RTL, current labels/guards and runtime requirements. | Complete the acceptance template; no human scenarios were marked passed automatically |

The macOS floor is a support-policy choice, not an old-engine polyfill. Safari 17
introduced Popover, a dependency of the shared dropdown and toolbar controls;
macOS 14 provides that generation of WebKit. See [WebKit's Safari 17 notes](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/).
Older macOS versions are outside this packaging policy. Passing a newer WebKit runner
cannot substitute for checking the actual minimum device.

## Local verification

The existing sequential `audit:candidate local` SOP passed:

- 195 Chromium browser tests, including six prevention tests for these findings.
- 103 Core tests, including padded-icon, format/dimension/cache and aggregate-budget tests.
- 4 native tests, including a single-threaded async runtime staying responsive while
  a worker waits on storage and then persists a real configuration change.
- 26 script tests, Svelte with zero errors/warnings, strict Core Clippy and license checks.
- Separately: 13 Retina WebKit tests covering paging, loader errors, focus rings and toolbars.

A 1,000-world/1,000-server browser fixture now renders 24 cards per Home shelf,
instead of 2,000 at once. Search finds the final item; 49-item tests exercise last pages,
refresh clamping and off-page world/server focus. The 100-icon padded-input test now
returns less than 1 MiB of encoded thumbnails, compared with the original audit's
133.34 MiB response. High-entropy derivatives exercise the 8 MiB byte budget separately
from the 512-icon limit. These are prevention/stress fixtures, not typical-user averages.

[Sanitized verification output](evidence/2026-10-15-remediation/verify.txt),
[build output](evidence/2026-10-15-remediation/build.txt),
[local artifact identity](evidence/2026-10-15-remediation/local-candidate.json).
The final SOP run started from the committed application revision; only documentation
and evidence were uncommitted. The final executable SHA-256 is
`d31de7e12c11a517c5b15b66621c9483f5491f1992a6a17bb6a369d1b3514a3d`;
logical `.app` size is 13,779,033 bytes (13.14 MiB). The SOP now applies an ad-hoc local
bundle signature automatically; `codesign --verify --deep --strict` passed. This fixes
an incomplete local signature found during the first build. The app is neither
distribution-signed nor notarized.

A final timing regression reproduced metadata arriving after a page change and
sending the user back to the highlighted world's page. The fix derives the highlight's
page independently of metadata, so unchanged location data cannot undo navigation.
The new regression passes alongside all other tests.

## Supplemental measurements

The reusable native startup script now accepts `--icons`. On the preceding fix revision
`f4c92c7` (before the page-choice correction), with 100 valid padded icon
files and three samples, library readiness had a median of **469 ms** (465–489 ms).
Readiness precedes background icon loading. After a five-second settle, three 20-second
observations recorded main-process mean RSS **104–119 MiB**, peak **118.88 MiB**, and
CPU **0.05–0.10%** of one core. These exclude WebView/GPU/network processes and JVMs;
no cold/warm classification or whole-app leak conclusion is justified.
[Sanitized observations](evidence/2026-10-15-remediation/native-icons.json).

The final revision's local native timing repeat reached window construction but did
not acknowledge a rendered library within 30 seconds. The desktop lock state was
confirmed true. That attempt is **incomplete**, not a zero-duration or successful
performance sample, and the preceding binary's timings are not transferred to the
final binary. [Recorded boundary](evidence/2026-10-15-remediation/native-final-locked.json).
An unlocked-desktop check remains part of human acceptance.

A separate disposable Chromium sample of the final revision includes 100 distinct valid 128×64 thumbnail
fixtures alongside 1,000 worlds, 1,000 servers and 1,000 mods. It requests GC before
recording JavaScript heap: Home used 11,358,416 bytes (10.83 MiB), and Contents
12,094,532 bytes (11.53 MiB). It does not measure total browser/native memory.
[Results](evidence/2026-10-15-remediation/browser-resources.json),
[reproducible diagnostic](evidence/2026-10-15-remediation/browser-measurement.spec.ts.txt).
The diagnostic source was removed from `tests/` afterward so it cannot change the
normal regression suite or preserve assertions of historical defects.

## Platform verification

- [Check Chest](https://github.com/gardengim/chest/actions/runs/38835792205): passed on Windows, macOS and Linux.
- [Verification installers](https://github.com/gardengim/chest/actions/runs/38835811255): passed on all four targets.
- [Offline resource workloads](https://github.com/gardengim/chest/actions/runs/38834381175): passed on all three hosts. This uses `f4c92c7`; its Core tree and resource workflow match the final revision exactly.

- [Packaged native startup](https://github.com/gardengim/chest/actions/runs/38836801272): passed on macOS arm64, Windows x64 and Linux x64, with three samples each for empty and 1,000-instance profiles. Intel Mac remains a real-device acceptance item.

The existing collector verified exact source/build inputs, all installer sizes/hashes,
DMG integrity/architecture/version/**macOS 14.0 minimum on both Mac architectures**,
and Linux package headers. [Verified handoff](evidence/2026-10-15-remediation/handoff.json),
[installer inspection](evidence/2026-10-15-remediation/installer-inspection.json),
[artifact hashes](evidence/2026-10-15-remediation/artifact-verification.json),
[startup summaries](evidence/2026-10-15-remediation/native-startup-summary.json),
[resource workload results](evidence/2026-10-15-remediation/resource-summary.json).
CI process-to-library readiness medians (three samples per cell):

| Packaged host | Empty profile | 1,000 instances |
| --- | --- | --- |
| macOS arm64 | 6,321 ms | 3,101 ms |
| Windows x64 | 977 ms | 1,036 ms |
| Linux x64 | 748 ms | 1,183 ms |

These observations have no controlled cold/warm classification or contention isolation;
the slower Mac CI result needs representative-device review and is not evidence of a
specific code regression or an overall startup-speed improvement.

These CI startup samples are their own packaged artifacts and GUI environments, not
the locked local desktop's incomplete run or proof of minimum-device accessibility.

## Human handoff

Verify the rebuilt app's resource paging/search/deep links, loader-error announcement
and retry focus, and settings/account/content actions. Test the minimum macOS version,
Windows/Linux native behavior, signed updates and native assistive technology on the
appropriate devices. Previously owner-confirmed launch paths remain recorded in the
completion report; no repeated sign-in or game crash screenshot is required here.

No normal profile, credential, world or release tag was modified. No release was published.
