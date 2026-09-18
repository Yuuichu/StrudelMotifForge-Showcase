# Licence and third-party notice

## StrudelMotifForge

Released under the **GNU Affero General Public License v3.0** (`Copyright (C) 2026 Yuuichu`). The full licence text is included in this showcase as `LICENSE` — the standard AGPL-3.0 text, reproduced verbatim, preceded by the application notice that the licence itself prescribes.

**Why AGPL and not a permissive licence:** the application is built around Strudel, which is itself AGPL-3.0. Adopting a compatible copyleft licence is the conservative choice that keeps the project's own terms consistent with its dependency. See "Strudel and AGPL" below.

## Strudel and AGPL — the licence decision

The application is built around **Strudel**, the live-coding music language from [`tidalcycles/strudel`](https://github.com/tidalcycles/strudel). Verified upstream: that repository ships the **GNU Affero General Public License v3.0** (the full licence text was retrieved from the project's `LICENSE` file).

Why this matters:

- The AGPL is a strong copyleft licence, and **section 13 extends the source-availability obligation to users who interact with a modified version over a network**. A web application that incorporates AGPL code and is served publicly is exactly the scenario that clause targets.
- This is a **property of the upstream dependency**, not of anything in this showcase, but it constrains how this project may be licensed and deployed.
- Whether a given integration counts as a derivative work, an aggregate, or something else is a legal question, not an engineering one.

**Decision taken:** this project is published under **AGPL-3.0**, matching its dependency. That is the option that cannot create a licence conflict: a network-served derivative of AGPL code stays under the AGPL, and section 13's source-availability obligation is satisfied by publishing the source.

The alternative — a permissive licence such as MIT — would require establishing that the way Strudel is incorporated does not make this a derivative work, which is a legal question rather than an engineering one. If that is ever established, the `LICENSE` file is the single place that needs to change.

### Other projects in this set, for context

This is the only project in this set with a copyleft dependency. `AudioFlux`, `wwise-mcp`, `AI SFX Explorer`, `RPM Loop Tuning Analyzer` and `AiDrivenDynamicMixer` are all MIT-licensed, so their showcases carry permissive terms.

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