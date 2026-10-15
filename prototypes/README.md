# Home prototypes

**Selected design: B.** A is retained for reference and comparison. B’s interactions are now integrated into the production launcher through shared components. These development entries remain for reference.

- **A — inventory dock with current interactions:** http://localhost:1420/prototypes/a/home.html
- **B — quiet navigation:** http://localhost:1420/prototypes/b/home.html
- **Original A backup:** http://localhost:1420/prototypes/a-original/home.html
- Default prototype URL (follows B): http://localhost:1420/prototypes/home.html

A and B support drag-to-reorder Home shelves, animated inline expansion to reveal hidden tools, centered hover/focus hints, and dedicated pages accessible by clicking hidden tools. Dragging between visible and hidden groups adds or removes Home shelves. Alt+Left/Right reorders visible tools; Alt+Down hides a visible tool and Alt+Up adds a hidden tool. No customization dialog or sidebar customization.

Both scroll only the fixed content panel and minimally reveal shelves within natural page bounds. Animation respects reduced-motion settings. A retains its darker stone inventory frame with monochrome vector icons; B uses a quiet dark dock and monochrome icons. Layout changes last for the current page session.

`a-original/` preserves A before the interaction updates. Its `snapshot.json` records hashes of the source before the initial A/B split. Only import paths and document title were adjusted for the nested backup.

All prototypes use shared launcher components and sample data. They are separate development-only Vite entries and do not change the production launcher entry point. The release build uses the root `index.html`; prototype pages and their exclusive code are not bundled. Keep A and `a-original/` in the repository.
