# Desktop menus

The Rust menu in `src-tauri/src/menu.rs` is installed for desktop builds. macOS
uses an application menu; Windows and Linux display menus in the application
window. File, Edit, View, Window and Help share their actions across platforms.
macOS puts Settings, About, updates, Services, hide and quit in the Chest menu.

Menu navigation emits `desktop-menu` to the main WebView. `src/desktop-menu.ts`
subscribes once and cleans up on unmount. App handles navigation through its
existing `select` function, so leaving an unfinished creation draft keeps the
usual confirmation. Navigation ignores clicks while an application dialog is
open. Settings and About use the existing settings tabs; updates use the existing
updater dialog and updater state. Report an Issue uses the existing project-link
handler. Native failures emit `desktop-menu-error` and use the app error display.

The Developer menu exists only with `debug_assertions`:

- Toggle Web Inspector: Command–Option–I on macOS, Control–Shift–I elsewhere.
- Reload UI: Command/Control–R. This reloads the WebView, including unsaved UI state.
- Open Data Folder: uses the active profile's existing folder handler.

The WebView explicitly enables devtools only in development builds. No devtools
Cargo feature or production inspector command is added.

Window commands use Tauri's window methods because several predefined native
menu items are unsupported on Linux or Windows. Edit uses native Cut, Copy,
Paste and Select All; macOS also uses native Undo/Redo. Windows/Linux Undo/Redo
use the WebView editing commands on the focused editable control. View zoom is
session-only, from 50% to 200%, independent of the app's text-size setting.

Keyboard shortcuts use Command on macOS and Control elsewhere. Native menu
labels and file-type filters follow the app language, including live settings
previews and Discard. Menu actions and keyboard shortcuts retain their stable IDs.

Verify native menus on each OS before release: editing in a focused text field,
new-instance draft protection, Settings/About/update navigation, zoom reset,
fullscreen, minimize/maximize/close, and developer inspector toggling. Confirm the
Developer menu is absent in release builds. Browser integration tests cover the
frontend event handling; they do not exercise native OS menu interaction.
