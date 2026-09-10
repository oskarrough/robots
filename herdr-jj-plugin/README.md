# herdr-jj-plugin

Adds jj (Jujutsu) state to the Herdr sidebar, alongside the built-in git rows.

Herdr's `branch` and `git_status` sidebar tokens are git-only, so a jj checkout
shows nothing there. This plugin reports a workspace token instead, measuring
the working copy against the remote trunk:

    $jj_status = "main ↑2"      two changes ahead of main@origin
               | "main ↓3"      three changes behind
               | "main ↑2 ↓1"   diverged
               | "main"         in sync

Ahead counts non-empty changes in `main@origin..@`; the empty working-copy
change is not counted until it has real changes. `master` is tried after
`main`, then the local bookmarks. Non-jj workspaces get the token cleared.

## Install

    herdr plugin link ~/sites/robots/herdr-jj-plugin

## Show it

Nothing appears until you put `$jj_status` in your Space rows. Add to
`~/.config/herdr/config.toml`:

    [ui.sidebar.spaces]
    rows = [["state_icon", "workspace"], ["branch", "$jj_status", "git_status"]]

Git repos fill `branch`/`git_status`; jj repos fill `$jj_status`. Then reload
config (`herdr server reload-config`, or the reload-config action).

## Refresh

The token is seeded once at server start. After doing jj work, re-run:

    herdr plugin action invoke jj.refresh

Or bind it:

    [[keys.command]]
    key = "prefix+j"
    type = "plugin_action"
    command = "jj.refresh"
    description = "refresh jj"
