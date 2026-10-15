# Color schemes

Appearance has two independent controls:

- **Light / Dark / System** radio buttons select the appearance mode and save immediately.
  System follows live device appearance changes. Changing a scheme never changes this preference.
- **Color scheme** is a dropdown. Built-in **Chest** contains both light and dark palettes
  in one scheme. Applied imports remain available in the dropdown (up to 32 custom schemes;
  applying another import with the same name replaces that saved entry).

Settings → Settings → Appearance imports, previews, applies, exports and resets color
schemes. Desktop import/export use native Open/Save dialogs; browser preview uses file
upload/download. A scheme preview affects the whole application immediately but is not
saved until Apply scheme. Cancel preview, Escape, or leaving Appearance restores the
saved scheme, while retaining the independent mode choice. Restore default scheme
returns to Chest without changing mode or deleting imported schemes. Export writes one
JSON file containing **both** fully resolved palettes, with no appearance preference.

The selected scheme uses `chest-color-scheme-v1`; custom dropdown entries use
`chest-color-schemes-v1`; mode uses `chest-appearance-mode-v1`. These local UI settings
are separate from launcher/account/instance configuration and home customization.
Schemes apply before the app mounts. Invalid stored entries fall back safely.
Older stored schemes migrate their embedded mode once when no separate preference is
present; old Chest/Chest Light built-ins converge to the paired Chest scheme, preserving
appearance. Old version 2 `mode` fields remain accepted on import but are ignored and
removed on export. Background customization is not part of this feature.

## Paired JSON format (version 2)

One file contains both light and dark palettes:

```json
{
  "version": 2,
  "name": "My adaptive palette",
  "palettes": {
    "light": {
      "page": "#eceeed",
      "page-text": "#252825",
      "accent": "#416c29",
      "accent-text": "#ffffff"
    },
    "dark": {
      "page": "#1c1d1f",
      "page-text": "#ececed",
      "accent": "#416c29",
      "accent-text": "#ffffff"
    }
  }
}
```

All three top-level fields (`version`, `name`, `palettes`) are required. Both palette
objects are required. Appearance mode is a user preference outside this file. Each accepts the
same roles in the table below; missing light roles inherit Chest Light, while missing
dark roles inherit Chest. Unknown fields and protected settings are rejected at every
level. Export preserves **both** fully resolved palettes, rather than flattening to
whichever palette is currently visible. Export Chest to
start from a complete template. Home layout preferences are stored independently and
are unaffected by scheme import, switching, reset or export.

Version 2 uses JSON. The constrained CSS format below remains a single-palette format.

## JSON format (version 1)

```json
{
  "version": 1,
  "name": "My palette",
  "mode": "dark",
  "colors": {
    "page": "#201729",
    "page-text": "#f7efff",
    "page-muted": "#cbbbd6",
    "accent": "#72439c",
    "accent-text": "#ffffff",
    "focus": "#d4a4ff"
  }
}
```

`version`, `name`, `mode` and `colors` are required for this legacy format. Mode is
`light` or `dark` and identifies which palette the supplied colors belong to; importing
it does not change the user’s appearance preference. The other palette uses Chest defaults.
All imports are normalized to version 2 and exports use the paired format. Names have 1–120
characters. Omitted colors inherit the Chest default, not an automatically guessed
light/dark palette. Export the default scheme to obtain a complete editable template.
Use matching foregrounds when changing a surface from dark to light.

| Role group | Keys | Used for |
| --- | --- | --- |
| Page | `page`, `page-text`, `page-muted` | Application canvas, page headings and supporting text |
| Panel | `panel`, `panel-text`, `panel-muted`, `panel-link` | Inventory surfaces, instance/settings panels and their links |
| Surface | `surface`, `surface-text`, `surface-muted` | Raised panels, dialogs, menus, sidebar and dock |
| Control | `control`, `control-text` | Ordinary buttons and inactive tabs |
| Input | `input`, `input-text`, `input-muted` | Inputs, search fields, selects and placeholders |
| Card | `card`, `card-text`, `card-muted` | Plain cards without background artwork |
| Media overlay | `overlay-text`, `overlay-muted` | Text over artwork, screenshot/world cards and illustrated instance headers |
| Interaction | `accent`, `accent-text`, `link`, `selected`, `selected-text`, `focus` | Primary actions, links, selection and keyboard/drop indicators |
| Status | `success`, `success-text`, `warning`, `warning-text`, `danger`, `danger-text` | Status fills, notifications and their foregrounds; sidebar animation derives brightness from these colors |
| Console | `console`, `console-text` | Game logs |
| Scrollbar | `scroll-track`, `scroll-thumb` | Scroll areas; tracks default to transparent and both custom axes share protected pixel bevels |

## CSS format

CSS is accepted as palette data, never injected as a stylesheet. Supply either one
`:root` block or a list of declarations. Use the same keys prefixed with `--theme-`:

```css
:root {
  --theme-mode: dark;
  --theme-page: #201729;
  --theme-page-text: #f7efff;
  --theme-page-muted: #cbbbd6;
  --theme-accent: #72439c;
  --theme-accent-text: #ffffff;
  --theme-focus: #d4a4ff;
}
```

The CSS filename supplies its name. Paste uses the localized “Imported scheme” name.
CSS mode defaults to dark. Comments and a final optional semicolon are supported.
JSON and CSS both pass through the same normalization and validation into a paired scheme. Unknown roles,
protected settings, selectors outside the single root block, imports, URLs, references
such as `var()`, cascade keywords and `!important` are rejected. Supported concrete CSS
colors include hex, named colors and browser-supported rgb/hsl/hwb/lab/oklch/color/mix
functions. File/input content is limited to 64 KiB and color values to 160 characters.

## Protected appearance

Imported palettes cannot change:

- Pixel size, 24×24 symbolic icon geometry, border widths, corner steps, responsive
  dimensions, spacing, motion, layouts or interaction behavior.
- Neutral white highlights, black shadows, structural black frames and their opacity.
- Background images, skin faces, logos, icons, screenshot bytes or their source colors.
- Neutral media scrims, translucent card-action fills and blur.

Monochrome UI icon ink is independently chosen from fixed light/dark neutral colors for
surface contrast. It can switch between those neutrals when a surface changes polarity;
it does not take a theme's text hue. Colored icon accents retain the source artwork.
Focus, selection and state outlines use semantic colors; structural frames remain black.
Dock focus uses the surface's muted color to preserve its neutral default feedback.

Image fades that join an instance header to the application canvas use the page color.
Images themselves are unchanged. Cards with images use the overlay text roles and a
neutral readability gradient; plain cards use the card roles without an image scrim.
Custom schemes retain control of their text/surface contrasts; import does not silently
rewrite the palette. Preview cancellation and default reset remain available.

## Maintenance and verification

`src/themes.ts` is the single palette/format authority. `ColorSchemeSettings.svelte`
provides the reversible UI; `preferences.ts` imports the scheme bootstrap at startup.
`style.css` owns context aliases and structural effects; shared components consume
semantic roles. Do not add per-feature color settings or inject imported CSS.

Regression coverage exercises import/export, preview rollback, restart persistence,
invalid/protected input, light/saturated contrast, narrow layouts at doubled text size,
real artwork, neutral icon ink and unchanged pixel paths, resource tabs and dialogs.
