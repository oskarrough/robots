# robots

- Run `bun run install-skills` from `~/sites/robots`, never a worktree: the links it makes point at the script's own checkout.
- `bunx skills add <local path>` copies into `~/.agents/skills` instead of linking, so it can't replace `install-skills`.
- To test the `skills` CLI safely, set `HOME` to a temp dir but call the real bun binary (`~/.local/share/mise/installs/bun/latest/bin/bun x skills`); the mise shims break under a fake `HOME`.
