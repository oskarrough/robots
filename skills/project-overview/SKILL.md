---
name: arbe-project-overview
description: Status of one named project. Read its note in projects/, follow its links, find the local clone, fetch, check remote, the live site and Linear, then say where it stands. Use when Oskar names a project and asks where it's at — "where are we with balance mender?", "what's up with bibli", "status of arbe", "/project-overview kant". Everything at once is arbe-system-overview.
---

# Project overview

One project, one answer: where it stands, what's loose, what's next. Everything at once is `arbe-system-overview`; one machine's repos is the `git-overview` CLI.

## 1. Recon

```
bash recon.sh <project name>
```

`recon.sh` lives next to this file. It finds the vault (`NOTES_VAULT`, else the usual paths per machine), then matches the name against `projects/*.md` by filename, `title:` and repo slug, loosely: "balance mender", "balancemender" and "Balance Mender" all land on the same note. Then it prints one section per source:

the note (head and modified date), the note's wikilinks, URLs and backlinks, every local clone under `~/sites ~/Sites ~/code ~/oskarrough` whose origin matches a GitHub repo the note names (old repo names count, so a pre-rename clone still turns up), with fetch, ahead/behind, dirty files, jj changes not yet on trunk, and recent branches. Then GitHub (last push, commits, open PRs and issues, CI), the `url:` from the frontmatter with its HTTP status, open Linear issues mentioning the name, and mentions in `weekly.md`.

It fetches, so ahead/behind are real. `--no-fetch` when offline, and say so.

Its output is the truth for this run. A source that says "not reachable" is not reachable here today. Say so in one line and carry on; don't go hunting for keys.

If the note didn't match, the script lists other vault files mentioning the name. Pick the obvious one or ask. If the project has no note at all, say so; that's a finding.

## 2. Read, then look deeper only where it pays

The script gives the skeleton. Read the whole project note, not just its head — it often has a "where it stands" or "next" section that is the declared state. Open linked notes only when they look like status (a plan, a log, a todo), not background.

If the repo is cloned here and something looks unfinished, look at it: the diff behind a dirty tree, the last few commit messages, a draft PR's description. One or two targeted reads, not a tour.

Compare what the note says against what the code says. A note claiming "next: add bosses" beside three weeks of commits adding bosses is stale. That's worth a line.

## 3. Answer

Chat, not a report. A few lines of prose: where it is, when it last moved and on which machine, anything loose (dirty tree, unpushed work, ahead-and-behind, open draft PR, failing CI, site down), and the obvious next step. Match Oskar's question length.

↑ is local work that's only on this machine; say "push". ↓ is a stale checkout; only mention it if he's about to work there. Both together means reconcile before touching either.

"Not cloned here" is normal on this box, not a problem. Offer to clone only if he wants to work on it.

## Don'ts

Read only. Don't pull, clone, commit or edit the note. If the note is stale, propose the fix.

No `- **Label:** text` lists. No headers in the reply.
