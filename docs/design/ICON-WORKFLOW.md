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
