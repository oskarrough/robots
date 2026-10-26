---
name: arbe-land
description: Use when asked to organize pending repo changes or commit and push main, especially when work spans several tasks or includes unrelated or unfinished changes.
---

# Land

Read the repo's root `AGENTS.md` and the `arbe-jj-jujutsu` skill. For commit and PR titles and bodies, follow the `arbe-pr-writing` skill.

## 1. Propose first

Check uncommitted files, unpushed commits, bookmarks, and work on other branches. Read the changes and relevant task or worker notes. `main@origin` reflects the last fetch, not necessarily what's on the server now.

Show **Before → Proposed after** commit lists, oldest first: current commit titles before, proposed titles after. Include uncommitted work under Before and anything left pending under After. Make combinations clear; explain only decisions that need context, not every command.

Account for all pending work:

- **Keep separate:** finished changes that do different things, including unrelated work.
- **Combine:** follow-up fixes for the same work—not just changes to the same files.
- **Leave pending:** unfinished work or anything we're not pushing. Keep it intact.
- **Ask:** if it's unclear who owns the work, whether it's ready, or what it depends on. Suggest what to do.

Example:

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

End with: “Proceed with this grouping, then check and push main?”

**Wait for approval before edits, checks, fetches, history changes, or pushes.** Only do what was approved. If there's nothing to push, say so and stop.

## 2. Organize the commits

After approval, fetch `origin`, check again, and record the change IDs and remote main's commit hash. If new work appears or the plan changes, ask for approval again.

Keep each commit focused on one result. Use only the commands needed:

- `jj commit -m "Sentence" -- <files>` — commit a related group of uncommitted files.
- `jj describe -r <id> -m "Sentence"` — update a commit's message.
- `jj squash --from <source> --into <target> -u -- <files>` — combine follow-up fixes with their original commit, newest first.
- `jj absorb --from <source> --into '<approved-commits>' -- <files>` — let jj place small fixes in earlier approved commits. Review `jj op show -p` and check anything it left behind.
- `jj split -r <id> -m "Sentence" -- <files>` — separate unrelated work in one commit.

Check status before changing history. Name the change IDs and files explicitly; leave files unspecified only when the whole commit is approved. Always supply `-m` or squash `-u`, before `--`; don't open an editor or interactive picker. For paths with brackets, use jj's literal path syntax, e.g. `'cwd:"apps/www/src/routes/[id]/+page.svelte"'`.

After moving selected files, check what moved and what remains: jj can silently skip unmatched paths. After commit, check `jj show --stat -r @-`. Never discard others' edits or rewrite pushed commits. **Pushing a commit also pushes earlier commits it depends on.** Make sure work we're leaving out isn't among them. If separating work is unsafe or causes conflicts, stop and ask.

## 3. Check the changes to push

Review everything being pushed, including earlier commits—not just this session's files. Follow `AGENTS.md` for the relevant checks, tests, generated files, tasks, changelog, and live testing. Check exactly the code we're pushing, without unfinished edits mixed in; agree on a safe way to do that if needed. Put formatting and build changes in the commit they belong to, then rerun affected checks.

**At any blocker, report `blocked: <exact thing>` and stop.** Don't repair the environment, weaken checks, bypass safeguards, or make unapproved production writes just to finish.

## 4. Push

Fetch again. If someone updated remote main, review how to include their work and what to recheck before proceeding. Confirm the final commit includes current remote main and only approved changes beyond it. Record its commit hash, then:

```sh
jj bookmark set main -r <approved-change-id>
jj git push --remote origin --bookmark main
```

Push only `main`; if the push is rejected, stop rather than override it. This starts production deployment.

Finish briefly: what was pushed and anything pending or blocked. Follow the root deployment verification requirements before reporting completion; if the user asks not to wait, offer to watch it instead.
