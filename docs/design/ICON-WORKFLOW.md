# Icon workflow

The source is `scripts/chest-mark.mjs`. It emits static SVG; `scripts/generate-icons.mjs`
produces `public/chest.svg`, the macOS squircle SVG and desktop icon formats.

1. Edit the generator, run `npm run icons`, then `node --test scripts/chest-mark.test.mjs`.
2. Inspect `docs/design/chest-icon-preview.html` at large and small sizes on both backgrounds.
   Keep temporary comparison images/backups outside the source checkout; prior revisions are in Git.
3. Commit the generator and regenerated desktop assets together. Rebuild the native app before
   expecting a new icon in its bundle; a browser refresh alone does not replace the installed icon.

The regular hexagon has radius 52 and center (64, 64). The latch has height:width:thickness
4:2:1 and is projected directly onto the cube's ±30-degree axes, with vertical height edges.
Do not use nonuniform scaling or shear on the latch: these distort its isometric axes.

## Interface symbols

`src/icons/` contains the actual pixel geometry, indexed by `src/symbols.ts` and
rendered by `Icon.svelte`. Symbols use integer SVG rectangles on a 9×9 canvas;
the shared triangle is 5×3 and is rotated for directional use. There is no runtime
bitmap conversion or separate pixelation renderer. Names describe shapes rather
than actions. Decorative symbols are hidden from assistive technology; controls
supply the accessible names.

Scale pixels uniformly. Inside buttons, the renderer snaps to whole physical
screen pixels and keeps symbols slightly smaller than their surrounding controls.
The [icon sheet](icon-set.svg) shows the current set and each symbol's resolution.
Use text glyphs for small symbols alongside metadata text. Keep temporary design
comparisons outside the project.
