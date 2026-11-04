---
name: arbe-autobot
description: Take one signal (a GitHub issue, a Sentry error, pasted text) through triage, reproduce, fix, verify and PR, step by step, the way Oskar would by hand. The issue carries the state; a report.md carries the detail between threads. Without a signal, picks the issues that need a run and starts one worker each. Use for "autobot", "autobot <signal>", "autobot <step> <signal>" or "autobot friction".
---

# Autobot

```
signal ─▶ triage ─▶ reproduce ─▶ fix ─▶ verify ─▶ pr ─▶ done
          label      confirmed    new      same      fix-pending
          needs-repro             worktree worktree

triage: spam or duplicate ─▶ closed (invalid / duplicate)
verify: not fixed or review findings ─▶ fix   (2 rounds, then waiting)
pr:     red checks caused by the change ─▶ fix
any:    question or not reproduced ─▶ waiting: asked on the issue
waiting: a comment after the last 🤖 one ─▶ triage
fix-pending: a comment after the last 🤖 one ─▶ fix on the PR's branch
waiting on #m: #m closed ─▶ triage
```

Steps: [triage](triage.md), [reproduce](reproduce.md), [fix](fix.md), [verify](verify.md), [pr](pr.md). A change request skips reproduce. Read a step's file only when you're about to run it; a run that stops at triage never opens the others. `autobot` with no signal runs [pick](pick.md) instead; `autobot friction` runs [friction](friction.md).

Run steps back to back while the next one is clear. Stop only when a step has to wait on someone. When verify passes, open the PR without asking.

Once the signal has an issue, name your own thread or session `autobot #<n>` if your harness lets you (bb: `bb thread update --self --title`). `autobot <signal>` picks the step itself. The signal can be a URL, a slug or pasted text. Look for its report first (`grep -rl --include=report.md <link> ~/.cache/autobot`). No report means triage. Otherwise run the report's last `Next:`. If that says waiting, reread the signal: a comment after the last 🤖 one means triage runs again with it; none means post nothing, change no labels, and repeat the question only in your final chat. If it says `triage once #<m> closes`, run triage once #m is closed, or once there's a new comment; otherwise do nothing the same way. If the issue is `fix-pending`, its PR is still open and there's a comment after the last 🤖 one, run fix with that comment in a new worktree on the PR's branch (`--base-branch autobot/<slug>`), then verify; pr updates the same PR, rebasing it if it conflicts. `autobot <step> <signal>` forces a step.

Triage and reproduce run inline. Fix and verify each go to a fresh worker through [arbe-delegate](../delegate/SKILL.md), on the page for the harness you're in: verify only means something if it didn't write the fix, and its context never saw the fix being written. Name them `autobot #<n>: fix` and `autobot #<n>: verify`. The model for each comes from the caller's prompt first, else `fix` and `verify` in the repo's `autobot.toml` (see [pick](pick.md#autobottoml)), else your own. Write them in the report's header as `Models: fix <provider/model/level>, verify <…>` so a rerun uses the same. The whole brief is "Read AGENTS.md, then follow <skill dir>/<step>.md against <report>. Don't end your turn until your section is in it."

Fix gets its own checkout (a worktree) on `autobot/<slug>` off the base; note its path and branch in the report's header, plus anything your harness needs to reopen it (in bb, the environment id). Verify works in that same checkout, and so does pr. Within one run, a fix round goes back to the same fix worker with the findings, then to the same verify worker. A later run starts fresh workers and never messages one an earlier run started, or that run's old lead wakes up too. So the report names checkouts, never workers; ignore any worker id an older report has. The main checkout stays untouched.

Wait for each worker until its section is in the report, without ending your turn. A worker that ends a turn without its section isn't done; tell it to finish. Don't relay its progress, and pass on only what Oskar says about the work: "stop the updates" is for you, not the worker.

Rules every step shares:

- Labels, comments and new issues post live; they're cheap to undo. Only you post: fix and verify write their open question as `Next: waiting on <question>`, and you put it on the issue.
- Comment only when a reader of the issue needs it: a question, a reproduction, and one closing comment. Every stop to wait posts its one open question on the issue before the turn ends. The issue is the only place autobot asks, never Oskar's inbox. Every comment starts with "🤖 ". Keep every post shorter than feels natural.
- `question`, `needs-repro`, `blocked`, `confirmed` and `fix-pending` are state labels, one at a time: setting one removes the other.
- The report, `~/.cache/autobot/<repo>/<slug>/report.md`, hands the next step what it needs and nothing else. Each step owns one section of at most five lines; its file says what goes in it. When a skill rule or tool cost you time or was unclear, the section ends with `Friction: <skill file>: <what>`; otherwise leave it out. A rerun replaces its step's section instead of adding one; the history lives in the issue, the PR and git. `Next:` stays the report's last line.
- The repo's AGENTS.md wins where it disagrees with these files.

Final chat: one or two sentences with the outcome, the link and the next step. Everything else is in the report.
