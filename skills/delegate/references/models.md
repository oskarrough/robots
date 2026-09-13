# Delegate: models

Volatile. Ask Oskar before assuming free capacity or reintroducing benched models (terra, haiku). Updated 2026-09-11. Each `spawn` cell is the `--kind … -- …` tail of a `herdr-delegate` or `herdr agent start` command.

| work | spawn |
| --- | --- |
| implementation (Oskar's pick 2026-09-13) | `--kind pi -- --provider openai-codex --model gpt-6-astra --thinking low` (sub-billed; stops for a scope question at every call site outside the file list, so the brief must say "call-site changes strictly required to wire the granted seams are in scope; make them and note them in the report" and list plumbing files like client.ts, package.json exports, and route callers up front) |
| probes, verification, live checks (Oskar 2026-09-13: hand these to a pane, cheaper than doing them yourself) | `--kind pi -- --provider openrouter --model z-ai/glm-5.3-flash` |
| ordinary implementation (alt) | `--kind pi -- --provider openrouter --model deepseek/deepseek-v4.1-flash --thinking high` (~$0.10–0.40 per task; verified 2026-09-10). Alt: `--provider openrouter --model z-ai/glm-5.3-flash` |
| scouting, smoke tests | `--kind pi -- --provider openrouter --model google/gemini-3.8-flash` or `z-ai/glm-5.3-flash`; tight briefs. Alt: `gpt-5.6-luna` on `openai-codex`, `cursor-grok-4.6-high` via `--kind cursor` |
| hard planning; review of migrations, dispatch, retry/error contracts (required) | `--kind pi -- --provider openai-codex --model gpt-5.6-sol --thinking high` (`medium` for ordinary work). Claude sub alternative: `--kind claude -- --model fable` |
| UI design, hard thinking, adversarial review | `--kind claude -- --model opus --effort high` |
| same models through omp (oh-my-pi) | `--kind omp -- --model openrouter/deepseek/deepseek-v4.1-flash --thinking medium` (provider/model in one id) |
| codex subscription, plain CLI | `--kind codex -- -m gpt-6-astra` (reasoning from `~/.codex/config.toml`; approvals auto-reviewed) |

- All pi work uses `--provider openrouter`; `vercel-ai-gateway` exists but is unused for now.
- Anthropic models (`opus`, `fable`) run through `--kind claude`, the only route that bills the Claude subscription.
- `openai-codex` bills the subscription (statusline shows `(openai-codex)` and `$x.xxx (sub)`); `openai` bills per token.
- Thinking/effort ceiling is `high`; cheap models loop above `medium`. Avoid cursor `-fast` variants.
- Switching a pi model mid-session is unreliable; rebuild the pane with the right start args.
- Fast `done` seconds after a big brief on `openai-codex` means the sub quota is out; rebuild elsewhere and tell the human.
