# Lanes

Running an approved batch yourself, inside bb, when Oskar wants it to land straight on the base branch with no PRs ("in parallel, in this checkout"). Several fix threads share the main checkout; you verify and commit. Per issue, lanes follow arbe-autobot's step files (triage, fix, the report); the worktree, verify-thread and pr parts are replaced by what's below.

```
signals ─▶ triage all ─▶ group into lanes by file ─▶ one fix thread per lane
lane: issue ─▶ fix ─▶ pause ─▶ you verify + commit + push ─▶ "go on" ─▶ next issue
```

Triage every signal inline first. Then group by the files each fix will touch, not by priority: issues that share a file go in one lane, in order; lanes never share a file. The shared entry file (main.js) is the usual clash: tell lanes to avoid it or say so in their section.

Write one rules file all lanes read, and one brief per lane: its issues in order, their reports, its own files, the files that belong to others. The rules, overriding fix.md:
- No worktree, branch, commit, push or anything that rewrites history. Other lanes' half-done edits will show in the diff; leave them alone.
- Reuse the running dev server; start it yourself once before spawning if it's down.
- Run the repo's checks on your own files and the tests you touch. The parent runs the full suite.
- No browser and no benchmarks by default: the repo's checks and the tests you touch, then stop. The parent does one smoke run at the end if the batch needs it. Never reset a file to get a clean baseline: other lanes' edits live there too.
- State the invariant the change must keep ("same tiles, byte for byte") and let the lane pick the method.
- After each issue: write the `## Fix` section, `Next: verify`, end the turn, and wait for "go on". Starting the next issue early would leak into its commit.

Spawn the lanes in the current environment (`--environment $BB_ENVIRONMENT_ID`), not worktrees. Wait for whichever goes idle first.

Verify each issue yourself: read the diff, check the maths and the edge cases, run the full suite and checks once, look at the lane's screenshot. Findings go back to the lane. When it holds, land only that lane's files: `jj commit <paths> -m "<player-facing message>\n\nCloses #<n>"`, `jj bookmark set <base> -r @-`, push. Post the closing comment with the commit instead of a PR link, append `## Verify` and `Next: done` to the report, then tell the lane to go on. A lane that's finished gets archived.

Issues whose title promises more than one step get `Part of #<n>` and stay open.
