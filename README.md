Not so private public robot files.

  bunx skills add oskarrough/robots

AGENTS
---------------

Three global Pi subagents, via tintinweb/pi-subagents:

- `librarian` — fast read-only finder. Haiku 4.5, thinking off. Use for where/how questions and path:line evidence.
- `oracle` — adversarial read-only decider. Opus 4.8, thinking high. Use for architecture calls, risky plans, and stubborn bugs.
- `arbe` — scoped builder. Sonnet, thinking medium. Use once the direction is clear.

Pi tintinweb subagents reads `~/.pi/agent/agents/*.md` and `~/.pi/agent/subagents.json`.
Those paths are symlinked to `agents/{arbe,librarian,oracle}.md` and `subagents.json` in this repo.

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

To create a new skill: 
    Run `bunx skills init skills/my-skill`.
    Add a link to the skill in the README.md.
