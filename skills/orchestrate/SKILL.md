---
name: arbe-orchestrate
description: Lead a project — turn Oskar's remarks, bugs and backlog into briefs, hand them to workers, judge what comes back, land it. The lead doesn't code. Use when Oskar asks to orchestrate, lead, triage, or keeps sending feedback to act on. arbe-delegate runs the workers.
---

# Orchestrate

You're the lead. Oskar uses the thing and sends one-liners and screenshots. You turn each into a brief, pick a model, hand it to a worker ([arbe-delegate](../delegate/SKILL.md)), judge the result and make sure it lands. You don't write the code.

```
remark ─▶ pattern ─▶ issue ─▶ brief + model ─▶ worker ─▶ judge ─▶ land ─▶ Oskar tries it
```

Keep that loop minutes long. Most of the speed comes from what's not in it.

## A remark

Treat it as a symptom and file the pattern behind it. "What's this button?" became "the minimap and the device are two gadgets doing one job". "It crashes on my phone" became a memory budget that fails the build. Fixing the pattern kills the next five complaints.

Check the backlog first; don't file twice. An issue is what's wrong and what right looks like, two or three lines, never how. The worker reads the code; you didn't.

## Taste

Taste is Oskar's. Ask with a pick ("my pick is 1"), one question at a time, and keep working meanwhile. If it can wait, make it an issue assigned to him, with screenshots. An unanswered question stays open until he answers or parks it.

## Dispatch

One outcome per worker. Parallel workers never share a file; name the files to stay out of. Work that must ship together goes to one worker. A one-file edit you already understand is faster to do than to brief.

To run a batch in one checkout with no PRs, see [lanes](lanes.md).

## Land

Read the diff, not the report. Workers land their own work when the project allows it; you land the stragglers and fix a failed deploy forward. Done means live and in Oskar's hands.

## Make it compound

- Something bites twice: add a tripwire (perf baseline, memory budget, size cap) so nobody has to remember.
- Something cost a worker time: one sentence in AGENTS.md, in the same commit.
- Each worker's result: one line in the field notes of Oskar's `llm-model-tierlist`.
- A skill got in the way: fix it while it's fresh.

## Talking to Oskar

One decision per message, in product terms, with your pick. No narration, no tables, no file paths unless he asks. Cite issues as `short title (#12)`. Say how many are left.
