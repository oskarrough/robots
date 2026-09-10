# Delegate: models

Volatile. Ask Oskar before assuming free capacity or reintroducing benched models (terra, haiku). Updated 2026-09-10. Each `spawn` cell is the `--kind … -- …` tail of a `herdr-delegate` or `herdr agent start` command.

| work | spawn |
| --- | --- |
| ordinary implementation | `--kind pi -- --provider openrouter --model deepseek/deepseek-v4.1-flash --thinking high` (~$0.10–0.40 per task; verified 2026-09-10 — the vercel-ai-gateway `-beta` id 404s). Alt: `--provider openrouter --model z-ai/glm-5.3-flash` |
| scouting, smoke tests | `--kind pi -- --provider openrouter --model z-ai/glm-5.3-flash`; tight briefs. Alt: `gpt-5.6-luna` on `openai-codex`, `cursor-grok-4.6-high` via `--kind cursor` |
| hard planning; review of migrations, dispatch, retry/error contracts (required) | `--kind pi -- --provider openai-codex --model gpt-5.6-sol --thinking high` (`medium` for ordinary work) |
| UI design, hard thinking, adversarial review | `--kind claude -- --model opus --effort high` |
| same models through omp (oh-my-pi) | `--kind omp -- --model openrouter/deepseek/deepseek-v4.1-flash --thinking medium` (provider/model in one id) |
| codex subscription, plain CLI | `--kind codex -- -m gpt-6-astra` (reasoning from `~/.codex/config.toml`; approvals auto-reviewed) |

- `openai-codex` bills the subscription (statusline shows `(openai-codex)` and `$x.xxx (sub)`); `openai` bills per token.
- Thinking/effort ceiling is `high`; cheap models loop above `medium`. Avoid cursor `-fast` variants.
- Switching a pi model mid-session is unreliable; rebuild the pane with the right start args.
- Fast `done` seconds after a big brief on `openai-codex` means the sub quota is out; rebuild elsewhere and tell the human.
