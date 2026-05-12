---
name: arbe-improve-codebase
description: Find places where a shallow module should be turned into a deep one — applies the deletion test, depth/leverage/locality lens, and a paste-ready Explore subagent prompt. Use to improve testability and AI-navigability, consolidate tightly-coupled modules, or find refactoring targets that compound. Whole-repo scope, not single diffs.
---

# Architecture deepening

Find places where a **shallow** module should be turned into a **deep** one. Run when you want to improve testability and AI-navigability, consolidate tightly-coupled modules, or find refactoring targets that compound. Aimed at the whole repo, not at a single diff.

## Glossary

Use these exactly. Do not drift to "component / service / API / boundary." Consistent language is the point.

- **Module** — anything with an interface and an implementation. Function, class, package, slice. Scale-agnostic.
- **Interface** — everything a caller must know to use it: types, invariants, ordering, error modes, required config, performance characteristics. Not just the type signature.
- **Implementation** — what's inside.
- **Depth** — leverage at the interface. **Deep** = lots of behaviour behind a small interface. **Shallow** = interface nearly as complex as implementation.
- **Seam** _(Feathers)_ — where an interface lives. The location at which behaviour can be altered without editing in place. Use this, not "boundary."
- **Adapter** — a concrete thing satisfying an interface at a seam.
- **Leverage** — what callers gain from depth.
- **Locality** — what maintainers gain: change, bugs, knowledge concentrate in one place.

### Principles

- **Deletion test.** Imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it earned its keep.
- **The interface is the test surface.** If you want to test past the interface, the module is the wrong shape.
- **One adapter = hypothetical seam. Two adapters = real seam.** Don't introduce a port unless something actually varies across it.
- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small mockable parts — they just aren't part of the interface.

### Rejected framings

- Depth as ratio of impl-lines to interface-lines (Ousterhout) — rewards padding. Use leverage.
- "Interface" as the TS `interface` keyword or class public methods — too narrow.
- "Boundary" — overloaded with DDD bounded contexts. Say **seam**.

## Process

### 1. Read domain language first

Read the project's domain glossary before exploring code (commonly `docs/vocabulary.md` or `CONTEXT.md`). Note the canonical nouns. Check for `docs/adr/` — if present, skim entries in the area you'll touch so you don't re-litigate decisions; if absent, skip.

Also read `docs/architecture.md` (or equivalent) for the package graph.

### 2. Spawn one Explore subagent

Do **not** explore inline — the subagent's brief is what produces a structured report. Use `subagent_type=Explore`.

The brief must contain, inline:

1. The **glossary** above — copy it verbatim into the prompt. Without it, the agent drifts to generic vocabulary.
2. The **deletion test** + **interface-is-test-surface** + **two-adapters-or-no-seam** principles.
3. Domain vocabulary names from the project's glossary (the agent should use these for what a deepened module would own).
4. **Repo orientation already gathered** — package graph, hub modules, key data flows. Don't make the agent rediscover what's already documented.
5. **Specific paths to inspect** — a numbered hit-list of directories/files. Without this, the agent wanders.
6. **Per-candidate output schema** — Files / Problem / Deletion test / Sketch / Depth gain / Locality gain / Test surface change.
7. **An "already deep — preserve" section requirement** — symmetric so we know what to leave alone.
8. **Budget** — "5–10 strong candidates, not 30 weak ones. Skip cosmetic refactors / file moves / naming nits."

See `## Subagent prompt template` below for a paste-ready scaffold.

### 3. Present numbered candidates to user

Distill the subagent's report into a numbered list. Each candidate:

- **Files** — exact paths, line ranges where useful
- **Problem** — concrete description of the shallow interface or scattered logic
- **Deletion test** — does deleting this concentrate complexity (earns keep) or disperse it (pass-through)?
- **Sketch** — what the deepened module would own, in domain vocab. **Do not propose interfaces yet.**
- **Leverage** — what callers/tests gain
- **Locality** — where bugs/changes would concentrate
- **Test surface change** — how the test boundary moves

Then add an "already deep — preserve" section.

End with: _"Which of these do you want to explore?"_ Do not start designing.

### 4. Grilling loop (when user picks one)

Walk the design tree with the user — constraints, dependencies, the shape of the deepened module, what sits behind the seam, what tests survive.

Side effects inline as decisions crystallize:

- **Naming a module after a concept not in the glossary?** Add the term.
- **Sharpening a fuzzy term during the conversation?** Update the glossary then.
- **User rejects with a load-bearing reason that future explorers would need?** Offer to record an ADR under `docs/adr/`. Skip ephemeral rejections ("not worth it now") and self-evident ones.

### 5. Optional — parallel interface design

When the user wants to explore alternative interfaces for a chosen candidate, use the "Design It Twice" pattern (Ousterhout): your first idea is unlikely to be the best.

1. Frame the problem space user-facing: constraints, dependency category (in-process / local-substitutable / remote-but-owned / true-external), illustrative sketch.
2. Spawn 3+ subagents **in parallel** with different design constraints:
    - Agent 1: minimize the interface — 1–3 entry points max, maximise leverage per entry.
    - Agent 2: maximise flexibility — many use cases, extension points.
    - Agent 3: optimise for the most common caller — make the default trivial.
    - Agent 4 (if cross-process deps): ports & adapters around the network seam.
3. Each subagent outputs: interface (with invariants/ordering/error modes), usage example, what the implementation hides, dependency strategy + adapters, trade-offs.
4. Present sequentially, then compare in prose by **depth**, **locality**, **seam placement**. Be opinionated — recommend one (or a hybrid). User wants a strong read, not a menu.

### Dependency categories (for step 5)

- **In-process** — pure / in-memory. No adapter needed. Merge and test directly.
- **Local-substitutable** — has a local stand-in (PGLite for Postgres, in-memory FS). Internal seam, no port at the external interface.
- **Remote but owned** — your own services across a network. Define a port; production adapter (HTTP/gRPC/queue) + in-memory test adapter.
- **True external** — Stripe, Twilio, etc. Inject a port; tests use mock adapter.

### Testing strategy: replace, don't layer

- Old unit tests on shallow modules become waste once tests at the deepened module's interface exist — delete them.
- New tests sit at the deepened module's interface. Assert observable outcomes through the interface, not internal state.
- Tests should survive internal refactors. If a test changes when implementation changes, it tests past the interface.

## Subagent prompt template

Paste-ready scaffold for step 2. Replace `{{REPO_ROOT}}`, `{{DOMAIN_GLOSSARY}}`, `{{ARCHITECTURE_DOC}}`, `{{HIT_LIST}}`. Keep the glossary block verbatim.

```text
You are running architecture exploration on the repo at {{REPO_ROOT}}.

Your job: walk the codebase and surface architectural friction — places where modules are SHALLOW and would benefit from being made DEEP.

Vocabulary (use these exactly — do not drift to "component / service / API / boundary"):

- Module — anything with an interface and an implementation. Function, class, package, slice. Scale-agnostic.
- Interface — everything a caller must know: types, invariants, ordering, error modes, required config. Not just the type signature.
- Depth — leverage at the interface. Deep = lots of behaviour behind small interface. Shallow = interface nearly as complex as implementation.
- Seam — where an interface lives. (Not "boundary".)
- Adapter — concrete thing satisfying an interface at a seam.
- Leverage — what callers gain from depth.
- Locality — what maintainers gain: change/bugs/knowledge concentrated in one place.

Tests to apply:
- Deletion test: imagine deleting the module. If complexity vanishes, it was a pass-through. If complexity reappears across N callers, it earned its keep.
- The interface is the test surface. If you want to test past the interface, the module is the wrong shape.
- One adapter = hypothetical seam. Two adapters = real seam.

Domain language: {{DOMAIN_GLOSSARY}}. Use those nouns when describing what a deepened module would own.

Repo orientation: {{ARCHITECTURE_DOC}} summarises the package graph. Key facts already gathered:
- <bullet list of hub modules, data flows, compute paths, etc.>

Walk these areas — read code, do not skim:
{{HIT_LIST}}
- <path 1> — <what to look for>
- <path 2> — <what to look for>
...

For each candidate capture:
- Files — exact paths, line ranges where useful
- Problem — concrete description of the shallow interface or scattered logic
- Deletion test — concentrate or disperse?
- Sketch — what the deepened module would own (in domain vocab). Do NOT propose full interfaces.
- Depth gain — leverage callers/tests get
- Locality gain — where bugs/changes concentrate
- Test surface change — how the test boundary moves

Be opinionated. Surface 5–10 STRONG candidates, not 30 weak ones. Skip cosmetic refactors, naming nits, file moves.

Also include an "already deep — preserve" section listing modules that pass the deletion test well, so we know what to leave alone.

Output: numbered list of candidates with the structure above + the preserve section. Cite file:line where useful. Read enough files to be specific, not vague (~20–40 reads expected).
```

## When this works best

- Repos in alpha / greenfield where renaming and reshaping is cheap.
- Codebases that have grown by per-entity module proliferation and now feel "scattered."
- Times when test wiring feels disproportionate to what's being tested.

## When to skip

- Active incident or under deadline pressure — deepening is structural work.
- Single-module diffs — use a review skill instead.
