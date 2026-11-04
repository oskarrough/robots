# Pick

`autobot` with no signal: choose the issues that need a run and start one `autobot #<n>` thread each. Read `autobot.toml` for `repo`, `bb`, `orchestrator`, `max_threads` and `lookback`. Don't add or change labels; each thread does.

Pick (a) new issues, (b) waiting issues someone touched within the lookback, (c) blocked issues whose blockers have all closed:

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

(b) also catches autobot's own comments; that's fine, a thread does nothing without a new reply. Skip issues with a busy `autobot #<n>` thread (`bb thread list --project <project> --json`, status not idle, its `: fix` and `: verify` children don't count). Oldest first, until `max_threads` are busy; the rest wait for the next run.

Start each the way [arbe-delegate's bb page](../delegate/references/bb.md) says, without `--parent-self`: the threads outlive this run and report on the issue. `--title "autobot #<n>" --prompt "/arbe-autobot https://github.com/<repo>/issues/<n>"`, on the `orchestrator` model (`"<provider> <model> <level>"` becomes `--provider --model --reasoning-level`), in `bb.project` on `bb.machine`.

Every run reads GitHub fresh; an earlier run in this thread isn't the current state. Final chat: one line per thread, `#<n> → @thread:<id>`, then the issues left waiting for a slot, or "nothing new".
