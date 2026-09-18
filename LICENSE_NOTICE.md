# Licence and third-party notice

## StrudelMotifForge

The project's repository does **not** contain a `LICENSE` file, so this showcase makes no licence claim and does not reproduce one. Absence of a licence here is not permission to reuse the code.

**Before publishing, this needs a decision** — see "Strudel and AGPL" below, because the choice of licence for this project may not be free.

## Strudel and AGPL — read this before publishing

The application is built around **Strudel**, the live-coding music language from [`tidalcycles/strudel`](https://github.com/tidalcycles/strudel). Verified upstream: that repository ships the **GNU Affero General Public License v3.0** (the full licence text was retrieved from the project's `LICENSE` file).

Why this matters:

- The AGPL is a strong copyleft licence, and **section 13 extends the source-availability obligation to users who interact with a modified version over a network**. A web application that incorporates AGPL code and is served publicly is exactly the scenario that clause targets.
- This is a **property of the upstream dependency**, not of anything in this showcase, but it constrains how this project may be licensed and deployed.
- Whether a given integration counts as a derivative work, an aggregate, or something else is a legal question, not an engineering one.

**Action required before this repository is made public:** decide and document the licence situation — either adopt a compatible licence, or confirm with someone qualified that the intended use is compliant. This showcase deliberately does not guess.

### Other projects in this set, for context

This is the only target project with a copyleft dependency of this kind. `AudioFlux`, `wwise-mcp` and `AI SFX Explorer` declare or imply permissive terms; `RPM Loop Tuning Analyzer` and `AiDrivenDynamicMixer` declare none yet.

## Third-party software

| Component | Role | Licence |
|---|---|---|
| **Strudel** (`@strudel/*`) | Live-coding language and runtime | **AGPL-3.0** (see above) |
| `React 19` | UI | MIT |
| `Vite` | Build tooling | MIT |
| `Zustand` | State management | MIT |
| `Dexie` | IndexedDB wrapper | Apache-2.0 |
| `CodeMirror 6` | Editor | MIT |
| `Zod` | Schema validation | MIT |
| `librosa` | Feature extraction / calibration (Python, offline tooling) | ISC |
| `Vitest` / `Playwright` | Test tooling | MIT / Apache-2.0 |

None of these are vendored into this repository; they are installed from their package registries.

## AI providers

The default provider is a **mock** and makes no network calls. Using a real provider (`anthropic`) is opt-in and requires a server-side API key; the key is never exposed to the browser bundle.

## Included sources and data

`selected-code/` contains verbatim copies of the pattern validator, mutation orchestrator, role mapper and sandbox host. `examples/` contains one style library and the operator catalogue — both are the project's own authored data.

**Not included:** `.env.local` (which contains only `VITE_AI_PROVIDER=mock`), build output, test artefacts, the full style library, LLM provider implementation, or any credential.

No third-party audio, no licensed music and no model weights are included.