# Delegate: models

Volatile. If you need a different model not mentioned here, ask for permission. 
Each line is the `--kind … -- …` tail of a `herdr-delegate` or `herdr agent start` command.

## Probes, verification, live checks, scouting, easy exploration

Hand these to a pane; cheaper than doing them yourself. Tight briefs.

    --kind pi -- --provider openrouter --model z-ai/glm-5.3-flash
    --kind pi -- --provider openrouter --model google/gemini-3.8-flash

Alternatives: `gpt-5.6-luna` on `pi`; `--kind cursor -- cursor-grok-4.6-high`.

## Implementation

    --kind pi -- --provider openai-codex --model gpt-6-astra --thinking low

Sub-billed; raise `--thinking` to `high` when the task is hard. Stops for a scope question at every call site outside the file list, so the brief must say "call-site changes strictly required to wire the granted seams are in scope; make them and note them in the report" and list plumbing files (client.ts, package.json exports, route callers) up front.

Alternative, about $0.10–0.40 per task (verified 2026-09-10):

    --kind pi -- --provider openrouter --model deepseek/deepseek-v4.1-flash --thinking high
    --kind pi -- --provider openrouter --model z-ai/glm-5.3-flash

## Hard things: planning, tricky implementation, review of migrations, dispatch, retry/error contracts

Astra is the default for anything hard. Those reviews are required, not optional.

    --kind pi -- --provider openai-codex --model gpt-6-astra --thinking high

Alternatives:

    --kind pi -- --provider openai-codex --model gpt-5.6-sol --thinking high
    --kind claude -- --model fable

## UI design, hard thinking, adversarial review

    --kind claude -- --model opus --effort high

## Other routes

    --kind omp -- --model openrouter/deepseek/deepseek-v4.1-flash --thinking medium
    --kind codex -- -m gpt-6-astra

omp (oh-my-pi) takes provider/model as one id. codex reads reasoning from `~/.codex/config.toml`; approvals are auto-reviewed.

## Notes

- All pi work uses `--provider openrouter`; `vercel-ai-gateway` exists but is unused.
- Anthropic models (`opus`, `fable`) run through `--kind claude`, the only route that bills the Claude subscription.
- `openai-codex` bills the subscription (statusline shows `(openai-codex)` and `$x.xxx (sub)`); `openai` bills per token.
- Thinking/effort ceiling is `high`; cheap models loop above `medium`. Avoid cursor `-fast` variants.
- Switching a pi model mid-session is unreliable; rebuild the pane with the right start args.
- Fast `done` seconds after a big brief on `openai-codex` means the sub quota is out; rebuild elsewhere and tell the human.
