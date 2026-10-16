# Packaged acceptance and beta record

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
