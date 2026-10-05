# Reproduce

Get to the reporter's state: their version or commit, their platform where you can, their steps. Try each claim by running it: a script against the engine, a test, or the app in a browser. Reading the code explains a reproduction; it isn't one.

- Reproduced → decide bug or intended behaviour (docs, code comments, blame, old issues). Bug → label `confirmed`, drop `needs-repro`. Intended → comment explaining why.
- Not reproduced → comment what you tried and ask the one thing that would help.
- An extra claim that turns out unrelated → open it as its own issue, unless it's small enough to ride along with the fix.

A bug you hit on the way that isn't the reported one: open its own issue if you can show it, else note it in the report.

If you tried it in a browser, screenshot what you saw, save it next to the report, and attach it to any comment you post (`gh issue comment --attach ./repro.png`, referenced as `![what I saw](./repro.png)`). A reporter believes a picture faster than a paragraph.

Keep any repro script next to the report, not in /tmp. Report: what you ran, what happened, and the exact reproduction steps. Fix starts from those.
