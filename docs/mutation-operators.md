# Mutation operators

> **English** | [简体中文](mutation-operators.zh-CN.md)

Mutations are the mechanism by which a pattern is explored. They are deliberately **curated data**, not executable plugins: each operator is a declarative record interpreted by the mutation engine, so adding an operator cannot add code execution.

## Categories and counts

Verified by counting the entries in `data/creative_operators/*.json`:

| File | Operators | Concern |
|---|---|---|
| `rhythm_mutation.json` | 8 | Groove, subdivision, syncopation, Euclidean placement |
| `timbre_mutation.json` | 8 | Sound selection and processing character |
| `structure_mutation.json` | 8 | Section shape, density over time, arrangement |
| `pitch_mutation.json` | 4 | Intervals, register, harmonic colour |
| `space_mutation.json` | 4 | Stereo placement, reverb/depth |
| `constraint_generator.json` | 4 | Rules that bound a search (the "make it obey X" operators) |
| **Total mutation operators** | **36** | |
| `anti_cliche_global.json` | 10 | Global rules that push away from over-used material |
| `cross_domain_mapping.json` | 5 | Cross-domain imagery → musical parameters |

## Operator record structure

Each operator carries enough context to be applied *and* explained:

| Field | Purpose |
|---|---|
| Identity / name | How it is selected and reported |
| `risk` (1–5) | How far it moves from the source material — the basis for user-facing warnings |
| `intensityRange` ([1,5]) | Which intensity tiers the operator suits, so a stealth section is not given a combat-size gesture |
| `repair` | The inverse or corrective move, so a mutation can be undone conceptually and not only via the version tree |
| `strudelHints` | Concrete Strudel idioms to realise the operator, keeping output in the target language rather than prose |

The `risk` and `intensityRange` fields are what make mutation usable: a user can ask for "a high-risk idea for a low-intensity section" and get something meaningful rather than noise.

## The cross-domain mapping idea

`cross_domain_mapping.json` converts non-musical imagery into musical parameters. The classic example: *"ventilation system"* → *slow amplitude-modulated low-pass noise*. This exists because a language model asked for "something like a ventilation system" will produce adjectives, whereas a mapping produces parameters that a pattern can actually use.

## Anti-cliché rules

`anti_cliche_global.json` holds 10 global rules that counteract the model's tendency toward generic material. They are global rather than per-category because cliché is a property of the whole output — a pattern can be rhythmically fresh and still sound like every other "dark techno" loop.

## Layer-scoped application

Operators are never applied to "the pattern". The engine:

1. parses the pattern into named layers,
2. validates the requested target and locked sets (unknown names and overlaps are errors),
3. regenerates only the targeted layer code,
4. returns the result to the validator, which re-checks the whole pattern.

This is why a mutation can be trusted not to disturb parts of the arrangement the user likes — the invariant is enforced in code, not requested in a prompt.

## Honest scope

- The catalogue was **authored by hand**; it is curated knowledge, not something learned from data.
- Operator *quality* is a musical judgement, not something the repository measures. There is no evaluation harness scoring whether a mutation sounds good.
- The 36 operators are a working vocabulary, not an exhaustive one; the record structure is what makes the vocabulary extensible.