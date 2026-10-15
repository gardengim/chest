# Settings editing

The Settings tab contains General (language, appearance, double-click launch and
reduced motion), Default instance settings (memory and Java), Storage, and Update.
The Update section reuses `AppUpdater`; its startup-check preference sits beside
Check. Microsoft application setup belongs to the debug-only Development tab.

The Settings tab has one Save / Discard / Restore defaults action row. Language,
color scheme, mode, and motion preview immediately, while preference and scheme
storage writes are suspended. Runtime defaults remain in `settingsDraft` until
Save. The frontend calls the existing native settings command before committing
preferences and appearance; a failed native save leaves the draft editable.
Imported color schemes are remembered only when settings are saved.

`settings-edit.ts` coordinates preference and appearance edit sessions. App owns
the baseline and navigation guard so both settings tabs and sidebar/native-menu
navigation behave consistently. Leaving a dirty Settings tab opens a modal with
Cancel, Discard and Save, and no close button. Escape stays on the current tab.
Save resumes the requested navigation only after success; Discard restores the
saved baseline and then navigates. Clean forms leave without a modal.

Restore defaults stages the detected language, built-in Chest scheme in dark
mode, default launcher preferences, automatic Java/instance folder and 4096 MB.
It leaves Microsoft application setup, accounts, instances, home customization
and imported scheme library intact. Save is required to persist restored values.
Folder-opening actions and manual update checks are immediate operations rather
than settings changes. Updates retain the existing installation/restart flow.

Native Close/Quit and updater Restart now use the same draft decisions. Pending
writes/file operations must finish first. Active installations/games require exit
confirmation; closing stops launcher work without deliberately killing games.
Forced termination cannot guarantee a prompt or completed writes.

Storage accounting runs only after Check storage and includes custom instance roots
without double-counting directories. Clear image cache shows the measured size and
asks for confirmation. It removes only generated PNG/temporary derivatives, never
shared game binaries, original screenshots, worlds or credentials. Unreadable or
oversized inventories are marked incomplete; shared-binary garbage collection is
intentionally deferred until reference analysis can prove deletion safe.
