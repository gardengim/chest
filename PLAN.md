# Chest release milestones

Sequence follows dependencies. The product boundary is defined in
[docs/BASELINE.md](docs/BASELINE.md); verification evidence lives in
[VALIDATION.md](VALIDATION.md). Status means the completion gate was achieved, not simply
that an implementation exists.

| Milestone | Work | Completion gate | Status |
| --- | --- | --- | --- |
| 1. Establish the baseline | Record scope/target platforms and navigation, creation, settings, accounts, and instance rules. Reconcile stale documentation and establish automated evidence. | Baseline documented, current checks recorded, no major interaction decisions outstanding. | Complete October 11, 2026: baseline and docs reconciled; 57 browser and 44 Rust tests plus build/lint/native checks pass |
| 2. Repeatable delivery | Validate existing check/release workflows, consistent versions, signing, artifacts, and update manifest. Build packaged apps and verify upgrading one version to another. | A tag produces installable signed builds and a real update succeeds. | Local arm64 app/ad-hoc signature and updater signature/tamper checks pass; GitHub/distribution/cross-platform/update acceptance pending |
| 3. Complete launcher acceptance | Real Microsoft login/refresh/cancellation, Java, vanilla/modded install, content, launch/stop, logs, import/export, duplication, and deletion on every target. Record exact OS/architecture and define minimum support from evidence. | Supported workflows pass in packaged apps without IPC mocks. | Implemented workflows; packaged/device acceptance pending |
| 4. Failure and recovery | Exercise interrupted downloads/updates, disk errors, corrupt data, auth expiry, archive/path safety, credentials, checksums, and conflicting operations. | Failures preserve user data and leave actionable, recoverable state; focused security review recorded. | Focused review and 54 macOS Rust tests; packaged fault injection/independent review pending |
| 5. Interaction and accessibility | Keyboard/focus, screen readers, contrast, scaling, terminology, dialogs, English/Korean, and unfamiliar-user flow review. | Core workflows work with keyboard alone and no blocking accessibility issues remain. | Axe core-page/Korean audits, contrast fixes and keyboard skip link pass; native/manual assessment pending |
| 6. Performance at scale | Measure startup, memory, large libraries, images, scrolling, logs, and long sessions. Set budgets using measured workloads and add repeatable regressions. | Representative workloads meet documented targets without stalls or persistent resource growth. | 1,000-instance workloads and icon optimization pass; native memory/images/long sessions pending |
| 7. Closed beta | Supply packaged builds to unfamiliar users on supported platforms; collect reproducible issues and observe task completion. | Users complete workflows independently; blocking issues resolved. | Test/report template prepared; earlier gates and participants pending |
| 8. Public release and maintenance | Publish installation/support/recovery guidance, stable builds, issue reporting, and a predictable update process. | Public users can install, update, report, and recover practically. | Recovery/support guidance and issue form prepared; earlier gates pending |

Security, accessibility, and performance remain constraints throughout; their dedicated
milestones provide deeper assessment after complete workflows exist. Each milestone
records its actual evidence and carries unmet gates forward explicitly.

## Next milestone: repeatable delivery

Existing workflows: `.github/workflows/check.yml` and `.github/workflows/release.yml`.
Release destination: `gardengim/chest`. See [release setup](docs/releases.md).

- Verify local commands match CI and version checks cover release inputs.
- Verify platform prerequisites, artifacts, and upload/manifest behavior.
- Record successful GitHub runs and artifacts for each architecture.
- Configure signing secrets and macOS signing/notarization for distributable builds.
- Install build A, publish signed build B, and exercise Check → Update → Restart.
- Leave this milestone open until real packaged update evidence exists.

## Packaged launcher acceptance for milestone 3

Use a disposable data directory/world and record version, OS, architecture, and outcome.

1. Create, restart, reopen, and duplicate an instance; verify independent identities/files.
2. Install supported Vanilla with automatic Java; verify pause/resume/retry and cache reuse.
3. Reject a wrong manual Java version with an actionable error.
4. Use Chest's own Microsoft registration: cancel login, sign in, restart, refresh, launch,
   switch accounts, and sign out. Credential contents must not appear in logs or reports.
5. Launch supported Vanilla, Fabric with a compatible mod, and Quilt with compatible content.
   Verify logs, normal exit, controlled failure, crash acknowledgement, and Stop confirmation.
6. Add compatible catalog content/dependencies, repeat the add, disable a file, and verify conflicts.
7. Create supported Modrinth/CurseForge packs through creation. Verify pinned settings,
   overrides, content, background queue, pause/retry, restart recovery, and real gameplay.
   Unsupported loaders and author-disabled downloads must explain the limitation.
8. Export/import a small world; verify new identity, preserved content, and excluded credentials.
9. Verify deletion confirmation using the disposable instance after saving a backup.
10. Verify the documented close/restart behavior with a running game, then close the game normally.

## Local continuation — October 11, 2026

`npm run verify` passes: 63 browser, 54 macOS Rust and five release-script tests, Svelte/build,
Clippy and native checks. Local macOS arm64 packaging succeeds with explicit ad-hoc signing;
updater signature verification accepts the artifact and rejects tampering. Live Fabric,
Quilt/catalog and Modrinth pack smoke checks pass using temporary data.

Milestones 2–8 remain open at their real acceptance gates. Prepared evidence and procedures:
[security](docs/SECURITY.md), [performance](docs/PERFORMANCE.md),
[recovery](docs/RECOVERY.md), and [packaged/beta acceptance](docs/ACCEPTANCE.md).
The GitHub repository is empty and this directory has no Git checkout; publishing, remote
secrets and release tags have not been changed. Real owning-account Microsoft acceptance,
Apple distribution signing, other platform/device tests and beta participants are required.

Isolated packaged profiles and download/filesystem/Java fault-injection tests are now
implemented. See [test profiles](docs/TEST-PROFILES.md). Native manual inspection remains
blocked by ScreenCaptureKit error -3811; a running packaged process alone does not meet
interaction, accessibility or gameplay gates.
