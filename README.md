Not so private public robot files.

  bunx skills add oskarrough/robots

HERDR-DELEGATE
---------------

`herdr-delegate` turns one worker turn into one JSON envelope inside a live
Herdr session (`HERDR_ENV=1`). Install it from this checkout with `bun link`.

    herdr-delegate NAME BRIEF --kind KIND [--timeout MS]
                   [--tab ID | --workspace ID | --new-tab LABEL]
                   [--direction right|down] [--cwd DIR] [--start-timeout MS] [--lines N]
                   -- [native agent args...]
    herdr-delegate prompt NAME TEXT [--timeout MS] [--lines N]
    herdr-delegate wait NAME [--timeout MS] [--lines N] [--confirm-interval MS]

The fresh form runs `agent list` → `pane split` → `agent start` (one retry on
`agent_pane_busy`) → runtime verification → optional `pane move` → a brief with
the upward-reporting contract appended → `agent prompt --wait` → a confirmed settle →
`agent read`. `prompt` does the same from the prompt step for a warm worker
(without repeating the contract); `wait` from the settle step, e.g. after a
timeout. `--workspace` takes a workspace id or unique label and resolves to its
active tab. `--new-tab LABEL` moves the worker into a new one-pane tab in the
caller's workspace; unlike `tab create` followed by `--tab`, it does not leave an
empty root shell. The three placement options are mutually exclusive. Use Herdr
itself to steer, move, read, or close workers. Nothing is ever closed.

A settle is confirmed from the worker's transcript, not its screen. The
session file Herdr points at (`agent_session`; pi/omp paths, Claude ids, and
codex ids are understood) must show the last assistant turn ended, and still
show it `--confirm-interval` (20 s) later. The transcript outranks Herdr's
status because a hook can keep reporting `working` after the turn (a stuck
background job) and a screen-derived status can flap; only `blocked` is
trusted from status alone. `agent wait` is polled in confirm-interval slices
on the way. Kinds without a known transcript format settle on status alone.

Runtime verification parses the requested `--provider`/`--model`/`--thinking`
from the native args and compares them to what the session file recorded
(pi `model_change`/`thinking_level_change`, claude `message.model`). A mismatch
is `ok: false` at `stage: "verify"` before the brief is sent, so a wrong-model
worker never burns a turn. `runtime` carries `requested`, `resolved` (with
`subscription_billed`), `verified`, and `matches_requested`; a kind or session
the parser cannot read leaves `matches_requested: null` and proceeds.

Every command writes one envelope and exits 0 only for `ok: true`:
`{ok, stage, created?, agent: {name, kind, pane_id, tab_id, workspace_id, status},
runtime?, classification?, last_message?, terminal_text?, error?}`. `last_message` is the
final assistant text from the transcript; `terminal_text` is the visible
viewport (`--lines`, default 120), truncated to pane width. `classification`
is `report` (ok), `blocked` (Herdr `blocked` or a final line starting
`BLOCKED <worker>:`), `error` (the provider ended the turn), `empty` (a turn with
no assistant text), or `never_ran` (a prompt rejected with Herdr's
`agent_prompt_stalled`, `agent_not_found`, or `agent_not_running`). A prompt
or wait `timeout` is `ok: false` at `stage: prompt` or `stage: wait`; the worker
may still be running or awaiting settle confirmation. Rerun `wait`, not `prompt`.
`stage` names where a failure happened: `preflight`, `split`, `start`, `verify`,
`move`, `prompt`, `wait`, `settled`, `arguments`, `environment`. `--timeout` omitted
waits indefinitely. The budget includes settle confirmation; leave room in
your harness's command timeout for fresh-worker startup and reading the result.

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

Every agent reads skills from one canonical store, `~/.agents/skills/<name>/`.
Some agents read it directly, the rest (Claude Code, Pi, ...) hold symlinks
into it, e.g. `~/.claude/skills/<name>` → `~/.agents/skills/<name>`. So
whatever sits in the store is what every agent sees.

**On the machine holding this checkout**, point the store at the checkout
itself:

    bun run install-skills

That replaces each `~/.agents/skills/arbe-*` entry with a symlink to its
`skills/<dir>` here (skills from other repos are left alone). From then on,
edits in this repo are live in every agent immediately — no push, no
reinstall. Re-run it only after creating a new skill directory. Don't run
`bunx skills update` on the arbe skills here: it would replace the symlinks
with copies from GitHub (if that happens, `bun run install-skills` again).

**On any other machine**, the store holds copies, so changes flow through git:

1. Edit `skills/<name>/SKILL.md`, commit, push to `main`
2. There: `bunx skills add oskarrough/robots -g -y -s '*'`
   (or `bunx skills update -g -y` once installed)

The add command reports `Failed to install` even when it worked — the
PromptScript target refuses `-g` and the CLI counts it as a failure. Check
`~/.agents/skills/<name>/SKILL.md` rather than the banner.

Still push promptly even though this machine doesn't need it: the other
machines only ever see what's on `main`.

To create a new skill:

1. `bunx skills init skills/my-skill`
2. Add a link to it in this README
3. `bun run install-skills`
