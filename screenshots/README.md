# Screenshots

Empty in this draft. The application is a browser SPA with a **mock AI provider by default**, so screenshots can be captured with no credentials and no network — this is the easiest of the six projects to capture properly.

## What should be captured

1. **`hero-workbench.png`** — the three-panel workbench after generating a pattern from a brief: brief/concept panel, pattern editor, and the layer controls. This is the product in one frame.
2. **`layer-locking.png`** — a mutation applied with layers locked, showing the target/locked selection. The layer-scoping invariant is the most defensible engineering claim in the project and should be visible.
3. **`mutation-diff.png`** — a before/after comparison across two version branches, showing that only the target layer changed.
4. **`validator-rejection.png`** — the validator refusing unsafe generated code. A security feature is more convincing shown working than described.
5. **`style-calibration.png`** — the calibration output with a real discrepancy (e.g. a style claiming 126 BPM against measured 109), because documented self-criticism is more credible than a clean report.
6. **`version-tree.png`** — the branch tree with several candidates.

## How to capture safely

Run with the default mock provider — no API key, no network, and deterministic output:

```bash
npm install
npm run dev
```

Then capture from the local dev server. Using the mock provider also means the screenshots are reproducible.

## Constraints on what may be shown

- **Mock provider only** for published screenshots: no real API key in any frame, no network panel showing a request with credentials.
- No absolute local paths in the UI.
- Style names and pattern content are the project's own generated data, so they are safe — but any capture must not include a stray browser tab, bookmarks bar or terminal with unrelated client material.

## Note

The screenshots are the only missing element for a complete README. Everything else in this showcase is documented from source.