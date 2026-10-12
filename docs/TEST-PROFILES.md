# Isolated packaged testing

Set `CHEST_TEST_PROFILE` to an absolute directory path before launching the app's
executable. The directory must be empty/new or already contain a valid Chest test-profile
marker. Chest rejects the normal data directory, its parents and its descendants.
The window title shows **Chest — Test profile**.

```sh
CHEST_TEST_PROFILE="/private/tmp/chest-acceptance" ./src-tauri/target/release/bundle/macos/Chest.app/Contents/MacOS/chest
```

On Windows, set `$env:CHEST_TEST_PROFILE` before starting `chest.exe`; on Linux export the
variable before starting the app. Launching through a desktop shortcut may not inherit a
terminal's environment. Remove the variable for a normal launch.

Each profile has its own config, download cache, library and credential-store service.
WebView preferences use a separate data directory on Windows/Linux and a persistent
WebKit data-store identifier on macOS. **Test profiles require macOS 14 or newer**;
older versions are rejected rather than sharing browser storage. Normal launch behavior
and its existing credential service are preserved. App replacement is blocked in test
profiles so a disposable test session cannot replace the launcher executable.

Profiles are an acceptance aid, not a filesystem or process sandbox. A folder/Java
executable selected by the tester can be outside the profile. Use disposable locations,
never import your only world copy, and do not copy a normal config into a test profile.
Sign out of test accounts before deleting a profile: OS credentials and macOS WebKit
storage are managed separately and are not removed by deleting its directory. Keep the
marker to retain profile identity; do not copy it into other profiles.

Use [ACCEPTANCE.md](ACCEPTANCE.md) to record scenarios. For updater replacement acceptance,
use a separate installed app copy and separate OS user/VM; replacement is deliberately
blocked in this profile mode. Browser regression tests still mock native IPC.
