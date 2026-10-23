---
name: arbe-create-threads-from-issues
description: Pick the GitHub issues autobot should look at and create one bb thread per issue running arbe-autobot. The second half of the feedback loop, after arbe-file-as-issues. Use for "create-threads-from-issues" or when an automation runs it in a repo with an autobot.toml.
---

# Create threads from issues

Read `autobot.toml` in the repo root for `repo`, `bb`, `orchestrator`, `max_threads` and `lookback`. If there's none, stop and say so. Don't add or change labels; autobot does.

Pick (a) new issues, (b) waiting issues someone touched within the lookback, and (c) blocked issues whose blockers have all closed:

```sh
# (a) open, autobot hasn't touched them, filed by someone with access, not blocked
gh api --paginate repos/<repo>/issues --jq '.[]
  | select(.pull_request | not)
  | select(.author_association | test("OWNER|MEMBER|COLLABORATOR"))
  | select(.issue_dependencies_summary.blocked_by == 0)
  | select([.labels[].name] | index("autobot") | not)
  | "\(.number) \(.created_at)"'

# (b) waiting on a question, a repro or another issue, updated within the lookback
since=$(date -u -d '-<lookback>' +%Y-%m-%dT%H:%M:%SZ)
gh issue list -R <repo> --label autobot --limit 100 \
  --search "label:question,needs-repro,blocked updated:>=$since" --json number,createdAt --jq '.[] | "\(.number) \(.createdAt)"'

# (c) blocked, and no blocker is still open
gh api --paginate 'repos/<repo>/issues?labels=autobot,blocked' --jq '.[]
  | select(.issue_dependencies_summary.blocked_by == 0)
  | "\(.number) \(.created_at)"'
```

(b) also catches label edits and autobot's own comments. That's fine: autobot does nothing on an issue without a new reply.

A closed blocker doesn't count as an update on the blocked issue, which is why (c) exists. Once autobot reruns it, `blocked` gives way to the next state, so (c) never picks it twice.

A busy thread is one titled `autobot #<n>` that isn't idle; its `: fix` and `: verify` children don't count. Skip issues that have one, then start the oldest issues first until `max_threads` are busy. The rest wait for the next run.

```sh
bb thread list --project <project> --json | jq -r '.[] | select(.status != "idle") | .title // "" | select(test("^autobot #[0-9]+$"))'
bb thread spawn --project <project> --machine <machine> \
  --provider <provider> --model <model> --reasoning-level <level> \
  --title "autobot #<n>" --prompt "/arbe-autobot https://github.com/<repo>/issues/<n>"
```

The provider, model and level come from `orchestrator`. Autobot reads the fix and verify models from `autobot.toml` itself. Don't pass `--parent-self`: the threads outlive this run.

Final chat: one line per thread, `#<n> → @thread:<id>`, then the issues left waiting for a free slot, or "nothing new".
