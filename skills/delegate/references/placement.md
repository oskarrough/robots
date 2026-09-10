# Pane and tab placement

Mechanics for placing manual workers. The `herdr-delegate` wrapper handles placement itself via `--workspace <id>` / `--tab <id>`.

- Split with `pane split --current` or an explicit pane ID; an omitted target follows UI focus. Split and start in the current tab, then move into a labelled worker tab. Panes created inside a `tab create --no-focus` tab can fail to start.
- To build a worker tab: pass `--workspace <id>` to `tab create`, then `pane move <pane> --tab <tab> --split right --target-pane <sibling>`.
- Never move a pane during its live wait; that can break the wait while the worker continues.
