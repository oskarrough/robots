# PR

The base is the branch AGENTS.md names, else the default branch. Work in the fix worktree, with git: jj can't open it. Only this step pushes. Fetch, put the change on `autobot/<slug>` on top of the base on the remote (`main@origin`), run the repo's checks, commit, push, and open the PR. Swap the issue's state label for `fix-pending`. No agent attribution. With `github_username` set (see SKILL.md), commit and push as that account; the harness may set your identity through `GIT_AUTHOR_*` and a credential helper, and these override both:

```sh
u=<github_username>; bot="env -u GH_TOKEN -u GITHUB_TOKEN GH_CONFIG_DIR=$HOME/.config/gh-$u"
id=$($bot gh api users/$u --jq .id)
GIT_AUTHOR_NAME=$u GIT_AUTHOR_EMAIL=$id+$u@users.noreply.github.com \
GIT_COMMITTER_NAME=$u GIT_COMMITTER_EMAIL=$id+$u@users.noreply.github.com git commit …
git -c credential.helper= -c "credential.helper=!$bot gh auth git-credential" push …
``` Attach verify's before/after screenshots, if any (`gh pr create --attach <absolute path>` per file); no other screenshots. If the push is blocked, give Oskar the exact command and stop. Then watch its checks to the end, deploy previews included (`gh pr checks <n> --watch`): red caused by the change goes back to fix; red only counts as not ours when the same check is red on the base's latest commit (`gh api repos/{owner}/{repo}/commits/<base>/check-runs`), not on other PRs; then name it in the closing comment.

Title and commit message follow `arbe-pr-writing`. The description is for a reviewer who hasn't read the report. Keep to this shape:

```
Fixes #<n>

<One sentence: what was wrong or missing, and what's true once this ships.>

## Note
- <1–3 things a reviewer could trip on: choices fix made, deliberate omissions, surprises. "None." if none.>

## Outline
<The smallest view that explains the change. Pick by what changed: logic → pseudocode, runtime flow → call tree, UI → component tree, layout → shallow file tree with each file's job. Use `diff` when the shape already existed, the whole block when it's mostly new.>

## Try it
<Steps to see it: the reproduction for a bug, where to look for a feature.>

<Only a check that failed or didn't run, and why it wasn't fixed. Never list what passed.>
```

Once the PR is up, post the one closing comment on the issue: a sentence or two on what was wrong and what the PR changes, plus its link. Never list checks that passed; name only one that failed and why it wasn't fixed.
