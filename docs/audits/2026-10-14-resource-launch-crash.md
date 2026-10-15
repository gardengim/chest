# World Play / server Join crash

Reported workflow: Home → Worlds or Servers → instance resource tab → Play or Join.
Both paths aborted with “there is no reactor running” at the shared game launcher.

## Cause and fix

The Tauri `launch_resource` command was synchronous. Its main-thread handler reached
`Core::launch_target`, which called `tokio::spawn` without a Tokio runtime context.
The ordinary instance Launch command was already asynchronous.

Make the resource command asynchronous through the same native command mechanism.
At the shared Core launch boundary, obtain `Handle::try_current()` before reserving
a job or announcing startup, then spawn through that handle. This reuses the existing
installer pattern. Incorrect runtime-free callers now receive a normal error instead
of panicking or leaving the instance busy.

## Verification

- Three resource-launch tests pass: existing argument coverage, runtime-free ordinary/
  world/server launch rejection without a reserved job, and asynchronous world/server
  launch preparation errors delivered through normal activity/log reporting.
- Native application compilation and strict Core Clippy with all targets pass.
- The existing ordinary-launch error regression passes too: four launch-related
  checks in total. All three native library tests pass.
- The local macOS arm64 app bundle rebuilt successfully (12.43 MiB). See
  [candidate identity](evidence/2026-10-14-remediation/resource-launch-candidate.json)
  and [validation excerpts](evidence/2026-10-14-remediation/resource-launch-validation.txt).
- Tests use disposable files and deliberately missing installation metadata; they
  do not access real credentials, download games, or claim successful gameplay.

Actual Join and Play should be retried in the rebuilt app before human acceptance.
The previous release binary predates this fix.

Commit/push is pending: automatic approval review blocked staging because its usage
limit was reached. Changes remain saved locally; no release/tag was created.
