# Recovery and support

Before changing files, close Chest and Minecraft and back up the instance folder
(Settings → Instance folder). Custom instance locations can live outside Chest's data
folder. Deleting an instance deletes its local worlds too.

## Installation or content download failed

Keep the instance and retry the failed operation. Verified cached files can be reused.
Queued modpack/content requests survive a restart. Do not delete a world to repair a
download. Check free space, network access, and the error shown in the activity panel.
Pause and resume installations through the launcher; force quitting is not a pause.

## Java or game startup failed

Use automatic Java first. If selecting a custom executable, use Check in Settings and
verify the required version. Imported archives use this machine's configured Java
rather than trusting an executable path from another computer. Review Log for the first
failure; remove personal names, paths, server addresses, and tokens before sharing it.
Oversized game log lines are omitted and the session access token is redacted by Chest.
Other secrets printed by mods cannot be guaranteed to be redacted.

## Sign-in failed

Retry using the intended Microsoft account and Chest's own registered application.
A 403 can require account entitlement or application-registration changes; reinstalling
an instance will not fix that. Cancel and restart sign-in if the browser callback expires.
Credentials are stored in the operating system credential store, not exported archives.
Never attach credential-store contents or updater private keys to an issue.

## Settings cannot be read

Chest leaves an unreadable config.json unchanged. Close Chest, copy the entire data
folder to a backup, and inspect the error. Restore a known-good config backup if available.
Do not overwrite it with an empty config: custom instance locations and library metadata
may otherwise become disconnected. Keep the original file for recovery.

## App update failed

Finish or stop game/install operations before updating. Retry Check and Update with a
working connection. Chest verifies updater signatures before replacement. If the app
cannot reopen, install the last known-good official build without deleting data. Keep a
world backup before changing app versions; older versions may not understand newer data.

## Reporting a problem

Include Chest version, exact OS/architecture, installation source, steps, expected result,
actual result, and whether it reproduces in a disposable instance. Include a sanitized
error/log excerpt. See [acceptance record](ACCEPTANCE.md) for a repeatable report format.
