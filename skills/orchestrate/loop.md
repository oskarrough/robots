# Loop

Leading a repo's feedback loop as one long-lived bb thread. An hourly bb automation sends you `tick`; nothing else is scheduled. Settings come from `autobot.toml` in the repo root (see [Settings](#settings)). If there's none, stop and say so.

```
tick ─▶ file-as-issues ─▶ dedupe ─▶ pick ─▶ fire autobot per issue ─▶ judge what settled ─▶ friction
```

A tick:

1. **Intake.** Run [arbe-file-as-issues](../file-as-issues/SKILL.md).
2. **Dedupe.** You've seen every issue the loop filed. A new one that asks what an open one asks: comment its link on the new one and let autobot's triage close it.
3. **Pick** (a) new issues, (b) waiting issues someone touched within the lookback, (c) blocked issues whose blockers have all closed:

   ```sh
   # (a) open, untouched by autobot, filed by someone with access, not blocked
   gh api --paginate repos/<repo>/issues --jq '.[]
     | select(.pull_request | not)
     | select(.author_association | test("OWNER|MEMBER|COLLABORATOR"))
     | select(.issue_dependencies_summary.blocked_by == 0)
     | select([.labels[].name] | index("autobot") | not)
     | "\(.number) \(.created_at)"'
   # (b)
   since=$(date -u -d '-<lookback>' +%Y-%m-%dT%H:%M:%SZ)
   gh issue list -R <repo> --label autobot --limit 100 \
     --search "label:question,needs-repro,blocked,fix-pending updated:>=$since" --json number --jq '.[].number'
   # (c)
   gh api --paginate 'repos/<repo>/issues?labels=autobot,blocked' --jq '.[]
     | select(.issue_dependencies_summary.blocked_by == 0) | .number'
   ```

   (b) also catches autobot's own comments; that's fine, autobot does nothing without a new reply. Skip issues with a busy `autobot #<n>` thread (`bb thread list --project <project> --json`, status not idle, children don't count). Oldest first, until `max_threads` are busy.
4. **Fire and forget.** One thread per issue, without `--parent-self` (see [arbe-delegate's bb page](../delegate/references/bb.md)): `--title "autobot #<n>" --prompt "/arbe-autobot https://github.com/<repo>/issues/<n>"`, on the `orchestrator` model (`"<provider> <model> <level>"` becomes `--provider --model --reasoning-level`).
5. **Judge** each issue that settled since the last tick (a PR, a question, closed): read its timeline, labels, PR and report. Check what the skills promise: one state label, comments start with 🤖, one question per stop, a closing comment with the link, report sections of five lines or fewer. A miss, or a `Friction:` line in the report, goes in the repo's `friction.md` (one line each: issue link, skill file, what).
6. **File patterns.** A friction seen twice becomes one issue on oskarrough/robots, labelled `friction` (create the label once): evidence links, the rule, a proposed edit. Search first; add evidence instead of filing twice. Oskar picks; an approved edit goes to a worker via arbe-delegate.

You're the only writer of `friction.md`; commit it straight to the base. Anything you'd need after a restart goes in those files, not only in your context. Final chat per tick: one line per thread fired, one per friction filed, or "nothing new".

## Settings

`autobot.toml`, repo root. Only `repo` and `inbox` are required.

```toml
repo = "owner/name"                                   # GitHub repo that gets the issues
inbox = { inkast = "x7k2q9mf", key = "~/.config/inkast/name.env", label = "player-feedback" }
bb = { project = "proj_abc123", machine = "hetzner-osk1" }   # `bb project list`
orchestrator = "claude-code claude-sonnet-5-5 low"    # the lead's own model; its autobot threads
fix = "claude-code claude-opus-5-5 high"              # fix thread; omit to use the orchestrator's
verify = "claude-code claude-opus-5-5 high"           # verify thread; omit likewise
max_threads = 3                                       # autobot threads busy at once
lookback = "2 hours"                                  # schedule interval plus overlap
```

`inbox.inkast` is the list id; `key` is the env file holding `INKAST_ID`, `INKAST_WRITE`, `INKAST_KEY`; `label` is optional and goes on every issue filed from the inbox.
