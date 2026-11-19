# Pick

`autobot` with no signal: choose the issues that need a run and start one `autobot #<n>` worker each. Read `autobot.toml` for `repo`, `orchestrator`, `max_threads` and `github_username`. Don't add or change labels; each worker does.

Pick (a) new issues, (b) waiting issues, and `inbox.label` issues autobot has triaged, where a human spoke last, (c) blocked issues whose blockers have all closed:

```sh
# (a) open, untouched by autobot, filed by someone with access, not blocked
gh api --paginate repos/<repo>/issues --jq '.[]
  | select(.pull_request | not)
  | select(.author_association | test("OWNER|MEMBER|COLLABORATOR"))
  | select(.issue_dependencies_summary.blocked_by == 0)
  | select([.labels[].name] | index("autobot") | not)
  | "\(.number) \(.created_at)"'
# (b) open and waiting, the last comment isn't autobot's own
gh issue list -R <repo> --state open --label autobot --limit 1000 \
  --search "label:question,needs-repro,blocked,fix-pending,<inbox.label if set>" --json number,comments \
  --jq '.[] | select(.comments | length > 0 and (last.body | startswith("🤖") | not)) | .number'
# with github_username set, test the author instead: (last.author.login != "<github_username>")
# (c)
gh api --paginate 'repos/<repo>/issues?labels=autobot,blocked' --jq '.[]
  | select(.issue_dependencies_summary.blocked_by == 0) | .number'
```

(b) has no time window on purpose: the last comment is the cursor. Its author says who spoke when autobot has its own account; the 🤖 prefix is the fallback when it posts as a person. A human reply waits until a run answers it, however long nothing ran, and an issue nobody answers is skipped on every run for the cost of the one query. Skip issues whose `autobot #<n>` worker is still running (ask your harness the way [arbe-delegate](../delegate/SKILL.md)'s page says; its `: fix` and `: verify` workers don't count). Oldest first, until `max_threads` are running; the rest wait for the next run.

Each run gets a fresh worker; the issue and the report carry the state, not an old worker's context. Before starting one, archive the idle `autobot #<n>` workers an earlier run left for that issue, with their `: fix` and `: verify` children, so each issue shows one. Start each through arbe-delegate, fire and forget: the workers outlive this run and report on the issue, so don't wait on them. In bb, spawn them with `--parent-self --parent-notifications off` and `--machine` set to the first of `bb.machine` that `bb machine list` shows connected, so every worker folds under the loop's thread instead of filling the sidebar. Name it `autobot #<n>`, on the `orchestrator` model (`"<provider> <model> <level>"`), and brief it with only `/arbe-autobot https://github.com/<repo>/issues/<n>`.

Every run reads GitHub fresh; an earlier run in this session isn't the current state. Final chat: a Markdown list, one `- #<n> → <its id or link>` per worker, then the issues left waiting for a slot, or "nothing new".

## autobot.toml

Settings live in `autobot.toml` in the repo root. Only `repo` is required.

```toml
repo = "owner/name"                                   # GitHub repo that gets the issues
inbox = { inkast = "x7k2q9mf", key = ".env.local", label = "player-feedback" }   # arbe-inkast-to-issues; key is a gitignored env file in the repo root; omit without a feedback form
bb = { project = "proj_abc123", machine = ["office-linux", "home-wsl", "hetzner"] }   # bb only: where workers start, first connected wins (`bb machine list`); `bb project list`
orchestrator = "claude-code claude-sonnet-5-5 low"    # each autobot #n worker
fix = "claude-code claude-opus-5-5 high"              # fix worker; omit to use the orchestrator's
verify = "claude-code claude-opus-5-5 high"           # verify worker; omit likewise
max_threads = 3                                       # autobot #n workers running at once
github_username = "oskbot"                            # optional: post and push as this account, logged in under ~/.config/gh-<name>
```
