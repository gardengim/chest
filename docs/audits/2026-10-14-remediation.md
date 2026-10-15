# 0.1.0 remediation results

**Superseded status:** the staging/push approval-review limit was resolved. The
launch and navigation fixes are pushed in `29e8e0b`; download ownership, pending
log bounds and shared navigation decisions follow in `cd6f528`, with readiness
and cached-hashing corrections in `e1da5de` and `f3d21e0`. See the
[completion record](2026-10-14-completion.md) for current results and human gates.
Measurements below remain historical and identify their original candidate.

Implementation: `a7fb491e371b53b97b9dad80351a842ba20e5ce2`.
Cross-platform fixture/measurement follow-up: `73a6863a97fe94472917aae2ac7520c56f9a4ad9`.
License line-ending follow-up: `12fea8232ef8f09b3a2a38422c369173131fa19c`.
System-font heading/visibility-test follow-up: `10aced09aeffcd1b47e773244aa7979f3582766f`.
The listed commits are pushed to `main`, followed by fixture correction `1feb9dc`.
No tag, release publication or consolidation was made.
This record supplements the [original audit](2026-10-14-finalization.md) and
[task plan](2026-10-14-remediation-plan.md); it does not rewrite historical evidence.

## Initial findings disposition (historical baseline)

| Finding | Minimal implementation | Evidence and remaining limits |
| --- | --- | --- |
| F1: validation | Consume framed socket requests correctly; update stale Settings scenarios; include all native library tests; let every OS matrix job finish. Repair the Windows CRLF fixture and assert it actually mutates the file. | Local full suite passes. Cross-platform CI status is recorded below. |
| F2: release sign-in | Compile Chest's supplied public client ID; preserve explicit custom IDs; migrate empty IDs; validate release configuration. | Owner reports successful sign-in and apparent approval. Refresh, entitlement, account switching/sign-out, OS credentials and actual launch still require live acceptance. |
| F3: contrast | Pair translucent 80% black card actions with light foregrounds; remove image-readability shadows on surfaces without images. | Settled light/dark populated-world accessibility regressions pass. Arbitrary imported schemes still need contrast review. |
| F4: blocking file work | Run duplicate/delete through blocking workers; reserve conflicting operations using existing job coordination; remove incomplete copies on failure. | Reservation/copy failure tests pass. Multi-gigabyte responsiveness and disk-full behavior need actual target-device verification. |
| F5: images, libraries, logs | Bounded PNG derivatives; dimension/input/allocation/concurrency limits; cache eviction; release offscreen image references; max 24 instance cards with pagination; normalize filters; byte-aware global log retention. | Thumbnail/original/cache/oversize, browser delivery and log tests pass. Full WebKit/GPU image memory and long active-log sessions remain unmeasured. |
| F6: truncation | Remove the arbitrary pre-sort 1,000-file cap; return complete enumeration with stable screenshot/world ordering. | More-than-1,000-entry regression passes. Complete metadata enumeration still grows with folder size; backend directory paging is deferred. |
| F7: storage/download recovery | Owned unique partial files clean up on ordinary error/cancellation; validate streamed sizes/hashes; on-demand bounded storage inventory; confirmed generated-image-cache cleanup. | Failure/retry/destination-preservation and cleanup tests pass. Hard process termination can leave partials; automatic orphan reconciliation and shared-game garbage collection remain deferred for safety. |
| F8: startup/exits | Expected setup errors show diagnostics and exit cleanly without replacing config. Close/Quit/updater restart use frontend draft and pending-operation decisions. | Invalid-profile and malformed-config packaged tests exit 1 without aborting; their original files remain unchanged. Guard tests pass. OS forced termination cannot guarantee a dialog or save. |
| F9: pixel symbols | Replace remaining Close/More/Check font glyph controls with shared icons. | Existing pixel/hover/responsive tests pass. Native zoom, fractional DPI and scrollbar presentation require actual WebView inspection. |
| F10: maintainability/docs | Share unsaved-change dialogs; consolidate modal styling; use small image/log/storage/lifecycle modules; update current docs, acceptance coverage and new labels in all six languages. | Svelte and localization checks pass. App remains the wiring/state owner; a broad sidebar/subscription/state rewrite was avoided. Fluent translation and screen-reader review remain human work. |

## Validation

- Full local verification: **173 browser tests**, core tests, strict core Clippy,
  native compile/library tests, frontend build, release/configuration and license checks.
- Final core suite after the added reservation regression: **93 passed**.
- Native library: **3 passed**. Final script suite: **16 passed**.
- Svelte: **0 errors, 0 warnings**. Focused image/exit/updater/responsive checks
  also passed after their final changes.
- Initial implementation CI: Linux and macOS passed; Windows failed because its
  stale-version test fixture assumed LF and never changed the file. The follow-up
  explicitly uses CRLF locally and asserts mutation before testing rejection.
- The next Windows run passed the fixture, then exposed LF/CRLF differences in
  the license comparison. Normalize only line endings, retain exact content checks,
  and cover both equivalent endings and changed text with a regression test.
- That run passed native checks on all hosts and all browser checks on Linux.
  Windows exposed tight `h1` line boxes with its system font; use a shared 1.3
  line-height without weakening the clipping assertions. macOS exposed a clock test
  racing the visibility observer; wait for intersection plus a frame before advancing.
  All 14 local responsive/card scenarios pass after the fixes.
- Latest [three-platform CI](https://github.com/gardengim/chest/actions/runs/38686560132):
  pending at the time this record was drafted; final status must be checked before consolidation.

## Resource measurements

Device: Apple M5, 16 GiB RAM, macOS 27.0.1 arm64. Node 26.11.1, Rust 1.95.0,
Google Chrome 155.0.8059.40. [Raw records](../measurements/2026-10-14-remediation.json)
include samples, boundaries and artifact identity. No normal library/credentials were read.

| Packaged native workload | Result | Boundary |
| --- | --- | --- |
| Empty library, 3 sequential launches | 1,342.4 ms median; 1,229.8–2,947.6 ms range | Parent process creation to library-rendered IPC after two frames |
| 1,000 synthetic instances, 3 launches | 1,636.3 ms median; 1,462.8–1,770.1 ms range | Same boundary, synthetic configuration; no custom artwork |
| Empty-library idle, 30.5 seconds after 5-second settle | 0.065% of one CPU core; 78.12 MiB mean / 103.20 MiB peak RSS | **Main process only**; excludes WebKit/GPU/network subprocesses and game JVM |

These are sequential launches, not controlled cold/warm trials. Earlier raw executable
launches failed to produce readiness and were excluded. The bundled executable renders
correctly. Its timings are not directly comparable with the historical bare-executable
measurement, despite identical executable bytes. No native startup speedup is claimed.

Production-browser results, seven isolated-context samples per library size:

| Instances | Median ready | Median filter | Median initial DOM nodes | Median initial JS heap after GC |
| --- | --- | --- | --- | --- |
| 100 | 227.0 ms | 22.4 ms | 956 | 4.55 MiB |
| 500 | 291.4 ms | 37.1 ms | 2,956 | 9.29 MiB |
| 1,000 | 361.7 ms | 33.4 ms | 5,456 | 15.18 MiB |

Only 24 main cards mount; sidebar entries still scale with the collection. This is
mocked IPC without real images/network/game work. The historical 1,000-instance sample
was 196 ms ready, 185 ms filter, 15,114 nodes and 36.03 MiB heap. Filtering/rendered
retention improved in these observations; browser startup did not. Different sampling
and startup content prevent treating these as a controlled before/after experiment.

Final macOS arm64 `.app`: **13,032,258 logical bytes / 12.43 MiB**, versus the
historical 12.12 MiB. PNG-only decoding adds capability at this measured size cost.
Executable: 12,783,904 bytes; SHA-256
`f2f77183dde4ff26082ccbf3a4f92c953ddaf56266b793d24760b6be8067267c`.
`codesign` reports linker ad-hoc signing, no TeamIdentifier and no sealed resources;
this is not distribution signing or notarization. Embedded frontend inventory:
2,054,427 logical bytes; do not add it again to installed
app size. Storage inventory counts logical bytes, not allocated filesystem blocks.

An additional isolated release-core workload used generated 3840×2160 and 7680×4320
RGB PNGs, requesting 256/512/1024 buckets once each. First-generation time was
123–140 ms for 4K and 357–435 ms for 8K; immediate cache hits took 0.25–0.49 ms.
The source files remained byte-for-byte unchanged. Benchmark-process peak RSS was
143.80 MiB, including synthetic image generation/encoding and Core; this excludes
WebView/GPU/game and is not total app memory. The first high-frequency 8K fixture
exceeded 16 MiB encoded size and was correctly rejected; the benchmark's unwrap
failed, so it was rerun with a supported-size fixture. These are diagnostic single
samples, not regression budgets. [Fixture source](evidence/2026-10-14-remediation/image-workload.rs)
and [resource output](evidence/2026-10-14-remediation/image-workload-resources.txt)
are retained alongside the raw JSON.

## Initial gates and deferrals (superseded by completion record)

T00–T12 engineering fixes are represented above; their target-device acceptance is
not established by passing unit/browser tests. T13 has local automated/bundle evidence,
but its complete resource/platform/signing work is still open. T14 is human verification.

- Verify native authentication lifecycle, close/quit/restart, screen readers, keyboard,
  pixel presentation, menus/file pickers and all six languages on actual targets.
- Measure complete process-tree memory, populated 4K/8K images, scrolling/frame pacing,
  multi-gigabyte copy/delete/install/hash, and one-hour idle/running/paused sessions.
  No total-app memory guarantee or sustained-load claim is made from short samples.
- Build/test macOS x64, Windows x64 and Linux x64 release installers; establish minimum
  OS versions, signing/notarization as applicable and isolated signed update A → B.
  CI native compilation is not installer or gameplay acceptance.
- Keep shared-game garbage collection deferred until references are reliable. Do not
  delete ambiguous legacy/abandoned download files automatically: another process or
  custom content may own them. Normal scoped errors now clean their own partials.
- Use existing pagination rather than virtualization. Keep complete file enumeration
  rather than inventing a backend paging protocol in this finalization pass. Revisit
  only with representative large-folder measurements.
- Keep the focused App cleanup rather than extracting every state owner at once;
  broad architectural cleanup remains maintenance work, not a completed plan item.

Human acceptance remains required before 0.1.0 consolidation.
