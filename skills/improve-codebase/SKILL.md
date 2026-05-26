---
name: arbe-improve-codebase
description: Find shallow modules that should become deep modules using the deletion test and depth/leverage/locality lens. Use for repo-wide refactoring that improves testability, AI-navigability, or tightly-coupled areas. Not for single diffs.
---

# Architecture deepening

Find places where a **shallow** module should be turned into a **deep** one. Whole-repo scope — for single diffs, use a review skill.

Use when test wiring feels disproportionate to what's being tested, or when per-entity module proliferation has made the code feel scattered. Skip during incidents or under deadline pressure.

## Glossary

Use these exactly. Do not drift to "component / service / API / boundary."

- **Module** — anything with an interface and an implementation. Function, class, package, slice. Scale-agnostic.
- **Interface** — everything a caller must know: types, invariants, ordering, error modes, required config, performance characteristics. Not just the type signature.
- **Implementation** — what's inside.
- **Depth** — leverage at the interface. **Deep** = lots of behaviour behind a small interface. **Shallow** = interface nearly as complex as implementation.
- **Seam** _(Feathers)_ — where an interface lives. The location at which behaviour can be altered without editing in place.
- **Adapter** — a concrete thing satisfying an interface at a seam.
- **Leverage** — what callers gain from depth.
- **Locality** — what maintainers gain: change, bugs, knowledge concentrate in one place.
- **Layer** — surface (CLI, HTTP routes, UI), core (domain logic), or infra (DB, transport, FS). The layer a scatter lives in is the layer its seam belongs in.

### Principles

- **Deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it earned its keep.
- **Knob test.** Before recommending consolidation, write out the would-be call signature against every caller. If knobs (nullable params, pluggable hooks, mode flags) grow faster than boilerplate shrinks, the consolidation is a shallow module wearing a deep module's coat. Unification that works for 3 of 5 callers and forces optional knobs for the 4th and 5th is a failed candidate.
- **Layer check.** Name the layer the scatter lives in. The seam belongs at that layer. A surface-layer scatter ("25 CLI commands repeat invoke-and-format") doesn't become a core-layer module — the duplication is at the surface, fix it at the surface.
- **The interface is the test surface.** If you want to test past the interface, the module is the wrong shape.
- **One adapter = hypothetical seam. Two adapters = real seam.** Don't introduce a port unless something actually varies across it.
- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small mockable parts — they just aren't part of the interface.

## Process

### 1. Read domain language first

Read the project's domain glossary (commonly `docs/vocabulary.md` or `CONTEXT.md`) and `docs/architecture.md` for the package graph. Skim `docs/adr/` entries in the area you'll touch, if present.

### 2. Spawn one Explore subagent

Do **not** explore inline — the subagent's brief is what produces a structured report. Use `subagent_type=Explore`.

Build the brief from §Glossary + §Principles + the per-candidate schema in step 3, plus:

- Repo orientation already gathered (hub modules, data flows) — don't make the agent rediscover it
- A numbered hit-list of paths to inspect with "what to look for" per entry
- Budget: 5–10 strong candidates, not 30 weak ones; skip cosmetic refactors and naming nits
- Symmetric "already deep — preserve" section so we know what to leave alone

See `## Subagent prompt template` below.

### 3. Present numbered candidates to user

Distill the subagent's report into a numbered list. Per candidate:

- **Files** — exact paths with **per-file line counts**. No averages. Call out outliers explicitly (e.g. "threads.ts is 408 lines; the other 4 average ~95 — threads is the outlier carrying real logic, not a peer").
- **Layer** — surface / core / infra. The proposed seam must sit at this layer.
- **Problem** — the shallow interface or scattered logic
- **Deletion test** — concentrates complexity (keep) or disperses it (pass-through)?
- **Knob test** — write the would-be unified signature. List the knobs each caller would force in. Pass only if knobs stay flat as callers grow.
- **Preserve cross-check** — scan the "already deep — preserve" list for a module that already owns this verb. **If found, reframe as migration into that module, not invention of a new one.** This rule alone kills most false-positive candidates.
- **Sketch** — what the deepened module would own, in domain vocab. **Do not propose interfaces yet.**
- **Leverage / Locality / Test surface change**

Add the "already deep — preserve" section first, so cross-checks have something to reference. End with _"Which of these do you want to explore?"_ — do not start designing.

### 4. Grilling loop (when user picks one)

Walk the design tree with the user — constraints, dependencies, shape of the deepened module, what sits behind the seam, what tests survive.

Side effects inline as decisions crystallize:

- **Naming a module after a concept not in the glossary?** Add the term.
- **Sharpening a fuzzy term mid-conversation?** Update the glossary then.
- **User rejects with a load-bearing reason future explorers would need?** Offer to record an ADR under `docs/adr/`. Skip ephemeral or self-evident rejections.

### 5. Optional — parallel interface design

"Design It Twice" (Ousterhout): your first interface is unlikely to be the best. When the user wants alternatives for a chosen candidate, spawn 3+ subagents **in parallel** with different constraints — minimal interface / maximal flexibility / common-caller default / ports-around-network-seam (if cross-process). Each outputs interface + usage example + what's hidden + trade-offs.

Present sequentially, compare by **depth / locality / seam placement**, recommend one. Strong read, not a menu.

Dependency categories for picking the seam:

- **In-process** — pure / in-memory. No adapter. Test directly.
- **Local-substitutable** — local stand-in exists (PGLite for Postgres). Internal seam, no port at the external interface.
- **Remote but owned** — your own services across a network. Port + production adapter + in-memory test adapter.
- **True external** — Stripe, Twilio, etc. Inject a port; tests use mock adapter.

### Testing strategy: replace, don't layer

Old unit tests on shallow modules become waste once interface-level tests exist — delete them. New tests sit at the deepened module's interface and assert observable outcomes, not internal state. Tests that change when implementation changes are testing past the interface.

## Subagent prompt template

Paste-ready scaffold for step 2. Inline §Glossary and §Principles verbatim, then fill in:

```text
You are running architecture exploration on the repo at {{REPO_ROOT}}.

Your job: walk the codebase and surface places where modules are SHALLOW and would benefit from being made DEEP.

[paste §Glossary verbatim]

[paste §Principles verbatim — deletion test, knob test, layer check, interface-is-test-surface, two-adapters, depth-is-interface]

Domain language: {{DOMAIN_GLOSSARY}}. Use those nouns when describing what a deepened module would own.

Repo orientation: {{ARCHITECTURE_DOC}} summarises the package graph. Key facts already gathered:
- <hub modules, data flows, compute paths>

Walk these areas — read code, do not skim:
{{HIT_LIST}}
- <path 1> — <what to look for>
- <path 2> — <what to look for>

For each candidate capture:
- Files with PER-FILE line counts (no averages); call out outliers
- Layer (surface / core / infra) — and check the proposed seam sits at that layer
- Problem
- Deletion test
- Knob test — write the would-be unified signature against every caller; list the knobs each caller would force
- Preserve cross-check — does any module in the "already deep — preserve" section already own this verb? If yes, this candidate is a migration target, not a new module
- Sketch (no full interfaces)
- Depth gain / Locality gain / Test surface change

Produce the "already deep — preserve" section FIRST so the candidate cross-checks have something to reference.

Surface 5–10 STRONG candidates, not 30 weak ones. Skip cosmetic refactors, naming nits, file moves.

Output: preserve section, then numbered candidates with the structure above. Cite file:line. ~20–40 reads expected.
```
