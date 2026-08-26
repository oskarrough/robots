Not so private public robot files.

  bunx skills add oskarrough/robots

HERDR-DELEGATE
---------------

`herdr-delegate` is a standalone Bun CLI for creating or reusing named agents
inside a live Herdr session (`HERDR_ENV=1`). Install it from this checkout with
`bun link`, then run:

    herdr-delegate run NAME PROMPT --kind KIND [options] -- [native agent args...]
    herdr-delegate launch NAME --kind KIND [options] -- [native agent args...]
    herdr-delegate prompt NAME PROMPT [--timeout MS] [--lines N]

The modes map directly to Herdr:

- `run`: `agent list` → `pane split` → `agent start` → optional `pane move` →
  `agent prompt --wait` → `agent read --format text`.
- `launch`: the same creation path, without prompt or read.
- `prompt`: preflight an existing named agent with `agent get`, then prompt and
  read it. It refuses non-idle workers and preserves context; resets remain
  explicit and agent-specific.

Fresh-agent options are `--kind` (required), `--direction right|down`, `--cwd`,
`--place sibling|tab`, `--tab-label`, and `--start-timeout` (3001–300000 ms;
default 30000). `run` and `prompt` accept `--timeout` (nonnegative ms; omitted
means indefinite) and `--lines` (default 120, maximum 4294967295). Only fresh modes accept native
arguments after `--`.

The wrapper writes exactly one JSON envelope to stdout and exits 0 for success
or 1 for failure. Failures include `stage`, `created`, known agent/pane handles,
the upstream Herdr error, cleanup status, and raw `terminal_text` when readable.
`ok: true` confirms command transport, a reported settled state, and readable
terminal output—not semantic task completion. `created: true` means a named
agent was confirmed, not merely that a pane was
allocated. Herdr's JSON errors arrive on its stderr; successful terminal reads
are returned unchanged as text.

Once an agent is confirmed, the wrapper never closes its pane. Prompt timeouts,
blocked agents, failed placement, and ambiguous starts are preserved for
inspection. A failed start closes its new pane only after `agent get` confirms
that the named agent does not own it; uncertain ownership is reported and left
untouched. Tab placement also requires Herdr to report `changed: true`.

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
- [arbe-benchmark-agent-guidance](skills/benchmark-agent-guidance/SKILL.md) — controlled A/B benchmarks for agent guidance, harnesses, models, and reasoning levels
- [arbe-mull](skills/mull/SKILL.md) — six-stage design session with review gates
- [arbe-pipeline-audit](skills/pipeline-audit/SKILL.md) — walk README pipeline diagrams against code
- [arbe-documentation](skills/documentation/SKILL.md) — Diátaxis four-mode docs
- [arbe-orchestrate](skills/orchestrate/SKILL.md) — triage tasks/backlog and prep work for agent dispatch
- [arbe-delegate](skills/delegate/SKILL.md) — run worker agents in herdr panes: spawn, brief, read, steer
- [arbe-changelog](skills/changelog/SKILL.md) — write user-facing changelog entries
- [arbe-bro](skills/bro/SKILL.md) — restate the last message in plain human language
- [arbe-product-description](skills/product-description/SKILL.md) — outside-in, feature-by-feature behaviour spec of a product, verified and triaged

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
