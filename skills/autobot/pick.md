# Pick

`autobot` with no signal: choose the issues that need a run and start one `autobot #<n>` worker each. Read `autobot.toml` for `repo`, `orchestrator`, `max_threads` and `lookback`. Don't add or change labels; each worker does.

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

(b) also catches autobot's own comments; that's fine, a run does nothing without a new reply. Skip issues whose `autobot #<n>` worker is still running (ask your harness the way [arbe-delegate](../delegate/SKILL.md)'s page says; its `: fix` and `: verify` workers don't count). Oldest first, until `max_threads` are running; the rest wait for the next run.

Start each through arbe-delegate, fire and forget: the workers outlive this run and report on the issue, so don't wait on them. Name it `autobot #<n>`, on the `orchestrator` model (`"<provider> <model> <level>"`), and brief it with only `/arbe-autobot https://github.com/<repo>/issues/<n>`.

Every run reads GitHub fresh; an earlier run in this session isn't the current state. Final chat: one line per worker, `#<n> → <its id or link>`, then the issues left waiting for a slot, or "nothing new".

## autobot.toml

Settings live in `autobot.toml` in the repo root. Only `repo` is required.

```toml
repo = "owner/name"                                   # GitHub repo that gets the issues
inbox = { inkast = "x7k2q9mf", key = ".env.local", label = "player-feedback" }   # arbe-inkast-to-issues; key is a gitignored env file in the repo root; omit without a feedback form
bb = { project = "proj_abc123", machine = "hetzner-osk1" }   # bb only: where workers start; `bb project list`
orchestrator = "claude-code claude-sonnet-5-5 low"    # each autobot #n worker
fix = "claude-code claude-opus-5-5 high"              # fix worker; omit to use the orchestrator's
verify = "claude-code claude-opus-5-5 high"           # verify worker; omit likewise
max_threads = 3                                       # autobot #n workers running at once
lookback = "2 hours"                                  # schedule interval plus overlap
```
