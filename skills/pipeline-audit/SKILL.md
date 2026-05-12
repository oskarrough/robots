---
name: arbe-pipeline-audit
description: 'Interactive guard — walk a README pipeline diagram against the real code and flag every function in the path that the diagram does not justify. Catches shims, single-caller helpers, and same-args wrappers before they accumulate. Use when the codebase feels overgrown, before a refactor sweep, or as a pre-merge check on a path that touched many files. Anchored on README diagrams as the budget.'
---

# Pipeline audit

**Make the README diagrams executable** — walk each user-verb pipeline against the code and flag any function in the path that isn't a stage, has one caller, or wraps the same args as its callee.

The diagram is the budget. If the diagram says "create a file" is 7 stages and the code traverses 14 functions, the delta is disguise. Most of the delta is helpers that were reached for before the duplication earned them.

## When to run

- Codebase feels overgrown — too many `requireX` / `decodeX` / `useX` / `getX` helpers and not sure which earned it
- Before a refactor sweep — get a list of suspects before touching anything
- After a big diff — sanity check that the new code respects the diagram's shape
- When the gut says "3 functions where 20 grew"

Skip during active feature work — this is for sweeps, not in-flight design.

## Run in a fresh conversation

**Always invoke this skill in a new session, not one that just refactored the path you're auditing.** The skill earns its keep by reading the code with no priors. An LLM that just deleted `requireFileRow` will "find" the wrappers it remembers, not the wrappers the diagram is actually missing. The result looks like a successful audit but is just recall.

If the user wants to audit a path they just worked on, hand off via the `arbe-handover` skill or open a new conversation with only the skill name + target diagram as context.

## Smells

Three tests, applied to every function in the path:

1. **Not in the diagram** — function isn't a stage the README diagram names. Maybe the diagram is incomplete (promote it to a stage) or maybe the function is dead weight (inline it).
2. **Single caller** — function has one non-test caller. Either inlinable or a stage the diagram forgot.
3. **Same-args shim** — function's args match its only callee's args, and the body is a thin transform (null → failure, error → typed error, etc). Always inlinable; the wrappee is the real function and the wrapper is in disguise.

A function failing one test is a candidate. A function failing two is almost certainly disguise.

## Process

### 1. Pick the diagram

List the README's pipeline diagrams (the fenced ASCII blocks under "Vocabulary" or similar). Ask the user which one to audit. If only one exists, skip the ask.

### 2. Trace the path

Find the entry point named by the diagram's first line (`POST /stores/:id/files`, etc). Walk the call graph from that entry to the terminal action (DB write, response). Record every function crossed, in order.

Use rg, not grep. Read the entry handler, follow each `yield*` / `await` / direct call. Stop at framework boundaries (HTTP routing, DB driver) and at well-known leaf modules (the embedder, the chunker — these are stages, not infrastructure to inspect).

### 3. Map functions to stages

For each function in the path, mark which diagram stage it implements. Output a table:

```
function                  stage in diagram               smells
─────────────────────────────────────────────────────────────────
createFile handler        "insert files row + enqueue"   —
requireStore              (none — preflight)             single-caller in this path
getStoreConfig            (none — config read)           single-caller in this path
indexQueue.enqueue        "enqueue index job"            —
getFile (at end)          (none — re-fetch)              same-args shim around row decode
```

The "(none)" rows are the candidates. Don't decide yet — list and stop.

### 4. Walk the user through the candidates, one at a time

This is the interactive part. **Do not dump the whole list and ask for a verdict.** Two reasons, and the second matters more than the first:

- Humans glaze over lists. A 12-item verdict screen gets a tired "yeah looks fine" instead of real judgment.
- **The LLM doesn't know which candidates are load-bearing.** A "keep" usually has an invisible reason (a future caller, a contract with an external surface, a historical bug). A "promote" is a README change worth its weight only if the stage is actually conceptually distinct. Without per-candidate questioning, the LLM bulldozes through with confidently wrong batch verdicts. One at a time forces the LLM to surface its uncertainty.

Take one candidate, ask one question, get one answer, move to the next.

For each candidate, surface in this order:

1. **Candidate line** — `<name> (<file:line>) — <smell, one phrase>`
2. **Lean** — the literal first line under the candidate, formatted as `lean: <verdict> — <one sentence why>`. Not in prose, not hedged, not buried after a "design context" paragraph. This is the LLM's read. The user confirms or overrides. If genuinely torn, still pick the one you'd ship.
3. **Verdicts** — four options, numbered:
    - **remove** — inline at the (one) callsite; the function isn't earning its name
    - **keep** — there's a reason; capture the reason in a one-line comment above the function
    - **promote** — the diagram forgot a stage; update the README to name it
    - **reshape** — the function is a symptom of a wrongly-shaped data flow. Propose the smaller path edit (move the read into the consumer, drop a courier arg, fold two stages) that makes the candidate disappear because the chain it served stopped existing. Different from `promote` (which extends the diagram to legitimise the function) and from `remove` (which assumes the work stays, just moves).
4. **Type something…** — user override slot

**Bias warning.** When in doubt, the LLM defends the status quo and labels alternatives as "larger changes" or "follow-ups." That's not a real signal — size of change is not the axis. The axis is **cleaner / less code / matches the rest of the codebase**. If one verb of the pipeline (e.g. `reindex`) already does it the cleaner way and another (e.g. `createFile`) is the outlier, the outlier is the one paying for the inconsistency. Lean toward the alignment, not the defence.

Wait for the answer before moving to the next.

### 5. Apply (or queue) the decisions

After the walk, summarise: N removes, M reshapes, P promotes, K keeps. Ask whether to apply now or queue as a task (`./tasks/` or whatever the repo uses).

If applying now: do the removes in one diff, the reshapes in a second, the README promotes in a third, the keep-comments in a fourth. Don't bundle — each diff is reviewable on its own terms.

## Glossary

- **Pipeline** — a user-verb diagram in the README. One verb, ~5–10 stages, tree shape.
- **Stage** — a named node in the diagram. The unit of "did this function earn its place."
- **Path** — the ordered sequence of functions the code actually traverses for one pipeline.
- **Candidate** — a function in the path that fails at least one smell test.
- **Disguise** — a wrapper that looks like a helper but is the real function under a different name (single-caller + same-args).

## Examples

### Same-args shim (real, from this repo)

```ts
const requireFileRow = (storeId, fileId) =>
  Effect.gen(function*() {
    const row = yield* getFile(storeId, fileId)
    if (!row) return yield* Effect.fail(new FileNotFound({ id: fileId }))
    return row
  })
```

Walks: same args as `getFile`, one transform (null → failure), three callers. Verdict: remove the wrapper, fold the failure into `getFile` itself (the wrappee is the real function in disguise). One caller wanted nullable? Wrap *that* one with `Effect.option`, not the other way round.

### Single-caller in path

`getStoreConfig` is called once from the createFile handler. Verdict typically **keep**: it lives in `services.ts` next to other store helpers and the SQL is non-trivial. But the comment above it should say *why* it's its own function (e.g. "isolated so the chunker can read config without a HTTP-shaped dep"), not just describe what it does.

### Stage the diagram forgot

The chunker's `mediaPageToChunks` is called from `chunk()` and does real work, but the README's create-file diagram lumps it under "pages → chunks". Verdict: **promote** — add the sub-tree to the diagram so the next audit knows it's a stage, not a candidate.

## When this works best

- Repos with README pipeline diagrams already drawn (`arbe-diagram-first` is the upstream skill)
- Greenfield / alpha — renaming and inlining is cheap
- Codebases that grew by per-feature helper proliferation

## When to skip

- No README diagrams exist yet — run `arbe-diagram-first` first to establish the budget
- Active incident or feature deadline — this is structural hygiene, not urgent
- Single-file diffs — use `arbe-review` instead

## Pairs with

- **arbe-diagram-first** — draws the budget this skill audits against
- **arbe-review** — diff-time check; this skill is path-time
- **arbe-improve-codebase** — shallow-vs-deep at the module scale; this is the function scale
