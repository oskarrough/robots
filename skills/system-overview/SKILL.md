---
name: arbe-system-overview
description: What needs doing on this machine (commit, push, pull, per repo), plus a few lines on Linear, activity across machines and the declared focus. One screen. Use when Oskar asks "where am I", "what's going on", "overview", or runs /system-overview. One project is arbe-project-overview; one machine's repos is the git-overview CLI.
---

# System overview

One screen, one machine: what needs doing here, then the bigger picture in a few lines. Oskar is lazy and that's the design brief. If he has to decode it, it failed.

Run it once per machine, one thread each. Arguments: an optional window in days. Default 7. `/system-overview 30` widens it.

## 1. Recon

One call:

```
bash recon.sh 7
```

`recon.sh` lives next to this file. It finds the vault (`NOTES_VAULT`, else the usual paths per machine) and every repo root on its own (`RECON_ROOTS`, colon-separated, else each of `~/sites`, `~/Sites`, `~/code` that holds repos), runs every source, and prints a `## sources` verdict first, then one section each: this machine's repos as verbs, third-party checkouts (`thirdparty/`, `3rdparty/`) holding local work, GitHub pushes across all machines (forks excluded), Linear issues for team OSK, the last log entry from `weekly.md`, and the head of each `projects/` note matching an active repo.

It fetches every remote of every repo first, so it takes ~20s. Without the fetch, behind is invisible. Use `--no-fetch` only when offline, and say so in the sources line.

Its output is the truth for this run, and the `## sources` block is the verdict on each source. Don't re-check its findings with your own `ls`, `git status` or greps, and don't go looking for API keys. A source that prints "not reachable" or "BLIND" is blind today; it goes on the sources line and you carry on.

Linear without a key is not a dead source. When the script says `linear: via connector`, read it through the Linear connector with the two queries it prints.

An empty source is not a clean bill of health. Only a source that returned rows may be called ok.

If there's no bash (a Windows host without WSL), do the script's sections by hand in the same order, one command each.

## 2. The verbs

The local section already speaks in verbs. Never say "dirty".

- `commit`: uncommitted edits. The row names the files; turn that into what the commit would be, in a few words ("nuwacom notes", "fish config").
- `push`: commits that are on no remote at all. Your work, on this machine only.
- `pull`: the remote moved on. Not a chore unless you're about to work there.
- `sync`: both. The push will bounce, and the commit may already exist upstream under another name. Compare before touching either.

A repo with thousands of modified files is tracked `node_modules`, not work. Clean repos aren't listed and don't appear.

## 3. Present

One fenced block tagged `plaintext`, never `text`: bb's highlighter doesn't know `text`, guesses a language and paints "in" and "else" red. Lines under 72 characters. The machine's to-do list comes first and takes most of the space. Everything else is a line or two underneath.

```plaintext
OSK1                                         2026-10-19   7d
sources  local 26   github ok   linear mcp   vault ok
────────────────────────────────────────────────────────────
commit   notes         nuwacom notes, editing now; pull 14 first
         dotfiles      fish and herdr config, sat 3 wk
         slaytheweb    backend + splash, sat 5 mo
push     sf-skipper    6 commits, unpushed 1 wk
sync     supabase      ↑1 ↓6, compare before pushing
pull     agent-ide arbe dodgethis r4-svelte kranoldplatz

3rd party, not yours
         loom          ↑703 ↓749, fork drift, delete folder?
         mwc-sv        stray lockfile, delete folder?

linear   OSK-291 Skat 2025, in progress 193d
         OSK-319 bookmarks, in progress 135d
active   agent-ide arbe commandos robots   (all machines)
focus    3 Oct, none named

next     commit the nuwacom notes, then name a focus for the week.
```

Rules:

Line one: hostname, today, window. Line two: each source, ok or why not in two words; local carries its repo count so an empty scan can't hide behind "ok".

The to-do block: one row per repo, grouped by verb in the order commit, push, sync, pull. Each row says what the work is and how old, nothing else. A bare "3 min" reads as nothing, so the age always carries its meaning: for `commit`, the recon's touched column (newest edit) as "sat 3 wk", or "editing now" under an hour, which means another session is on it, so leave it be; for `push` and `sync`, the last commit as "unpushed 1 wk". Lockfile-only edits aren't work: put those repos on one `lockfiles` row with no detail. All the `pull` repos go on one line with no detail. If there's nothing to do, write "nothing to do here" and move on.

Third-party checkouts never mix into the to-do block. They get their own block under a `3rd party, not yours` header, one row each: what's local, how old, and a verdict, usually "delete folder?" since the upstream lives elsewhere. Leave the block out when the section says nothing.

`linear`: in-progress issues older than the window, oldest first, cap three. `active`: repos pushed in the window from any machine, merged per project, cap six; add "not cloned here" only if that matters. `focus`: the weekly entry's date and focus in a few words; "stale" if older than two weeks. Add a `drift` line only when something is declared and silent, or active and undeclared for weeks.

`next` is one sentence: the single thing worth doing first.

Below the block, nothing. No recap, no offers.

## Don'ts

Don't fake a source. Don't hunt for one either.

Don't create or edit anything. Read only. If the overview surfaces something to fix, it goes in `next`.

Don't pad. If a section is empty, write "nothing" and move on.
