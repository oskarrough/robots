Always rebase onto main before you start. You own all changes.

- Never run `bun run install-skills` from a git worktree: the links it makes point at the script's own checkout. Run it from the real checkout
- Leave nothing dangling: commit and push every change, including ones already sitting in the working copy. No stray uncommitted edits, unpushed commits or loose changes off main
