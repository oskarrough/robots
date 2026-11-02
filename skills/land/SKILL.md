---
name: arbe-land
description: Use when asked to organize pending repo changes or commit and push main, especially when work spans several tasks or includes unrelated or unfinished changes.
---

# Land

Read the repo's root `AGENTS.md` and `arbe-jj-jujutsu`. Titles follow `arbe-pr-writing`.

## 1. Propose

Look at uncommitted files, unpushed commits, bookmarks and other branches. Show the commits before and after, oldest first:

```text
Before:
  Fixed chat replies
  Corrected the chat fix
  Updated setup docs
  Uncommitted: director-test edits

Proposed after:
  Fixed chat replies
  Updated setup docs
  Left pending: director-test edits
```

Keep finished changes that do different things separate. Combine follow-up fixes with what they fix. Leave unfinished work pending and intact. Ask when ownership or readiness is unclear, with a suggestion.

End with "Proceed with this grouping, then check and push main?" and wait. Do nothing before the answer: no edits, checks, fetches or pushes. Skip the wait only if Oskar already said to land this work (e.g. a lead running the loop); then the proposal goes in your report instead.

## 2. Organize

Fetch, check again, and note remote main's hash. If anything new appeared, ask again.

- `jj commit -m "Sentence" -- <files>`
- `jj describe -r <id> -m "Sentence"`
- `jj squash --from <src> --into <dst> -u -- <files>`, newest first
- `jj absorb --from <src> --into '<approved>' -- <files>`, then `jj op show -p`
- `jj split -r <id> -m "Sentence" -- <files>`

Always pass `-m` or `-u`; never open an editor. Brackets in paths need `'cwd:"src/routes/[id]/+page.svelte"'`. jj silently skips unmatched paths, so check what moved (`jj show --stat -r @-`). Never discard others' edits or rewrite pushed commits. Pushing a commit pushes its ancestors too; make sure pending work isn't among them. If separating work is unsafe, stop and ask.

## 3. Check

Review everything being pushed, not just this session's files. Run what AGENTS.md asks on exactly that code, without unfinished edits mixed in. Formatting and build fixes go in the commit they belong to.

At any blocker, report `blocked: <exact thing>` and stop. Don't repair the environment, weaken checks or write to production to finish.

## 4. Push

Fetch again. If remote main moved, work out what to recheck first. Then:

```sh
jj bookmark set main -r <id>
jj git push --remote origin --bookmark main
```

Push only `main`; if it's rejected, stop. This deploys. Verify the deploy the way AGENTS.md says, then report in a line or two: what went out, what's pending or blocked.
