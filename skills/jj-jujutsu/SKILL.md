---
name: arbe-jj-jujutsu
description: Use for any version-control or git command — we use jj (jujutsu) instead. Covers change vs commit, no staging area, explicit revisions, safe split and restore.
---

# Version control (jj)

<important when="using version control with jj">

We interact with git using `jj` (jujutsu). Use `--help` to learn flags.

## Mental model

No staging area — the working copy IS the current change. `@` = current, `@-` = parent. Every command auto-snapshots. One change per task; `jj commit` to close.

**Prefer explicit change IDs over `@`/`@-`.** Parallel agents move `@` between your commands. Capture the ID up front (`jj log -r @ --no-graph -T change_id`) and pass it: `jj split -r <id>`, `jj describe -r <id>`, `jj squash --from <A> --into <B>`, `jj abandon -r <id>`. `jj commit` has no `-r` and always acts on `@` — `jj edit <id>` first if `@` may have moved. Always pass explicit file paths too, with `-m` before `--` (see Selective changes). Re-check `jj st` before destructive ops.

**Nothing is pushed yet, so fix the commit instead of appending one.** A follow-up to work you just committed (a typo, a stale pointer you spotted a minute later, a review nit) belongs *in* that commit: `jj squash -r <id> -u` folds it into its parent, `jj squash --from <A> --into <B> -u` targets any commit. Start a new commit only when the work is a genuinely different subject. The log should read as the change you'd want reviewed, not a diary of the order you noticed things.

**Leave `@` empty and undescribed when done.** A described `@` is a trap for the next `jj describe`. Non-empty revisions need a description (fix with `jj describe -r <id> -m "..."`). Before finishing, scan `jj log` for non-empty undescribed revisions — usually orphans from a squash or rebase.

**Before writing code, `jj log --limit 3`.** If `@` has a description or prior changes, `jj new` first (both `jj describe -m` and `jj commit -m` overwrite the current description). Safe sequence: `jj new` → capture id → work → `jj commit -m "..."`.

## Commands

```sh
jj st                                    # status
jj log                                   # history graph
jj log -r @ --no-graph -T change_id      # capture current change ID
jj diff --stat                           # what changed (never bare jj diff — burns context)
jj diff <path>                           # inspect specific files
jj new                                   # fresh change on top of @
jj commit -m "msg" -- <files>            # close @ keeping <files> (wrap [id] paths: cwd:"...")
jj edit <id>                             # move @ to an existing revision
jj abandon -r <id>                       # discard empty revision
jj restore --from main <file>            # restore a file from another revision
```

**`jj run <shell_command> -r <revset> -j <jobs>`** runs a command across a set of revisions in parallel, each with its own private working copy (e.g. `jj run 'cargo check' -r 'trunk()..@' -j 4`) — still a stub/WIP on our installed jj 0.41 (`jj run --help` says "does not work yet").

## Selective changes

**Bare fileset paths are `prefix-glob:` — `[` and `]` are glob character classes.** So SvelteKit routes like `[house_id]` or `[...path]` silently match **nothing**: `jj commit -- .../[house_id]/+page.svelte` closes `@` without that file, leaving it stranded in the new `@`. Shell quoting does NOT help — jj parses the glob after the shell. **Fix: wrap any path containing `[`/`]` in `cwd:"..."`** (literal prefix, no glob; matches a file or a whole directory subtree, verbatim):

```sh
jj commit -m "msg" -- 'cwd:"apps/www/src/routes/houses/[house_id]/+page.svelte"'   # one file
jj commit -m "msg" -- 'cwd:"apps/www/src/routes/houses/[house_id]"'                 # whole [house_id] subtree
```

Unmatched paths are dropped **without error** — `commit`/`squash`/`split`/`restore` report success and move only the files that matched.

**Same failure mode, no globs needed: wrong directory level.** A plain path that doesn't exist also matches nothing and is dropped silently. If a commit's stat check comes back missing a file you named, check the real path with `jj file list <dir>/` before trusting a remembered path — repo conventions sometimes nest a level deeper than the doc says.

**`-m "msg"` before `--`, never after.** Everything after `--` parses as filesets, so a trailing `-m` becomes a fileset arg (parse error or silent editor fallback); bare `commit`/`split` opens an editor too — both hang non-interactive shells. Always `jj commit -m "msg" -- f1 f2`.

**MANDATORY after every `jj commit -- <files>`: `jj diff -r @- --stat`, check the file list is what you meant.** A typo'd or unmatched path produces a partial or empty commit that reports success (has shipped commits missing their key file twice). Stranded files stay in the new `@` — fix with another `jj commit` or `jj squash --into @-`.

**Committing selected files from a mixed working copy** — `jj commit -m "msg" -- f1 f2` keeps the listed files in `@` (closing it) and moves the rest to a new `@`. Repeat per group; the last commit leaves an empty, undescribed `@` — the clean tip the next session needs.

**Never `jj restore` to clean up a mixed working copy.** Parallel agents' in-flight edits get auto-snapshotted into *your* `@`; `jj restore --from @- --to @ <files>` rewrites those files to the committed state, silently destroying their uncommitted work. Use `jj commit -- <your-files>` instead — everything else stays on the fresh `@`. `restore` is only safe on files you alone touched, to throw away your *own* edits.

**`commit` vs `split`** — `commit` closes `@`, leftovers become the new `@`. `split` restructures any revision into two (`-r <id>`, description copied to both halves) but always opens an editor, even with paths — so use `commit` in non-interactive shells. Check `jj st` before `commit -m`: if `@` carries a parallel agent's description, your `-m` overwrites it. Don't interrogate the user file-by-file — propose a split (theirs vs. yours, based on what *you* touched this session) and ask y/n. If you didn't edit anything, say so; the answer is probably "commit it all as theirs, `jj new` for me".

```sh
jj split -r <id> -- <files>                # split files out of a revision
jj squash --from <A> --into <B> -- <files> # route files between any two revisions
```

**`jj absorb`** routes hunks from `@` into the ancestor that last touched those lines; ambiguous hunks stay in `@`. Review with `jj op show -p`; `@` auto-abandons if fully absorbed and undescribed. Run it periodically to fold a parallel agent's ongoing edits back into your described commits — `Nothing changed` means every hunk already sits in its owning commit.

```sh
jj absorb                                # route all hunks to origin commits
jj absorb <file>                         # absorb only specific files
```

## Squashing many commits

Use when ~10 session commits should become 1–2. **Only squash committed revisions** — leave a dirty `@` and unrelated commits alone.

### Hang triggers (non-interactive shells)

These look like hangs; they are usually **waiting for an editor or a prompt**:

| Command | Why it stalls |
|---------|----------------|
| `jj squash --from A --into B` (no message flags) | Both sides have descriptions → jj opens an editor for the combined message |
| `jj squash -i` / `--interactive` | Hunk picker |
| `jj split` (even with paths) | Always opens an editor |
| `jj rebase -s 'A::B' -o C` on a chain that touched the same files | Conflicts; fix/undo loops feel endless |

**Fix:** pass `-m "..."`, or **`--use-destination-message`** (`-u`) on every squash where both revisions are described. Set the final subject once with `jj describe -r <id> -m "..."` at the end.

### Don'ts

- **Don't `jj edit` an ancestor** while `@` has uncommitted work — jj auto-snapshots `@` into the revision you edited.
- **Don't rebase a chain apart** just to squash it — overlapping edits (e.g. the same `.svelte` file in many commits) often conflict on rebase. Prefer `squash --from/--into` on committed IDs.
- **Don't squash unrelated commits** — read `jj show <id> --stat` first; keep parallel-agent / other-feature commits out of the `--from` set.
- **Don't rely on `@`** mid-squash — capture IDs up front; parallel agents move `@`.

### Preferred recipe (~10 → 2)

1. `jj log -n 30` — list session commits; pick **two keeper IDs** (e.g. feature base + polish base). Note unrelated IDs to skip.
2. Capture IDs explicitly (`jj log -r @ --no-graph -T change_id` if you need `@`).
3. Squash **newest → oldest** into the nearest keeper, one revision at a time, always with `-u`:

```sh
# Example: squash polish-chain tips into keeper tpyzlspp, feature tips into spprksoq
jj squash --from <newest-polish> --into tpyzlspp --use-destination-message
jj squash --from <next-polish>   --into tpyzlspp --use-destination-message
# ... repeat for each polish commit ...

jj squash --from <newest-feature> --into spprksoq --use-destination-message
# ... repeat ...

jj describe -r tpyzlspp -m "Workflow UI polish: list layout, metadata, fixes"
jj describe -r spprksoq -m "Workflow UI: overview, detail, run console, creative create"
```

4. Verify: `jj log -n 8`, `jj st` (conflicts?), `jj show <keeper> --stat`.
5. Optional cleanup: `jj log -r 'empty()'` — abandon empty orphans from squashed-away revisions.

`-u` discards source messages during intermediate squashes; **`describe` at the end** sets the real subject. (Or `-m "temp"` on each squash.)

### When rebase is needed

Rebase only to **exclude** a commit from a chain (e.g. move `tyvomsxu` past the workflow stack: `jj rebase -s tyvomsxu -o <after-workflow-tip>`). If rebase conflicts, `jj undo` and fall back to squash-only. Descendant rebases after squash can briefly conflict on hot files — jj usually resolves as it rebases children.

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

Good: `Throw ArbeError from core/threads.`
Good: `Stop logging 'undefined' in mutation logs. Closes arbe-e9d8.`

**Committing something a user could notice? Add the `[Unreleased]` bullet in the same change** — in arbe that is `docs/changelog.md`, contract in AGENTS.md → Changelog. The bullet is user-facing prose, not a copy of the subject line.

No AI/Claude/Anthropic/`Co-Authored-By` attribution in commits, PRs, or files.

</important>
