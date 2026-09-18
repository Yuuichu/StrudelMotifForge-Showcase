# Safety model

Generated code that executes in the browser is attacker-reachable input. This document describes the four independent layers that constrain it, in order of execution.

## Layer 1 — Static validation before execution

`src/modules/pattern-validator/validator.ts` checks generated code **before it runs**:

| Check | Rule |
|---|---|
| Delimiter balance | Braces, parentheses and brackets must balance |
| Required combinator | The pattern must contain a top-level `stack()` |
| Layer markers | `@agent:layer:<name>:start` markers must exist, be paired, and be correctly ordered |
| Unsafe code | Seven groups of patterns are rejected (below) |

### The seven unsafe-code groups

| # | Group | Examples |
|---|---|---|
| 1 | Network or worker API | `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `Worker`, `SharedWorker` |
| 2 | Browser global | `document`, `window`, `globalThis`, `navigator`, `location`, `localStorage`, `sessionStorage`, `indexedDB`, `caches` |
| 3 | Dynamic code execution | `eval`, `Function` |
| 4 | Dynamic import | `import()` |
| 5 | Object escape primitive | `constructor`, `prototype`, `__proto__`, `process` |
| 6 | Global-object escape primitive | `Object`, `Reflect`, `Proxy`, `frames`, `opener` |
| 7 | Computed property access | bracket access following any identifier, string literal or closing delimiter |

Two details matter more than the list:

- **Strings and comments are stripped before scanning.** A pattern containing the word `fetch` in a comment is not rejected, and — more importantly — a payload hidden in string concatenation does not slip past a naive text match.
- **Validation is a gate, not a linter.** Unsafe code is an *error* that blocks execution, not a warning.

## Layer 2 — Opaque-origin sandbox

The runtime iframe is created with:

```js
iframe.setAttribute('sandbox', 'allow-scripts')
```

`allow-same-origin` is **deliberately absent**. Consequences:

- The frame's origin is **opaque** — it cannot read the parent document, cookies, `localStorage`, or the app's session.
- It cannot be treated as same-origin by the browser, so the usual sandbox-escape shortcuts are unavailable.
- Even if generated code defeated Layer 1, it has no ambient authority to use.

The application's own CSP and asset handling are configured to keep the sandbox's world separate from the UI's.

## Layer 3 — Versioned message protocol with two-sided capability checks

Parent and sandbox communicate **only** over a `MessageChannel` — not `postMessage` on a shared window handle:

- Messages carry a **protocol version constant**, so a mismatched runtime fails fast rather than half-working.
- A **handshake** establishes the channel; a missing handshake times out with an explicit error instead of leaving the UI hanging.
- Every request carries a **request id**, and responses are matched to requests.
- Both sides validate incoming message types against a **capability allowlist** — the sandbox cannot ask the parent to do arbitrary things, and the parent does not execute arbitrary commands from the frame.
- Operations have **timeouts** (command timeout, user-gesture timeout), so a wedged sandbox surfaces as an error.

## Layer 4 — Server hardening

`server/` is a small Node service. It applies:

| Control | Value |
|---|---|
| Rate limit | **20 requests / minute / IP** |
| Rate-limit table cap | 10,000 entries (so the limiter cannot become a memory leak) |
| Request body limit | **64 KB** |
| Origin allowlist | `ALLOWED_ORIGINS` env, defaulting to loopback origins |
| Credentials | **Server-side only** — API keys are never exposed to the browser bundle |

The service exists precisely so that an LLM credential never has to live in client code.

## What is deliberately not claimed

- **The sandbox is not a formal proof of safety.** It is defence in depth: static validation, opaque origin, protocol-level capability checks and server limits. Each layer is documented so it can be attacked on purpose.
- **The mock provider (the default) removes the LLM from the threat model entirely.** Running with a real provider is an opt-in posture change, not a default.
- **No claim is made about the musical quality or security of arbitrary third-party operators.** The shipped operator catalogue is authored, reviewed and data-only; operators are not executable plugins.