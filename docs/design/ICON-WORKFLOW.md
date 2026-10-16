# Icon revision workflow

The source is `scripts/chest-mark.mjs`. It generates static SVG geometry; desktop assets are produced by `scripts/generate-icons.mjs`.

1. Save the current `public/chest.svg` and `docs/design/chest-macos.svg` in a dated folder under `docs/design/icon-backups/` before editing.
2. Edit the generator, then run `npm run icons` and `node --test scripts/chest-mark.test.mjs`.
3. Point the Before images in `docs/design/chest-icon-comparison.html` at that backup and update its caption.
4. Run `node scripts/render-icon-comparison.mjs`, then inspect `docs/design/chest-icon-comparison.png` at large and small sizes on both backgrounds. Set `CHEST_BROWSER_EXECUTABLE` if using installed Chrome instead of Playwright Chromium.
5. Keep the original, generator, generated desktop assets and comparison together. A native app rebuild is required before the installed app reflects new bundle icons.

The regular hexagon has radius 52 and center (64, 64). The latch is a rectangular prism projected directly onto the cube's ±30-degree axes, with vertical height edges. Avoid nonuniform scaling or shear transforms on the latch; those can distort one of its axes while leaving the other apparently correct.
