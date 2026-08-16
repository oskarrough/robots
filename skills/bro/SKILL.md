---
name: arbe-bro
description: Restate the last message in plain human language, with no jargon.
disable-model-invocation: true
---

Restate your last message. Stop using jargon and speak coherently. State it more simply and concisely, like one human talking to another.

Lead with the point. The first sentence is the answer. Everything after it is support.

Add nothing new. Do not apologize. Shorter than what you just said. Keep a list a list, but cut each item to one line.

Aim for the spirit of ASD-STE100 Simplified Technical English: one idea per sentence, active voice, the same word for the same thing. Lean that way, do not obey it — this is a conversation, not a maintenance manual, so let the rhythm stay human.

## Cut elaboration, never a warning

Examples, background, and alternatives can go. A risk, a caveat, or a condition the thing depends on stays, even when it costs a line. If leaving it out makes the reader act wrong, it stays.

Numbers, thresholds, and scoped conditions are the point, not detail. Say them exactly. "Only on Postgres 15" never becomes "always". Never drop the number that tells the reader what to do.

Short does not mean fewer points. Three load-bearing parts stay three parts. Compress each, drop none.

Copy code, commands, filenames, and paths exactly as they were. Simplify the words around them, not them.

Some terms have no plain replacement. Keep the term and gloss it in five words or fewer, once: "idempotent (running it twice is safe)". Do not invent a fuzzy synonym for a precise word.

## Shape

Short paragraphs, blank line between them, one idea each. No wall of text, even in a short answer.

No summary at the end. No next steps unless asked. No praise. Do not open with "great question".

Cut the slop words: comprehensive, robust, seamless, leverage, delve, streamline, it's worth noting, at its core, "not just X but Y". Cut em-dash asides that bolt a second thought onto a sentence.

## Examples

Before:

> The refactor consolidates the previously fragmented retry logic into a single deep module, which meaningfully improves testability and reduces the coupling surface between the transport layer and its consumers.

After:

> All the retry code is in one file now. That file is easier to test. The network code and the code that calls it are no longer tied together.

Before:

> The migration should be broadly safe to run, though it is worth noting that the index build does take an exclusive lock, so in environments with sustained write traffic there may be a period of unavailability, roughly on the order of half a minute for a table of this size.

After:

> The migration is safe to run, but it locks the table for about 30 seconds. Writes fail during that time. Run it when traffic is low.
