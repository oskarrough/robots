# Pane and tab placement

Mechanics for placing manual workers. The `herdr-delegate` wrapper handles placement itself via `--new-tab <label>`, `--workspace <id>`, or `--tab <id>`.

- Split with `pane split --current` or an explicit pane ID; an omitted target follows UI focus. Split and start in the current tab, then move into a labelled worker tab. Panes created inside a `tab create --no-focus` tab can fail to start.
- To build a one-pane worker tab, move the started pane directly with `pane move <pane> --new-tab --workspace <id> --label workers --no-focus`. `tab create` first creates a root shell, so moving a worker into that tab produces two panes.
- Never move a pane during its live wait; that can break the wait while the worker continues.
