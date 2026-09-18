# StrudelMotifForge

A browser-based workbench for **layered Strudel pattern composition**: turn a short creative brief into concepts, layered live-coding patterns, controlled mutations and explanations — with a sandbox that treats generated code as untrusted.

## Why I Built This

Live-coding music in Strudel is fast and expressive, but it has a workflow gap: a pattern is a single text artefact. There is no notion of *layers* you can mutate independently, no record of which branch of an idea you were on, and no guardrail when an LLM is asked to "make it darker" — the model rewrites the whole pattern, changes things you liked, and you find out at playback time.

I wanted the AI-assisted version of that workflow to behave like version control plus a diff: mutate a **named layer** while locked layers stay byte-identical, keep every result as a branch you can return to, validate the generated code before it ever runs, and explain what changed.

The second motivation was security. Generated code executing in a browser is a real threat surface, so "run LLM output" had to be designed as an explicitly untrusted boundary rather than a convenience.

## What It Does

- **Brief → concept → composition plan.** A short creative brief becomes concept cards and a structured plan (intensity, layers, roles, gestures).
- **Layered pattern generation.** The plan becomes a Strudel pattern with marked, named layers, using role mapping (kick / bass / harmony / lead / texture) and style knowledge.
- **Controlled mutation.** Mutation operators are applied to **selected layers only**, with other layers locked; the engine refuses unknown or overlapping target/lock sets rather than guessing.
- **Style knowledge calibrated against real audio.** A librosa pipeline measures BPM, key/mode, MFCC timbre, spectral shape, onset rate and pulse clarity from real tracks; those measurements then **audit and correct** the style knowledge an LLM produced, with discrepancies scored and logged.
- **Explained output.** Every generated pattern comes with an explanation of the plan and the mutations applied.
- **Version branches.** Candidate patterns are kept as branches rather than overwritten, so an idea can be explored and returned to.
- **Runs offline by default.** Mock AI is the default provider, so the whole workflow is usable without credentials or network access.

## Workflow

```text
Creative brief
      |
      v
Concept cards  ->  Composition plan (intensity, layers, roles, gestures)
      |
      v
Layer-marked Strudel pattern
      |
      +--> Mutation operators (target layers only; locked layers preserved)
      |         |
      |         v
      |    Validator: balanced delimiters, required stack(), paired markers, unsafe-code scan
      |         |
      |         v
      |    Sandboxed iframe (opaque origin) -> playback
      |
      +--> Version branches (compare / return to any candidate)
```

## Technical Highlights

- **The sandbox is opaque by design.** The runtime iframe is created with the `sandbox` attribute set to `allow-scripts` **only** — notably *without* `allow-same-origin`. Generated Strudel code therefore executes in an opaque origin with no access to the app's DOM, storage or session.
- **A versioned message protocol, checked on both sides.** Parent and iframe communicate over a `MessageChannel` using a protocol constant and explicit handshake; messages carry a request id and are validated against capability allowlists on **both** ends, with timeouts rather than silent hangs.
- **Generated code is validated before it runs**, and the checks are substantive:
  - balanced braces, parentheses and brackets;
  - a required top-level `stack()` combinator;
  - layer markers must exist, be paired, and be correctly ordered;
  - **seven groups of unsafe code patterns** are rejected — network/worker APIs, browser globals, dynamic code execution (`eval`/`Function`), dynamic import, object escape primitives (`constructor`/`prototype`/`__proto__`/`process`), global-object escape primitives (`Object`/`Reflect`/`Proxy`/`frames`/`opener`), and computed property access. Strings and comments are stripped first, so legitimate text cannot trip the scan.
- **Layer locking is a real invariant, not a prompt instruction.** The mutation engine parses the pattern into layers and rejects unknown target layers, unknown locked layers, and any overlap between the two sets — so "don't touch the drums" is enforced by code.
- **Server-side hardening.** The Node service enforces a **20 requests/minute/IP** rate limit, an **Origin allowlist**, and a **64 KB body limit**, and keeps credentials server-side so they never reach the browser bundle.
- **Audio-calibrated style knowledge.** Style metadata is not taken on faith: measured BPM that deviates by more than **15** from the style's claimed tempo triggers a rewrite using measured p10/p90/mean, and timbre claims are cross-checked against spectral centroid (a "dark" style measuring a **4419 Hz** centroid is flagged). Each style scores out of **10** (one point lost per discrepancy); 8+ passes.
- **Scale, measured from source:** 117 TypeScript/TSX files in `src/`, 9,306 lines.

## Architecture

`docs/architecture.md` covers the app and module layout; `docs/safety-model.md` documents the sandbox, validator and server hardening; `docs/style-knowledge.md` explains the audio-feature calibration loop; `docs/mutation-operators.md` catalogues the operator system.

## My Role

Sole author: application architecture, pattern generation and validation, the mutation engine and layer-lock model, the sandbox runtime and message protocol, the audio-feature calibration pipeline, the style knowledge base and the test suite.

## Limitations

- **No MIDI, MusicXML or audio export.** Capture is not implemented — the export path is a placeholder. Auditioning happens through the in-app sandboxed player. Do not expect a rendered file.
- **Naming is ahead of the implementation.** The project is called StrudelMotifForge, but there is **no dedicated motif-development module**: motif-level ideas are carried by the Concept → CompositionPlan → Mutation pipeline, and "motif" survives as one pitch-operator name rather than a subsystem. The positioning that matches the code is *layered pattern composition workbench*.
- **Calibration only covers styles that have an audio profile.** Several styles in the shipped data are logged as "No audio profile found — cannot calibrate", so the calibration loop is demonstrated on a subset, not across the whole library.
- **Style knowledge is a starting point**, not a musicological reference. Its numbers are LLM-generated estimates that have been partially audited against audio.
- **LLM output is inherently variable.** The mock provider (the default) is deterministic, but a real provider is not; the validator constrains *safety*, not musical quality.
- **Single-user, local-first.** There is no collaboration, no server-side project persistence and no cloud sync.
- **The operator catalogue is curated, not learned.** 36 operators across six categories were authored by hand.

## Repository Scope

This is a portfolio showcase repository. The full development repository remains private.

Included in `selected-code/`: the pattern validator, mutation orchestrator, role mapping and sandbox host. Included as data in `examples/`: the operator catalogue and one style library. Also included: architecture, safety, calibration and operator documentation. Excluded: environment files, build output, test artefacts, the full style library, the LLM provider implementation and the e2e suite.

## Tech Stack

`React 19` · `TypeScript` · `Vite` · `Zustand` · `Dexie` · `CodeMirror 6` · `Zod` · `Strudel / TidalCycles` · `librosa` (feature extraction and calibration) · `Euclidean rhythm` · structured LLM output · sandboxed iframe + `MessageChannel` · `Vitest` · `Playwright`
