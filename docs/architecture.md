# Architecture

A single-page application with a deliberately small trusted core, plus one Node service that exists only to keep credentials out of the browser.

## Repository layout

```text
src/
  ai/               LLM provider adapters (mock is the default)
  components/       React UI: panels, layout, shared components
  mock/             deterministic mock concepts and content
  modules/
    code-generator/ brief/plan -> Strudel code (role mapping, templates)
    layer-lock/     parses a pattern into named layers
    mutation-engine/ applies operators to target layers only
    pattern-validator/ static validation of generated code
    runtime/        sandbox iframe host + versioned message protocol
  stores/           Zustand state slices (pattern, version branch, style, ...)
  types/            shared domain types
server/             Node service: AI proxy, Origin allowlist, rate limiting
shared/             types shared between client and server
data/               style libraries, style profiles, creative operators
e2e/                Playwright end-to-end tests
```

## Layers

### 1. Domain layer — types and schemas

The workflow is expressed as data before it becomes code: `CompositionPlan`, concept cards, layers, roles, gestures, version branches. Because the plan is structured, generation is a function of the plan rather than a free-form prompt, and mutations can target named layers.

### 2. Generation layer — `modules/code-generator`

Turns a plan into a Strudel pattern. Role mapping decides which Strudel idiom and template suits a role (kick, bass, harmony, lead, texture) given the plan's tempo and intensity, using Euclidean rhythm helpers where the groove logic calls for them.

### 3. Integrity layer — `modules/layer-lock` + `modules/mutation-engine`

The pattern is parsed into **named layers** using the `@agent:layer:<name>:start` / `:end` markers. Mutations are then applied to an explicit target set while a lock set is preserved. The engine validates those sets before doing any work:

- unknown target layer → error,
- unknown locked layer → error,
- empty target set → error,
- a layer appearing in both sets → error.

This is the mechanism that turns "only change the lead" from a request into an invariant.

### 4. Validation layer — `modules/pattern-validator`

Every candidate pattern is validated as *text* before it is ever executed: delimiter balance, the required top-level `stack()`, marker presence/pairing/order, and a seven-group unsafe-code scan (see `docs/safety-model.md`).

### 5. Execution layer — `modules/runtime`

Generated code is executed inside a sandboxed iframe created with `sandbox="allow-scripts"` — deliberately **without** `allow-same-origin`, so the frame runs in an opaque origin. Parent and frame talk over a `MessageChannel` with a versioned protocol, a handshake, request ids, timeouts and capability checks on both sides.

### 6. State layer — `stores/`

Zustand slices hold the current pattern, layer state, style selection and the **version branch** tree, so a candidate can be compared and returned to instead of being overwritten.

### 7. Service layer — `server/`

A small Node service providing the AI proxy (so API keys stay server-side), static serving, Origin allowlisting, request-body limits and per-IP rate limiting.

## Design decisions worth naming

1. **Generated code is untrusted input.** It is parsed, validated, and executed in an opaque-origin sandbox — the same treatment a user-supplied script would deserve.
2. **Layers are the unit of change.** Everything — mutation, locking, comparison — operates on named layers, which is what makes AI-assisted editing safe enough to use.
3. **The plan is structured.** A structured plan is diffable, explainable and validatable in a way that free-form model output is not.
4. **Offline by default.** The mock provider means the full pipeline can be exercised with no network and no credentials, which also makes the test suite deterministic.
5. **Branches, not overwrites.** Every mutation produces a candidate that can be abandoned without losing the previous state.