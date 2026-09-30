# PR

Commit the fix on `autobot/<slug>`, push, and open a PR. Label the issue `fix-pending`. No agent attribution: no Co-Authored-By trailer, no "Generated with" line.

The description is for a reviewer who hasn't read the report. Write it like one person to another, and keep to this shape:

```
Fixes #<n>

<One sentence: what was wrong or missing, and what's true once this ships.>

## Note
- <1–3 things a reviewer could trip on: choices fix made, deliberate omissions, surprises. "None." if none.>

## Outline
<The smallest view that explains the change, not a file-by-file changelog. Pick by what changed: logic → pseudocode, runtime flow → call tree, UI → component tree, layout → shallow file tree with each file's job. Use `diff` when the shape already existed, the whole block when it's mostly new. Keep only what the reviewer needs.>

## Try it
<Steps to see it: the reproduction for a bug, where to look for a feature. Screenshots from verify, if any: GitHub has no upload API, so commit them to an orphan `autobot-assets` branch under `<slug>/` and embed them as images: `![before](https://github.com/<repo>/blob/autobot-assets/<slug>/<file>?raw=true)`.>

Checks: <what ran and passed>. <What wasn't checked.>
```
