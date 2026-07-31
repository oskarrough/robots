# Stage 5 — structure outline

The order of changes. Design said where we're going; the outline says how we get there. Header files to the plan's function bodies.

**Reads:** `01-clarified-request.md` + `03-research.md` + `04-design.md`.
**Writes:** `05-structure-outline.md`.

## Do

Break the work into thin **vertical** slices — each phase cuts across as many layers as it needs to and is independently verifiable on its own.

Not horizontal. "All the types", then "all the endpoints", then "the UI" piles up code before any of it can be validated, and a mistake in an early layer only surfaces at the end. A small working path early beats a beautiful pile of disconnected layers.

```markdown
# Structure Outline

## Approach
- How the work is being sliced, in a couple of lines.

## Phases
### Phase 1: [name]
- **Goal** — what is true after this phase that wasn't before.
- **Scope** — what changes, at signature level.
- **Areas** — files and modules involved.
- **Automated verification** — exact runnable commands.
- **Manual verification** — what a human clicks or checks. Omit if there's nothing meaningful.

### Phase 2: [name]
- ...

## Out of Scope
- What is intentionally not included.

## Risks
- Only risks that affect sequencing or validation.
```

## Rules

- Vertical slices over horizontal layers. Always.
- Every phase independently verifiable. No phase N that can only be checked once N+1 lands — if you find one, merge or resequence.
- **No conditional forks.** "If integration tests exist, run them" is not acceptable — find out now and write the exact command. Every decision was already made in stage 4; the outline contains none.
- Automated beats manual. Don't add manual steps for symmetry. A phase with nothing meaningful to check by hand may be too small or not vertical enough.
- Validation should match how the work would actually be tested, not a generic "run the test suite".
- 2–5 phases when possible.
- Signature level only. Save full implementations for stage 6.
- On user feedback — including reordering phases — update in place. Do not start over.

## Done when

Stage 6 can expand each phase into concrete edits without moving a phase boundary, and every phase names a command that proves it works.
