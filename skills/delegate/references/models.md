# Delegate: models

Volatile. Ask Oskar before using an unlisted model. Prices and field notes live in his `llm-model-tierlist` note.

Each route is provider / model / reasoning level. In herdr that's the tail `--kind pi -- --provider <p> --model <m> --thinking <level>`, or `--kind claude -- --model opus --effort high` for Claude. In bb, `--provider --model --reasoning-level`. In t3, `target.options`.

## By job

- **Taste, architecture, UI, copy, adversarial review:** Opus 5.5, medium. The reliable default for anything with taste: self-critical, uses its own feature, resolves its own conflicts. Fable 5.1 is as strong but chatty in code; trim its comments.
- **Perf and gardening, staged rendering work:** `openai-codex/gpt-6-astra`, high. Terse, needs no steering. For staged work, keep sending "step 2" to the same worker. Good on hetzner. Not for reviews.
- **Clear, mid-sized features:** Sonnet 5.5, high. Honest about what it left out; doesn't always play it through to the end, so put that in the done list.
- **Small, well-defined fixes:** `openai-codex/gpt-6.1-sol`, medium. Quick; check perf if it touched a hot path.
- **Cheap, well-defined passes:** `openrouter/deepseek/deepseek-v4.1-flash-1017`, high. Clean work, files its own follow-ups, absurd value. Never for words.
- **Recon, scouting, tedious clear things:** `openai-codex/gpt-6-luna`. Not for coding.
- **Words** (copy, docs, issue text): Claude models only.

`gpt-6.1-terra` is fast but stops halfway and skips the perf check; only with an explicit done list. Cursor Composer 2.5 and Grok 4.7 are fine on small, contained tasks.

## Review

A different family from the builder: Opus reviews GPT-built work, Sol reviews Claude-built work.

## Notes

- `openai-codex` and Claude bill subscriptions; `openrouter` bills per token. Claude's `opus` alias picks the latest Opus.
- A fast "done" seconds after a big brief on `openai-codex` means the sub quota is out: respawn elsewhere and tell Oskar.
- Switching a model mid-session is unreliable; spawn a new worker.
- Rotate workers before their context passes ~300k.
