# Interface copy and localization

Chest supports English, Korean, Japanese, Spanish, Simplified Chinese (`zh-Hans`),
Traditional Chinese (`zh-Hant`), and Arabic (`ar`). Arabic uses right-to-left layout;
artwork and directional code/log text keep their intended orientation. Chinese is exposed as 简体中文 / 繁體中文;
each has a separate dictionary with its own terminology, rather than sharing a
character-converted translation.

`languages.ts` owns the registry and browser-language detection. Explicit Hans or
Hant script tags take precedence over regions. TW/HK/MO default to Traditional;
CN/SG and unspecified Chinese default to Simplified. Regional tags such as es-MX
still resolve to their base language. A saved explicit preference takes priority.
The chosen canonical tag is used for HTML language and number/date formatting.

Copy conventions:

- Use sentence case for headings and actions. Use “mod loader” as two words.
- Collection tabs use plural names (Mods, Resource packs, Modpacks); an individual
  project dialog identifies a Mod, Resource pack, Shader or Modpack.
- Translate complete phrases containing author names, counts and playtime.
  Never build translated sentences by joining English word fragments.
- Use distinct singular/plural keys where English or Spanish needs them. Chinese,
  Korean and Japanese can share wording but retain every placeholder.
- Preserve product names, filenames, user content, provider descriptions and legal
  license text. Unknown technical diagnostics stay verbatim. Known installation
  phases and progress formats have translations without changing native payloads.
- Update restrictions distinguish checking for updates from installing them.

Settings language changes preview immediately, including native desktop menus and
file-type filter labels. Save persists the choice; Discard reverts it. The frontend
passes only display labels to the native menu command; action IDs and shortcuts
remain language-independent. OS-owned file-dialog controls follow OS localization.

All five non-English dictionaries cover the same interface keys. Removed
controls' obsolete Apply/Cancel instructions were removed during the copy audit.
Run `node --test scripts/translations.test.mjs` for coverage, duplicate keys,
placeholder parity, locale resolution, native menu labels and progress formatting.
Browser language, navigation and persistence checks live in `preferences.spec.ts`;
Chinese accessibility and enlarged-text checks live in `chinese.spec.ts`.
