// Report the jj state of every Herdr workspace as the $jj_status token.
//
//   $jj_status = "main"       on main@origin, nothing local
//              | "main ↑2"    two changes ahead of main@origin
//              | "main ↓3"    three changes behind
//              | "main ↑2 ↓1" diverged
//
// Ahead counts non-empty changes in `main@origin..@` (the working copy counts
// only when it actually has changes). Behind counts `@..main@origin`.
// Workspaces that are not jj repos get the token cleared, so the built-in git
// `branch` / `git_status` rows keep working in plain git checkouts.
import { spawnSync } from "node:child_process";

const HERDR = process.env.HERDR_BIN_PATH ?? "herdr";
const SOURCE = "herdr-jj";
const TOKEN = "jj_status";
const BASES = ["main@origin", "master@origin", "main", "master"];

type Workspace = { workspace_id: string; label: string };
type Pane = { workspace_id: string; cwd: string; focused: boolean };

function herdrRun(args: string[]): string {
  const res = spawnSync(HERDR, args, { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`herdr ${args.join(" ")} failed: ${res.stderr.trim()}`);
  }
  return res.stdout;
}

function herdrJson(args: string[]): any {
  return JSON.parse(herdrRun(args));
}

function jj(cwd: string, args: string[]): string | null {
  const res = spawnSync("jj", ["--color=never", ...args], { cwd, encoding: "utf8" });
  return res.status === 0 ? res.stdout.trim() : null;
}

function jjCount(cwd: string, revset: string): number {
  const out = jj(cwd, ["log", "-r", revset, "--no-graph", "-T", 'change_id ++ "\\n"']);
  return out ? out.split("\n").filter(Boolean).length : 0;
}

function statusFor(cwd: string): string | null {
  // Not a jj repo at all: bail so the token gets cleared.
  if (!jj(cwd, ["log", "-r", "@", "--no-graph", "-T", "change_id"])) return null;

  for (const base of BASES) {
    // A non-existent remote bookmark is an error, an empty result is a success.
    if (jj(cwd, ["log", "-r", base, "--no-graph", "-T", "change_id"]) === null) continue;

    const name = base.replace(/@origin$/, "");
    const ahead = jjCount(cwd, `${base}..@ & ~empty()`);
    const behind = jjCount(cwd, `@..${base}`);
    let label = name;
    if (ahead) label += ` ↑${ahead}`;
    if (behind) label += ` ↓${behind}`;
    return label;
  }

  // No main/master anywhere: show the nearest bookmark, if any.
  return jj(cwd, ["log", "-r", "heads(::@ & bookmarks())", "--no-graph", "-T", "bookmarks"]) || null;
}

function cwdByWorkspace(panes: Pane[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const pane of panes) {
    if (pane.focused || !map.has(pane.workspace_id)) {
      map.set(pane.workspace_id, pane.cwd);
    }
  }
  return map;
}

const workspaces: Workspace[] = herdrJson(["workspace", "list"]).result.workspaces;
const panes: Pane[] = herdrJson(["pane", "list"]).result.panes;
const cwds = cwdByWorkspace(panes);

let onJj = 0;
for (const ws of workspaces) {
  const cwd = cwds.get(ws.workspace_id);
  const status = cwd ? statusFor(cwd) : null;
  const args = status
    ? ["workspace", "report-metadata", ws.workspace_id, "--source", SOURCE, "--token", `${TOKEN}=${status}`]
    : ["workspace", "report-metadata", ws.workspace_id, "--source", SOURCE, "--clear-token", TOKEN];
  herdrRun(args);
  if (status) onJj++;
}

console.log(`herdr-jj: ${onJj}/${workspaces.length} workspaces on jj`);
