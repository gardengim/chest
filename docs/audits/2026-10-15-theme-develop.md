# Theme and Develop settings

Renamed the appearance picker and import/export vocabulary to Theme; the built-in name is Chest Default. Saved theme formats and storage keys remain compatible. Updated Korean, Spanish, Japanese, Simplified Chinese, Traditional Chinese and Arabic translations.

Develop settings is off by default, participates in Save/Discard/Restore defaults, and previews the native Develop menu and Settings tab. The opt-in inspector works in optimized builds. Disabling the setting closes the inspector. Offline authentication remains restricted to debug builds. The page itself remains named Settings.

Search and copy artwork use thicker grid-aligned strokes through the existing cached pixel renderer. Shared button effects are unchanged.

Verification: 25 focused browser tests passed in Chromium and 25 in WebKit, including settings persistence/discard, native menu translation, release offline isolation, theme migration/import/export and icon hover stability. Svelte check: zero errors/warnings. Optimized native cargo check passed.

Human verification: confirm theme labels in your chosen language; inspect search/copy glyph weight; enable Develop settings and Save, reopen Chest, verify native menu/tab and Web Inspector; disable and Discard to verify restoration, then disable and Save to hide both. Native menu interaction on Windows and Linux still requires those platforms.
