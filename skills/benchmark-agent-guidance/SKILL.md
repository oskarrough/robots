---
name: arbe-benchmark-agent-guidance
description: "Prove a change to agent guidance helped: fix the task, change one variable, run fresh agents before and after, compare tokens, tool calls, and failures. Use when tuning skills, AGENTS.md, or system prompts, or comparing models and reasoning levels."
---

# Benchmark agent guidance

Treat agent guidance like executable behavior. Hold the task and environment fixed, change one variable, and measure the same fresh-agent runs before and after. The goal is to improve the harness, prompting and maybe LLM skills in a project so they complete faster, higher quality, less tokens, less tool calls needed. Benchmarking can surface what tool calls fail, what files are searched without needing to, wrong paths etc.

Correctness is the gate. A faster or cheaper wrong answer loses.

## What this benchmarks

The independent variable may be:

- a skill, `AGENTS.md`, system prompt, or tool description
- the harness or agent runtime
- model provider and model ID
- reasoning level
- one explicit combination of those variables

Do not change several axes and attribute the result to one of them. Start with one-axis A/B comparisons. Build a selected matrix only after the baseline is stable.

## 1. Pin the contract

Before launching an agent, write down:

- exact user prompt
- observable correct outcome
- forbidden outcomes: wrong origin, guessed route, mutation, skipped cleanup, policy violation
- product and guidance revision
- harness, provider, model ID, and reasoning level
- account, permissions, auth profile, server origin, and mutable backend state
- whether caches and sessions start cold or warm

Validate the runtime's actual model and reasoning status. A silently substituted model invalidates the cell.

The user prompt is test input, not a hidden brief. Give the agent no tool names, routes, recovery steps, expected answer, or benchmark-specific hints unless those words are naturally part of the real task. Ambient `AGENTS.md`, skills, system prompts, and tool descriptions must carry the behavior being tested.

## 2. Build a task ladder

Prefer 2–5 small tasks with increasing surface area:

1. deterministic read-only observation
2. authenticated observation or state transition
3. multi-step interaction
4. mutation only when state can be reset exactly

Small tasks expose waste early: unnecessary docs, wrong tools, guessed routes, duplicate snapshots, retries, and cleanup leaks. A large coding task hides those failures inside normal variance.

Keep product-specific prompts beside the product. This skill owns the method, not a permanent catalog of routes or answers.

Mutation requires a reset between trials. Reusing a created object or changing its name makes the prompts or state non-identical. Prefer read-only tasks for the default suite.

## 3. Freeze the experiment

Each cell gets a fresh agent session. Never run before and after in one context: prior tools, answers, and loaded files contaminate the result.

Keep constant:

- prompt bytes
- product revision and running build
- account and authorization
- backend fixtures
- network origin
- harness configuration except the tested axis
- model and reasoning except when they are the tested axis

Run cells sequentially when they share a browser daemon, auth profile, mutable backend, rate limit, terminal, or dev server. Parallel execution is valid only for isolated resources.

For an exploratory pass, one run per cell is enough to find large mistakes. For a decision, run at least three trials per cell and report median plus range. Do not claim statistical significance from a tiny sample.

Repeat an unchanged anchor cell in long benchmark batches. If its time or token profile drifts materially, the environment changed; split the batch rather than comparing across the drift.

## 4. Capture raw evidence

Record both efficiency and behavior for every trial:

| Field | Meaning |
| --- | --- |
| `case` | stable task name |
| `variant` | guidance or configuration label |
| `harness` | runtime and version |
| `provider_model` | exact provider/model ID |
| `reasoning` | actual reasoning level |
| `trial` | repetition number |
| `wall_ms` | prompt accepted to settled result |
| `input_tokens` | uncached input when available |
| `output_tokens` | visible answer tokens |
| `reasoning_tokens` | hidden reasoning tokens when available |
| `cache_tokens` | cached read/write tokens when available |
| `model_tool_calls` | calls initiated by the model |
| `surface_actions` | underlying browser/CLI/API commands |
| `failed_actions` | errors, wrong routes/origins, rejected calls |
| `retries` | repeated attempts, including recovered attempts |
| `outcome` | pass/fail against the pinned observable result |
| `cleanup` | browser/session/process/state restored or leaked |
| `notes` | concise behavioral evidence |

One shell tool call may chain five browser commands. Record one model tool call and five surface actions; both numbers matter.

Count behavioral failures even when the command exits zero: a 404 snapshot, production instead of local, source inspection replacing UI proof, or clicking unrelated controls is still a failed action.

Preserve raw transcripts or session handles until the comparison is complete. Summary numbers without a transcript cannot explain regressions.

## 5. Run A/B

For a guidance edit:

1. Run every baseline prompt with fresh agents.
2. Record raw metrics and behavioral failures.
3. Edit the skill, `AGENTS.md`, system prompt, or tool description.
4. Run the exact prompts again with fresh agents.
5. Inspect any new waste or failure before averaging results.
6. Keep the change only if correctness holds and the tradeoff is worthwhile.

For harness, model, or reasoning comparisons, use the same sequence but change only that cell's named axis. Do not silently fall back when a model, auth profile, tool, or server is unavailable. Mark the cell blocked and stop.

Iteration is expected. If a run exposes one concrete failure—forgotten browser cleanup, unnecessary preflight, route guessing—sharpen the ambient guidance and rerun the affected prompt. Do not add hints to the test prompt.

## 6. Decide in this order

1. correct observable outcome
2. policy and safety compliance
3. cleanup and deterministic final state
4. failed actions and retries
5. wall time
6. model tool calls and surface actions
7. input, output, reasoning, and cache tokens

Report regressions as well as wins. A change that cuts tokens but adds one flaky retry may be worse for unattended work.

## Report

Lead with the decision, then the evidence:

```markdown
Decision: keep variant B. All cases passed; aggregate wall time fell 31% and failed actions fell from 4 to 0.

| Case | Outcome | Time A → B | Input A → B | Tool calls A → B | Issues A → B |
| --- | --- | ---: | ---: | ---: | ---: |
| public read | pass → pass | 18.2s → 10.4s | 16k → 10k | 2 → 2 | 1 → 0 |

Behavioral diff:
- A guessed a route and recovered from 404.
- B used the visible form and closed the browser.

Controlled configuration:
- harness, provider/model, reasoning, revision, auth profile
- exact prompts and trial count
```

Use percentages for aggregates and raw values per case. Rounded token counters are approximate; label them as such.

## Make the result compound

- Put reusable product prompts and expected outcomes in that product's skill or benchmark fixture.
- Put general experimental lessons here.
- Fix the guidance or harness surface that caused repeated waste; do not leave the lesson only in a session report.
- Re-run the smallest affected case after each refinement, then the full ladder before declaring the variant better.

A benchmark is done when another agent can reproduce the matrix from committed prompts, configuration, and outcome definitions without extra coaching.
