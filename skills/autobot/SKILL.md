---
name: arbe-autobot
description: Take one signal (a GitHub issue, a Sentry error, pasted text) through triage, reproduce, fix, verify and PR, step by step, the way Oskar would by hand. Labels on the issue carry the state; a report.md carries the detail between threads. Use for "autobot <signal>" or "autobot <step> <signal>".
---

# Autobot

```
signal ─▶ triage ─▶ reproduce ─▶ fix ─▶ verify ─▶ pr
          label      confirmed    new    fresh     fix-pending
          needs-repro             thread thread
```

Steps: [triage](triage.md), [reproduce](reproduce.md), [fix](fix.md), [verify](verify.md), [pr](pr.md). A change request skips reproduce.

Every signal goes through every step, however small the change looks. Run steps back to back while the next one is clear. Stop when a step is blocked, and before pr: pushing waits for Oskar's go. A go in the original call counts; don't ask again.

`autobot <signal>` picks the step itself. The signal can be a URL, a slug or pasted text. Look for its report first (`grep -rl --include=report.md <link> ~/.cache/autobot`). No report means triage. Otherwise run the report's last `Next:`. If that says blocked, reread the signal: replies since the posted comment mean triage runs again with them; no replies means run nothing and repeat the question. `autobot <step> <signal>` forces a step.

Triage and reproduce run inline. Fix and verify each get a fresh bb thread, even for a one-line change: verify only means something if it didn't write the fix. Spawn it in the repo's bb project (create it if missing) titled `autobot <step>: #<n>`, with only the prompt "Follow <step file> against <report>". Wait for it (`bb thread wait <id>`), then report its outcome from the report. If the main checkout is dirty, fix runs in a new worktree (`--new-environment worktree`), and verify and pr reuse it.

Labels, comments and new issues post live; they're cheap to undo. State lives on the issue as labels. Detail lives in `~/.cache/autobot/<repo>/<slug>/report.md` (slug: `<issue number>-<short-title>`, or just a short title without an issue), where each step appends a section. Only pr pushes, and only when told. Commands come from the repo's AGENTS.md.

Final chat: one or two sentences with the outcome, the link and the next step. Everything else is in the report.
