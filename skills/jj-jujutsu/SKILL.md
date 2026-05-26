---
name: arbe-jj-jujutsu
description: Use jj/jujutsu instead of git. Covers change vs commit, no staging area, explicit revisions, and safe split/restore. Use for version-control or git commands.
---

# Version control (jj)

<important when="using version control with jj">

We interact with git using `jj` (jujutsu). Use `--help` to learn flags.

## Mental model

No staging area — the working copy IS the current change. `@` = current, `@-` = parent. Every command auto-snapshots. One change per task; `jj commit` to close.

**Prefer explicit change IDs over `@`/`@-`.** Parallel agents move `@` between your commands. Capture the ID up front (`jj log -r @ --no-graph -T change_id`) and pass it: `jj split -r <id>`, `jj describe -r <id>`, `jj squash --from <A> --into <B>`, `jj abandon -r <id>`. `jj commit` has no `-r` and always acts on `@` — `jj edit <id>` first if `@` may have moved. Always pass explicit file paths too — bare `commit`/`split` opens an editor and hangs non-interactive shells. Re-check `jj st` before destructive ops.

**Leave `@` empty and undescribed when done.** A described `@` is a trap for the next `jj describe`. Non-empty revisions need a description (fix with `jj describe -r <id> -m "..."`). Before finishing, scan `jj log` for non-empty undescribed revisions — usually orphans from a squash or rebase.

**Before writing code, `jj log --limit 3`.** If `@` has a description or prior changes, `jj new` first. Both `jj describe -m` and `jj commit -m` overwrite the current description. Safe sequence: `jj new` → capture id → work → `jj commit -m "..."`.

## Commands

```sh
jj st                                    # status
jj log                                   # history graph
jj log -r @ --no-graph -T change_id      # capture current change ID
jj diff --stat                           # what changed (never bare jj diff — burns context)
jj diff <path>                           # inspect specific files
jj new                                   # fresh change on top of @
jj commit -m "msg" -- <files>            # close @ keeping <files> (escape [id] as [[]id[]])
jj edit <id>                             # move @ to an existing revision
jj abandon -r <id>                       # discard empty revision
jj restore --from main <file>            # restore a file from another revision
```

## Selective changes

**Fileset paths use glob syntax.** Literal `[` and `]` match character classes, so SvelteKit routes like `[id]` or `[...path]` silently match nothing. Escape them: `[[]id[]]`, `[[]...path[]]`. Unmatched paths are dropped without error — `squash`/`split`/`restore` report success and move only files that matched. After any fileset-based rewrite, verify with `jj show <id>` or `jj diff -r <id>`.

**Committing selected files from a mixed working copy** — `jj commit -m "msg" -- f1 f2` keeps the listed files in `@` (closing it) and moves the rest to a new `@`. Repeat per group; the last commit leaves an empty, undescribed `@` — the clean tip the next session needs.

**Never `jj restore` to clean up a mixed working copy.** Parallel agents edit the same working copy, and jj auto-snapshots their in-flight edits into *your* `@` on every command. `jj restore --from @- --to @ <files>` rewrites those files to the committed state of `@-`, silently destroying the other agent's uncommitted work. Use `jj commit -- <your-files>` instead — it preserves everything else on a fresh `@` for the other agent to continue from. `jj restore` is only safe when you know a file is yours alone and you want to throw away *your own* edits on it.

**`commit` vs `split`** — `commit` closes `@`, leftovers become the new `@`. `split` restructures any revision into two (use `-r <id>`), copies the description to both halves, and always opens an editor even with paths — unusable in non-interactive shells. Use `commit` for a mixed working copy; reach for `split` only when an editor is available. Check `jj st` before `commit -m`: if `@` carries a parallel agent's description, your `-m` overwrites it. Don't interrogate the user file-by-file — propose a split (theirs vs. yours, based on the description and what *you* touched this session) and ask y/n. If you didn't edit anything, say so; the answer is probably "commit it all as theirs, `jj new` for me".

```sh
jj split -r <id> -- <files>                # split files out of a revision
jj squash --from <A> --into <B> -- <files> # route files between any two revisions
```

**`jj absorb`** routes hunks from `@` into the ancestor that last touched those lines. Ambiguous hunks stay in `@`. Review with `jj op show -p`. `@` auto-abandons if fully absorbed and undescribed.

```sh
jj absorb                                # route all hunks to origin commits
jj absorb <file>                         # absorb only specific files
```

## Undo

`jj undo` reverts the last operation. `jj op log` for history. `jj restore --from xyz/1 --to xyz` recovers a prior version of a change.

## Bookmarks and PRs

Bookmarks replace git branches. `jj rebase -o main` (not `-d`, deprecated).

```sh
jj bookmark create feature-name
jj git push --bookmark feature-name
gh pr create                             # gh picks up the pushed bookmark
```

## Commit messages

**One line. ~72 chars target, ~100 hard cap.** If you can't fit it, the detail belongs in the PR or task, not the subject. Count before you commit — long subjects wreck `jj log`.

Lead with motivation. Write for a stranger reading the log, not the author who just lived it. Plain words.

No AI/Claude/Anthropic/`Co-Authored-By` attribution in commits, PRs, or files.

</important>
