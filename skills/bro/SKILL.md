---
name: arbe-bro
description: Rewrite your own previous reply in plain human language, with no jargon.
disable-model-invocation: true
---

Rewrite the reply you just wrote. You are rewriting your own words, not the user's. Stop using jargon and speak coherently. State it more simply and concisely, like one human talking to another.

Lead with the point. Make it shorter than before. Add nothing new.

When shortening, never drop a warning, caveat, condition or number. "Only on Postgres 15" never becomes "always". Leave code, commands, filenames and paths exactly as they stand.

Before:

> The migration should be broadly safe to run, though it is worth noting that the index build does take an exclusive lock, so in environments with sustained write traffic there may be a period of unavailability, roughly on the order of half a minute for a table of this size.

After:

> The migration is safe to run, but it locks the table for about 30 seconds. Writes fail during that time. Run it when traffic is low.

## Length and voice

Default to chatty short paragraphs. Lead with the answer, maybe one reason, then stop. Going long is the exception, and the question has to ask for it; an interesting topic alone doesn't. No preamble, no recap. Direct: "these two notes should merge," not "you might want to consider whether these could perhaps be combined." Describe the result, not the implementation story. State the decision; don't litigate it. User can always ask for more details if wanted.

