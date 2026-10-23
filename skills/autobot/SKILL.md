---
name: arbe-autobot
description: Take one signal (a GitHub issue, a Sentry error, pasted text) through triage, reproduce, fix, verify and PR, step by step, the way Oskar would by hand. The issue carries the state; a report.md carries the detail between threads. Use for "autobot <signal>" or "autobot <step> <signal>".
---

# Autobot

```
signal ─▶ triage ─▶ reproduce ─▶ fix ─▶ verify ─▶ pr ─▶ done
          label      confirmed    new      same      fix-pending
          needs-repro             worktree worktree

triage: spam or duplicate ─▶ closed (invalid / duplicate)
verify: not fixed or review findings ─▶ fix   (2 rounds, then blocked)
pr:     red checks caused by the change ─▶ fix
any:    question or not reproduced ─▶ blocked: asked on the issue
blocked: a comment after the last 🤖 one ─▶ triage
```

Steps: [triage](triage.md), [reproduce](reproduce.md), [fix](fix.md), [verify](verify.md), [pr](pr.md). A change request skips reproduce. Read a step's file only when you're about to run it; a run that stops at triage never opens the others.

Every signal goes through every step. Run steps back to back while the next one is clear. Stop only when a step is blocked. When verify passes, open the PR without asking.

Once the signal has an issue, title your own thread `autobot #<n>` (`bb thread update --self --title`). `autobot <signal>` picks the step itself. The signal can be a URL, a slug or pasted text. Look for its report first (`grep -rl --include=report.md <link> ~/.cache/autobot`). No report means triage. Otherwise run the report's last `Next:`. If that says blocked, reread the signal: a comment after the last 🤖 one means triage runs again with it; none means post nothing, change no labels, and repeat the question only in your final chat. `autobot <step> <signal>` forces a step.

Triage and reproduce run inline. Fix and verify each get a fresh bb thread: verify only means something if it didn't write the fix, and its context never saw the fix being written. Spawn it in the repo's bb project (create it if missing) titled `autobot #<n>: <step>`, with the `--provider`, `--model` and `--reasoning-level` for that step: the caller's prompt first, else the repo's AGENTS.md, else your own. Write them under the report's title as `Models: fix <provider/model/level>, verify <…>` so a rerun uses the same, and only the prompt "Read AGENTS.md, then follow <step file> against <report>. Don't end your turn until your section is in it." Fix gets a new worktree; note its environment id in the report. Verify gets that environment, and pr works in that worktree's path; a fix round goes back to the same fix thread with the findings, then to the same verify thread. The main checkout stays untouched. These are all the bb commands you need; don't read bb guides or list providers:

```sh
bb thread spawn --project "$BB_PROJECT_ID" --parent-self --title 'autobot #<n>: fix' \
  --provider <provider> --model <model> --reasoning-level <level> \
  --new-environment worktree --base-branch <base> --json \
  --prompt "Read AGENTS.md, then follow <skill dir>/fix.md against <report>. Don't end your turn until your section is in it."
# verify: same, with --title 'autobot #<n>: verify', --environment <fix env id> and verify.md
bb thread show <id> --json | jq -r .environmentId   # the fix env id, once the thread runs
bb environment show <env id>                     # the worktree path for pr
bb thread tell <id> '<findings>'                 # a fix round, to the same thread
```

Then wait in the foreground without ending your turn: repeat `bb thread wait <id> --timeout 9m` until the step's section is in the report. A thread goes idle every time it ends a turn, so idle isn't done; if it's idle without a section, tell it to finish. Don't relay its progress, and pass on only what Oskar says about the work: "stop the updates" is for you, not the thread.

Labels, comments and new issues post live; they're cheap to undo. Comment only when a reader of the issue needs it: a question, a reproduction, and one closing comment. Every block, whichever step hits it, posts its one open question on the issue before the turn ends. The issue is the only place autobot asks, never Oskar's inbox. Every comment starts with "🤖 ". The closing comment comes once the PR is up: a sentence or two on what was wrong and what the PR changes, plus its link. Nothing posted lists checks that passed; name only one that failed and why it wasn't fixed. Keep every post shorter than feels natural. Once autobot picks an issue up, it carries an `autobot` label (create it if the repo lacks it) and keeps it; a reply on the issue is how someone asks for another run. Only a block on another issue removes it (see triage). `bug` and `enhancement` are type labels and stay. `question`, `needs-repro`, `confirmed` and `fix-pending` are state labels, one at a time: setting one removes the other. Opening a new issue is fine; deciding which goes first is Oskar's call. Detail lives in `~/.cache/autobot/<repo>/<slug>/report.md` (slug: `<n>-<short-title>`, or a short title without an issue), where each step appends a section. Screenshots go there too. Only verify's before/after pair goes on the PR, never the issue; other screenshots stay in the report. `gh pr create` takes `--attach <absolute path>` per file. `Next:` stays the report's last line. The branch is `autobot/<slug>`. The fix worktree is a plain git worktree, which jj can't open, so use git there even when the main checkout is jj. Only pr pushes. The repo's AGENTS.md wins where it disagrees with these files.

Final chat: one or two sentences with the outcome, the link and the next step. Everything else is in the report.
