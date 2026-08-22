Not so private public robot files.

  bunx skills add oskarrough/robots

AGENTS
---------------

Three global subagents for Pi, Claude Code, and Codex:

- `librarian` — fast read-only finder for where/how questions and path:line evidence.
- `oracle` — adversarial read-only decider for architecture calls, risky plans, and stubborn bugs.
- `arbe` — scoped builder for implementation once the direction is clear.

Install them globally:

    bun run install-agents

Pass one or more targets to limit the install, for example
`bun run install-agents codex claude`.

The Markdown files in `agents/` are the source of truth. The installer copies
them into Pi and renders the corresponding Claude Markdown and Codex TOML:

- Pi: `~/.pi/agent/agents/*.md` and `~/.pi/agent/subagents.json`
- Claude Code: `~/.claude/agents/*.md`
- Codex: `~/.codex/agents/*.toml`

`model:` is the Pi model id (`provider/id`, e.g. `openai-codex/gpt-5.6-sol`).
Claude only understands `haiku`/`sonnet`/`opus`, so agents on another vendor's
model declare `model_claude:` alongside it; that key is stripped from the Pi copy.

Re-run the installer after changing an agent. Existing files with the same
three agent names are replaced; unrelated agents are left alone.

SKILLS
---------------

- [arbe-jj-jujutsu](skills/jj-jujutsu/SKILL.md) — using jj (jujutsu) for version control
- [arbe-improve-codebase](skills/improve-codebase/SKILL.md) — find shallow modules to deepen
- [arbe-discover-primitives](skills/discover-primitives/SKILL.md) — read a repo as an SDK/MCP surface
- [arbe-diagram-first](skills/diagram-first/SKILL.md) — draw ASCII pipeline diagram before design prose or code
- [arbe-review](skills/review/SKILL.md) — diff review and sweep review
- [arbe-mull](skills/mull/SKILL.md) — six-stage design session with review gates
- [arbe-pipeline-audit](skills/pipeline-audit/SKILL.md) — walk README pipeline diagrams against code
- [arbe-documentation](skills/documentation/SKILL.md) — Diátaxis four-mode docs
- [arbe-orchestrate](skills/orchestrate/SKILL.md) — triage tasks/backlog and prep work for agent dispatch
- [arbe-delegate](skills/delegate/SKILL.md) — run worker agents in herdr panes: spawn, brief, read, steer
- [arbe-changelog](skills/changelog/SKILL.md) — write user-facing changelog entries
- [arbe-bro](skills/bro/SKILL.md) — restate the last message in plain human language

To create a new skill: 
    Run `bunx skills init skills/my-skill`.
    Add a link to the skill in the README.md.

Installing copies each skill into `~/.agents/skills/<name>/` and symlinks it
into the agent directories (`~/.claude/skills/<name>`, etc.). That copy is
device-local, so always land edits through git — several machines run these,
and an install that skipped the push leaves no way to tell which machine is
right:

1. Edit `skills/<name>/SKILL.md`
2. Commit and push to `main`
3. `bunx skills update -g -y` (or `bunx skills update arbe-delegate` for one)

While iterating you can install straight from the working copy, uncommitted
edits included:

    bunx skills add ~/Sites/robots -g -y -s '*'

Close that loop with a push. Until you do, this machine is the only one with
the change, and the next `skills update` silently reverts it.

That command reports `Failed to install 12` even when it worked — the
PromptScript target refuses `-g` and the CLI counts it as total failure. Check
`~/.agents/skills/<name>/SKILL.md` rather than the banner.
