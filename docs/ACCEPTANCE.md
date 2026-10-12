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
| Own Microsoft app: cancel, login, refresh after restart, logout | | |
| Vanilla install, launch, normal exit, Stop | | |
| Fabric and Quilt with compatible content | | |
| Supported modpack install, overrides, gameplay | | |
| Pause/resume, interrupted download, retry, cache reuse | | |
| Wrong Java, missing executable, low disk, offline provider | | |
| Duplicate, archive roundtrip, backup and confirmed deletion | | |
| Update A → B, signature rejection, restart and data preservation | | |
| Keyboard navigation, focus restoration, dialogs, screen reader | | |
| English/Korean, narrow window, 200% scaling | | |
| Large library, long log session, idle memory over one hour | | |

For each failure record exact steps, expected/actual behavior, a sanitized log excerpt,
and whether restarting recovers it. Distinguish blocked external services from product
failures. Record minimum supported OS versions only after successful packaged testing.

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
