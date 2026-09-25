---
name: arbe-system-overview
description: Overview of everything at once. Recon local repos, GitHub, Linear and the vault's project notes, then present one screen of what's moving, what's stuck, and what has drifted from the declared focus. Use when Oskar asks "where am I", "what's going on", "overview", or runs /system-overview. One project is arbe-project-overview; one machine's repos is the git-overview CLI.
---

# System overview

One screen. What's moving, what's stuck, what I said I'd focus on versus what I actually touched. Then one next step.

Arguments: an optional window in days. Default 7. `/system-overview 30` widens it.

## 1. Recon

One call:

```
bash recon.sh 7
```

`recon.sh` lives next to this file. It finds the vault (`NOTES_VAULT`, else the usual paths per machine) and the sites folder on its own, runs every source, and prints one section each: local repos (dirty, or touched inside the window), GitHub pushes across all machines, Linear issues for team OSK, the last log entry from `weekly.md`, and the head of each `projects/` note matching an active repo.

It fetches every remote before scanning, so it takes ~20s. That fetch is the whole point of the local section: without it, ahead/behind are measured against stale refs and *behind is invisible* — a repo six commits behind with a duplicate commit of its own reads as a clean one-commit push. Use `--no-fetch` only when offline, and say so in the sources line.

Its output is the truth for this run. Don't re-check its findings with your own `ls`, `git status` or greps, and don't go looking for API keys. A source that prints "not reachable" is not reachable on this machine today, whatever other notes say about where a key or folder lives; report it in Stuck and carry on.

**An empty source is not a clean bill of health.** The local section prints `scanned: N repos`. If N is 0, or a source's heading is followed by nothing, that source is blind — it goes in the sources line as `empty` and in STUCK with a verb, never as `ok`. Only a source that returned rows may be called ok.

If there's no bash (a Windows host without WSL), do the script's five sections by hand in the same order, one command each, and stop at the first failure per source.

## 2. Cross-reference

This is the part that earns the skill. Raw lists I can get myself.

Declared focus from the weekly entry versus observed activity from git, GitHub and Linear. Something declared but untouched in the window is drifting. Something active but never declared is either a distraction or a focus that hasn't been written down yet. Say which, or ask.

Dirty or unpushed repos are loose ends. Name them with the change count and the age of the last commit. A repo with thousands of modified files is tracked `node_modules`, not work; say so in five words and move on.

**↑ and ↓ are different problems and never share a row's verdict.** ↑ is your own work, on this machine only, unbackuped — it goes in STUCK with "push". ↓ is just a stale checkout — worth a "pull" only if you're about to work there. **↑ together with ↓ is the dangerous one:** you have local commits *and* the remote has moved, so the push will be rejected and your commit may already exist upstream under another name. That row's verb is "reconcile", not "push", and the next step is to compare the two before touching either.

Local state is one machine's view. A repo can be clean here and dirty on the laptop. GitHub is the cross-machine truth for what moved; local is the truth for what's messy here.

Gaps between sources. A repo with recent pushes but no `projects/` note. A `projects/` note whose repo hasn't moved in a year. A Linear project with open issues and no commits. One line each, only if worth acting on.

## 3. Present

One screen, one fenced code block, fixed width so the columns hold. Think 1970s IBM print: a grid, uppercase labels, one rule, numbers aligned, no ornament. Plain words inside the grid. No `- **Label:** text` lists, no emoji, no headers outside the block.

Shape:

```
PROJECT OVERVIEW                        2026-09-08  window 7d
sources   local 55 repos   github ok   linear no key   vault ok
────────────────────────────────────────────────────────────
FOCUS     31 Aug   Publix and Arbe.  Arbe moved. Publix didn't.

MOVING    project           last     seen        state
          arbe              today    gh local    clean, pushed
          dodgethis         today    gh local    1 file dirty
          kant              today    gh          not cloned here
          llmlake           3 Sep    gh

STUCK     what                        since      do
          linear                      here       set LINEAR_API_KEY on this box
          OSK-291 Skat 2025           40d        finish or move to backlog
          radio4000/supabase  ↑1 ↓6   13d        reconcile: remote moved, may be a dup
          flerefugle/website  ↑4      7 mo       push or drop the branch
          radio4000/cli       ↓19     9 mo       pull or archive
          discord-mini        ↑1      6 mo       push; untrack node_modules

DRIFTING  publix              declared 31 Aug, silent since 13 Aug
          kant sctv skrivebord robots  active, never declared

NEXT      fill the 31 Aug scoreboard, then say whether the focus is still Publix and Arbe.
```

Rules for the grid:

Line one: title, today, window. Line two: each source with ok or the reason it isn't, two words at most — and for local, the repo count (`local 55 repos`), so an empty scan cannot hide behind the word ok. The rule is one line of box-drawing dashes.

FOCUS is the weekly entry's focus with its date, then a verdict of a few words. If the entry is older than two weeks, the verdict is "stale".

MOVING is a table, most recent first, cap seven. `last` is the most recent push or commit. `seen` lists the sources that saw it: gh, local, linear. `state` is a few words or blank. Merge repos that belong to one project on one row.

STUCK is the actionable list. Every row ends with a verb in the `do` column. Sources that couldn't be read come first, because they blind the overview. Then Linear issues in progress longer than the window, then unpushed or behind branches, then dirty repos worth naming. Skip debris that isn't worth a verb.

DRIFTING is two kinds of row: declared with no activity, and active with no declaration. Name the projects, one short clause each.

NEXT is one sentence. If the weekly entry is stale or its scoreboard is empty, that's the sentence.

Dry wit is allowed in the verdict clauses, one line at most. The grid does the talking.

## Don'ts

Don't fake a source. Don't hunt for one either.

Don't create or edit anything. Read only. If the overview surfaces something to fix, propose it as the next step.

Don't pad. If a section is empty, write "nothing" and move on.
