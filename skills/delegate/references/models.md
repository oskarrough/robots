# Delegate: models

Volatile. Ask the human before using an unlisted model.
Each line is the `--kind … -- …` tail of a `herdr-delegate` or `herdr agent start` command.

## Exploration, research, probes, verification, easy tasks

Hand these to a pane; cheaper than doing them yourself. Tight briefs. Prefer Luna 6; use the others as alternatives.

    --kind pi -- --provider openai-codex --model gpt-6-luna
    --kind pi -- --provider openrouter --model z-ai/glm-5.3-flash
    --kind pi -- --provider openrouter --model google/gemini-3.8-flash
    --kind pi -- --provider openrouter --model deepseek/deepseek-v4.1-flash

Luna API pricing: $0.10 input / $0.50 output per million tokens. Try `--thinking medium`, `high`, or `xhigh` as the task warrants; we haven't settled on a default yet. Another alternative: `--kind cursor -- cursor-grok-4.7-high`.

## Ordinary implementation

    --kind pi -- --provider openai-codex --model gpt-6-astra --thinking high

Astra stops for scope questions at call sites outside the file list. List plumbing files (client.ts, package.json exports, route callers) up front and say "call-site changes strictly required to wire the granted seams are in scope; make them and note them in the report".

## Hard work: planning, tricky implementation, UI design, reviews

Use Opus 5.5 or Sol 6 at high effort, or Astra at xhigh for planning and tricky implementation (including migrations, dispatch, retry/error contracts). Prefer Opus for UI design and adversarial review.

Review every non-trivial diff with a fresh worker: Opus reviews GPT-built work (Astra or Sol); Sol reviews Opus-built work. Don't use Astra for reviews.

    --kind claude -- --model opus --effort high
    --kind pi -- --provider openai-codex --model gpt-6-sol --thinking high
    --kind pi -- --provider openai-codex --model gpt-6-astra --thinking xhigh

API pricing per million tokens: Sol $2 input / $10 output; Opus 5.5 $4 input / $20 output, $0.20 cache read / $5 cache write.

## Fallback routes when pi misbehaves

    --kind omp -- --model openrouter/deepseek/deepseek-v4.1-flash --thinking medium
    --kind codex -- -m gpt-6-astra

omp (oh-my-pi) takes provider/model as one id. codex reads reasoning from `~/.codex/config.toml`; approvals are auto-reviewed.

## Notes

- `openai-codex` and `--kind claude` bill subscriptions; `openrouter` and `openai` bill per token. `vercel-ai-gateway` exists but is unused. Claude's `opus` alias selects the latest Opus (currently 5.5).
- Avoid cursor `-fast` variants.
- Switching a pi model mid-session is unreliable; rebuild the pane with the right start args.
- Fast `done` seconds after a big brief on `openai-codex` means the sub quota is out; rebuild elsewhere and tell the human.

## Observed (2026-09-23, ore-else polish day, ~20 workers)

- Opus 5.5: best for judgement and taste: copy, critique, open-ended tools. Took a vague brief to
  a finished, inventive tool; found bugs others missed; copy pass caught factual errors in hints.
- Sol 6: reliable, respects ownership, clean commits and short reports, but does the minimum and
  reads literally (called done after 2 of 8 items; "bigger" became oversized). Weak visual taste;
  expect about two steering rounds on UI. Asks permission for trivia unless the brief pre-authorizes.
- Astra 6: measured instead of guessing and stopped with a precise trade-off. Good default for
  scoped implementation.
- Luna 6: fine for scouting and driving `codex exec` image jobs; too shallow as a playtester.
- Any builder: put a numbered checklist in the brief and require each item's status in the DONE
  report; rotate panes per outcome before contexts pass ~300k.
