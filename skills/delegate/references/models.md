# Delegate: models

Volatile. Prices and field notes live in his `llm-model-tierlist` note.

Each route is provider / model / reasoning level. In herdr that's the tail `--kind pi -- --provider <p> --model <m> --thinking <level>`, or `--kind claude -- --model opus --effort high` for Claude. In bb, `--provider --model --reasoning-level`. In t3, `target.options`.

## By job

- **Taste, architecture, UI, copy, adversarial review:** `claude-code/claude-opus-5-5:medium`, Oskar's pick for styling and design (bare `claude-opus-5-5` is ambiguous across providers). The reliable default for anything with taste: self-critical, uses its own feature, resolves its own conflicts. Fable 5.2 is as strong but chatty in code; trim its comments.
- **Perf and gardening, staged rendering work:** `openai-codex/gpt-6-astra`, high. Terse, needs no steering. For staged work, keep sending "step 2" to the same worker. Not for reviews.
- **Clear, mid-sized features:** Opus 5.5, medium; high for bigger features.
- **Logic, cleanup, small well-defined fixes:** `openai-codex/gpt-6.1-sol`, medium. Quick; finds real bugs while cleaning up. On a vague ask it never checks the goal, so give it a concrete one. Check perf if it touched a hot path. Or Sonnet 5.5, medium: honest about what it left out but doesn't always play it through to the end, so put that in the done list. Sonnet low was always right in a read-only test (5s, about as fast as Luna low), so try it for cheap reads and recon. It proposes fixes unasked.
- **Cheap, well-defined passes:** `openrouter/deepseek/deepseek-v4.1-flash-1017`, high. Clean work, files its own follow-ups, absurd value. Never for words.
- **Recon, scouting, tedious clear things:** `openai-codex/gpt-6-luna:high`, right every time in the test; low got facts wrong in 1 of 3 runs. Not for coding.
- **Words** (copy, docs, issue text): Claude models only.

`gpt-6.1-terra` is fast but stops halfway and skips the perf check; only with an explicit done list. Never use Grok models.

The speed numbers here come from one 36-run read-only test on a vague styling question.

## Review

A different family from the builder: Opus reviews GPT-built work, Sol reviews Claude-built work.

## Notes

- `openai-codex` and Claude bill subscriptions; `openrouter` bills per token. Claude's `opus` alias picks the latest Opus.
- A fast "done" seconds after a big brief on `openai-codex` means the sub quota is out: respawn elsewhere and tell Oskar.
- Switching a model mid-session is unreliable; spawn a new worker.
- Compact workers past ~400k.
