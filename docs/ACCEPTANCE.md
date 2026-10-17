# Packaged acceptance and beta record

This is the current release-readiness checklist. Automated checks and owner observations
are evidence for their tested scenarios; they do not close the full device matrix.

## Current status and remaining gates

- The owner confirmed unlocked Mac startup, Home → World → Play, Home → Server → Join,
  repeated launch after a Minecraft crash, keyboard/draft dialogs, automatic resource
  refresh, and selected VoiceOver flows. Microsoft sign-in with Chest's client ID worked.
  The owner also verified installation-progress announcements, instance/main-region
  names, dialogs including News, the skip link, warning contrast, and non-disruptive
  error announcements in the October 16 release review. These are owner-reported
  results on one Mac, not acceptance on every target.
- Finish authentication cancellation, entitlement, refresh after restart, account switching,
  sign-out and credential-store lifecycle on each supported platform.
- Complete installer/reopen, native menus/shortcuts/file pickers, keyboard/screen-reader
  operation and dirty/pending Close/Quit/Restart on macOS arm64/x64, Windows x64 and Linux x64.
  Verify macOS 14 on each Mac architecture and record Windows/Linux minimum versions.
- Verify real Vanilla/Fabric/Quilt/Forge/NeoForge and supported pack gameplay, pinned
  content/overrides/dependencies, repeat adds/conflicts, author-disabled downloads,
  live CurseForge access, pause/retry/restart recovery and manual/automatic Java.
- Complete duplicate/archive/world-backup roundtrips, independent identities, excluded
  credentials/imported commands, confirmed deletion and failure retry. Test disposable
  data under offline, low-disk, interrupted-operation, corrupt-state and slow-storage conditions.
- Check Light/Dark/System/imported themes, glyphs, 4:2:1 latch artwork, screenshot/card
  layouts, translated names, RTL, 200% text, fractional DPI and Develop settings persistence.
  Fluent proofreading of the six translations remains a human review item.
- Measure optimized packaged cold/warm startup, populated 4K/8K/provider artwork,
  scrolling and logs, and complete app/WebView process CPU/memory over one hour.
  Main-process RSS or synthetic browser heap is not complete-app memory evidence.
- Verify current CI and installers, distribution signing/macOS notarization, a real signed
  A → B update, tamper rejection, restart and data preservation. Retain signing-key backups
  and stable recovery artifacts. Obtain independent security/recovery review and unfamiliar-user
  beta results before public release. Repository cleanup does not authorize tagging or publishing.

Run `npm run verify` for the automated baseline and follow the [candidate SOP](audit-sop.md)
for a build-specific evidence handoff. Store new evidence outside the source checkout.
Prior detailed reports, CI links, sample identities and logs remain in the
[pre-cleanup history](https://github.com/gardengim/chest/tree/d03df505cad0463362f093d8d06fb59c0f352a76/docs/audits).
Historical results do not automatically apply to a newer executable.

## Device/build record

Use an [isolated profile](TEST-PROFILES.md) for non-update scenarios.
Copy this template for each build/device. Browser tests mock native operations; they
cannot replace this record. Never use an irreplaceable world for failure testing.

- Build version, artifact SHA-256, download/release URL:
- OS version, architecture, hardware/RAM, free disk space:
- Fresh install or upgrade from version:
- Tester/date:
- Data directory and disposable instance location:

| Scenario | Pass/fail/blocked | Evidence / issue |
| --- | --- | --- |
| Install, launch app, reopen persisted library | | |
| Bundled Chest Microsoft app: cancel, login, refresh after restart, logout | | |
| Vanilla install, launch, normal exit, Stop | | |
| Home world → Play and home server → Join enter the intended target without aborting | | |
| Fabric, Quilt, Forge and NeoForge with compatible content | | |
| Supported modpack install, overrides, gameplay | | |
| Pause/resume, interrupted download, retry, cache reuse; owned orphan reconciliation preserves legacy/verified files | | |
| Wrong Java, missing executable, low disk, offline provider | | |
| Duplicate, archive roundtrip, backup and confirmed deletion; pending mutations disabled; failed deletion error persists and retry works | | |
| Update A → B, signature rejection, restart and data preservation | | |
| Keyboard navigation, unobscured focus, dialogs, native screen reader; loader failure announcement and Retry | | |
| macOS 14 minimum on each architecture; dropdown keyboard/pointer selection and narrow-toolbar overflow | | |
| English/Korean/Spanish/Japanese/Simplified and Traditional Chinese/Arabic (RTL), narrow window, 200% scaling | | |
| Native Close/Quit/Restart with dirty drafts, pending writes and active installs/games | | |
| Invalid test profile/corrupt settings produce readable errors, preserve originals, and do not abort | | |
| Storage scan and confirmed image-cache cleanup preserve originals and shared binaries | | |
| Light/Dark/System, missing/bright/dark artwork, both scrollbar axes, fractional DPI | | |
| Large library: bounded artwork, first/last pages, full search, refresh clamping and off-page world/server deep links | | |
| 4K/8K screenshots, long logs, slow external storage, complete app/WebView CPU/memory over one hour | | |

For each failure record exact steps, expected/actual behavior, a sanitized log excerpt,
and whether restarting recovers it. Distinguish blocked external services from product
failures. The packaging minimum is macOS 14.0; verify it on a real packaged device. Record
accepted Windows/Linux OS and WebView versions after successful packaged testing.

## Closed beta gate

Recruit unfamiliar users across all four build targets. Give them tasks rather than
navigation instructions: create and play, add content, find a log, recover a failed
installation, back up a world, update the app. Record completion and where help was
needed. Resolve data loss, credential exposure, broken installation/update, and blocked
core navigation before expanding the beta.

## Public release gate

All packaged scenarios must have evidence, supported platforms/minimum versions must
be explicit, release artifacts must be signed as appropriate, macOS notarization must
be verified, and a published signed update must work. Publish install/recovery guidance,
release notes, known limitations, and issue reporting with the release. Keep the signing
key backed up and retain prior stable artifacts for recovery. These gates are not met by
having a workflow file or passing mocked tests.
