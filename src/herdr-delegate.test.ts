import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { WORKER_CONTRACTS } from "./herdr-delegate.ts";

const cliPath = join(import.meta.dir, "herdr-delegate.ts");
const fakeHerdr = `#!/usr/bin/env bun
import { appendFile, readFile } from "node:fs/promises";
const argv = process.argv.slice(2), command = argv.slice(0, 2).join(" "), scenario = process.env.FAKE_HERDR_SCENARIO ?? "success";
await appendFile(process.env.FAKE_HERDR_RECORD!, JSON.stringify(argv) + "\\n");
const calls = (await readFile(process.env.FAKE_HERDR_RECORD!, "utf8")).trim().split("\\n").map((line) => JSON.parse(line));
const name = process.env.FAKE_AGENT_NAME ?? argv[2] ?? "worker", kind = process.env.FAKE_AGENT_KIND ?? "pi", moved = calls.some((call) => call[0] === "pane" && call[1] === "move");
const target = argv[2], countFor = (verb) => calls.filter((call) => call[0] === "agent" && call[1] === verb && call[2] === target).length;
const pane = (pane_id = "w4:p2", tab_id = "w4:t1", workspace_id = "w4") => ({ pane_id, tab_id, workspace_id });
const claudeSession = process.env.FAKE_CLAUDE_SESSION_ID;
const agent = () => ({ name, agent: kind, ...(moved ? pane("wB:p3", "wB:t1", "wB") : pane()), agent_status: "done", ...(kind === "pi" && scenario !== "missing-session" ? { agent_session: { kind: "path", value: scenario === "unreadable-session" ? "/missing/session.jsonl" : process.env.FAKE_PI_SESSION_FILE } } : kind === "claude" && claudeSession ? { agent_session: { kind: "id", value: claudeSession } } : {}) });
function ok(result) { process.stdout.write(JSON.stringify({ id: "fake", result }) + "\\n"); process.exit(0); }
function fail(code, message = code) { process.stderr.write(JSON.stringify({ id: "fake", error: { code, message } }) + "\\n"); process.exit(1); }
function failPlain(message) { process.stderr.write(message + "\\n"); process.exit(2); }
if (command === "workspace list") {
  const workspaces = [{ workspace_id: "w4", label: "Notes", active_tab_id: "w4:t1" }, { workspace_id: "wB", label: "arbe", active_tab_id: "wB:t1" }];
  if (scenario === "duplicate-workspace") workspaces.push({ workspace_id: "wC", label: "arbe", active_tab_id: "wC:t1" });
  ok({ workspaces });
}
if (command === "agent list") ok({ agents: scenario === "name-conflict" ? [{ name }] : [] });
if (command === "pane split") {
  if (scenario === "invalid-split") ok({ pane: { id: "wrong" } });
  ok({ pane: pane() });
}
if (command === "agent start") {
  if (scenario === "busy-start-once" && calls.filter((call) => call[0] === "agent" && call[1] === "start").length === 1) fail("agent_pane_busy");
  if (scenario === "ambiguous-start") fail("agent_not_ready", "blocked during startup");
  if (scenario === "definite-start-failure") fail("agent_start_failed");
  if (scenario === "plain-start-failure") failPlain("error: invalid value for --kind");
  ok({ agent: agent() });
}
if (command === "pane move") {
  if (scenario === "move-unchanged") ok({ move_result: { changed: false, reason: "zoomed_tab", pane: pane() } });
  ok({ move_result: { changed: true, reason: null, pane: pane("wB:p3", "wB:t1", "wB") } });
}
if (command === "agent prompt") {
  if (scenario === "prompt-timeout") fail("timeout", "prompt timed out");
  ok({ agent: agent() });
}
if (command === "agent get") {
  if (scenario === "definite-start-failure" || scenario === "plain-start-failure") fail("agent_not_found");
  if (scenario === "missing-name" && target === "ghost") fail("agent_not_found");
  ok({ agent: agent() });
}
if (command === "agent wait") {
  if (scenario === "not-running-flap" && countFor("wait") === 1) fail("agent_not_running");
  if (scenario === "slow-second" && target === "beta") {
    const at = argv.indexOf("--timeout");
    await Bun.sleep(at < 0 ? 60000 : Number(argv[at + 1]));
    fail("timeout", "wait timed out");
  }
  ok({ agent: agent() });
}
if (command === "agent read") {
  const busy = { "flap-then-settle": "\\u2839 pi is thinking\\nesc to interrupt\\n", "not-running-flap": "Working...\\n", "claude-spinner-then-settle": "\\u273b Puzzling\\u2026 (12s \\u00b7 2 shell)\\nnew message \\u2193\\n" }[scenario];
  if (busy && countFor("read") === 1) { process.stdout.write(busy); process.exit(0); }
  if (scenario === "never-ran") { process.stdout.write("pi gpt-5.6-sol 0.0%/1.0M ready\\n"); process.exit(0); }
  if (scenario === "blocked-line") { process.stdout.write("worker log\\nORCHESTRATOR: which repo do you mean?\\n"); process.exit(0); }
  process.stdout.write("raw terminal\\nnot json {still raw}\\n"); process.exit(0);
}
if (command === "pane close") ok({ closed: true });
fail("unexpected_fake_command", command);
`;

type CliResult = { code: number; output: Record<string, unknown>; calls: string[][]; stderr: string };
let directory: string, fakePath: string, recordPath: string, sessionPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "herdr-delegate-"));
  fakePath = join(directory, "fake-herdr.ts"); recordPath = join(directory, "calls.jsonl"); sessionPath = join(directory, "session.jsonl");
  await writeFile(fakePath, fakeHerdr); await writeFile(recordPath, "");
  await writeFile(sessionPath, '{"type":"session"}\n{"type":"model_change","provider":"openai-codex","modelId":"gpt-5.6-sol"}\n{"type":"thinking_level_change","thinkingLevel":"medium"}\n'); await chmod(fakePath, 0o755);
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

async function runCli(args: string[], scenario = "success", herdrEnv = "1", extraEnv: Record<string, string> = {}): Promise<CliResult> {
  const kindIndex = args.indexOf("--kind"), kind = kindIndex < 0 ? "pi" : args[kindIndex + 1]!;
  const child = Bun.spawn([process.execPath, cliPath, ...args], {
    env: { ...process.env, HERDR_ENV: herdrEnv, HERDR_BIN_PATH: fakePath, FAKE_HERDR_RECORD: recordPath, FAKE_HERDR_SCENARIO: scenario, FAKE_AGENT_NAME: args[0] ?? "worker", FAKE_AGENT_KIND: kind, FAKE_PI_SESSION_FILE: sessionPath, ...extraEnv }, stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  const records = (await readFile(recordPath, "utf8")).trim();
  return { code, output: JSON.parse(stdout), calls: records ? records.split("\n").map((line) => JSON.parse(line)) : [], stderr };
}
async function runWaitCli(args: string[], scenario = "success"): Promise<CliResult> {
  const child = Bun.spawn([process.execPath, cliPath, "wait", ...args], {
    env: { ...process.env, HERDR_ENV: "1", HERDR_BIN_PATH: fakePath, FAKE_HERDR_RECORD: recordPath, FAKE_HERDR_SCENARIO: scenario, FAKE_PI_SESSION_FILE: sessionPath }, stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  const records = (await readFile(recordPath, "utf8")).trim();
  return { code, output: JSON.parse(stdout), calls: records ? records.split("\n").map((line) => JSON.parse(line)) : [], stderr };
}
const commands = (result: CliResult) => result.calls.map((call) => call.slice(0, 2).join(" "));
const settledOf = (result: CliResult) => result.output.settled as Record<string, unknown>[];
const resolvedRuntime = { provider: "openai-codex", model: "gpt-5.6-sol", reasoning_level: "medium", subscription_billed: true };
function agentOf(result: CliResult): Record<string, unknown> { return result.output.agent as Record<string, unknown>; }
function cleanupOf(result: CliResult): Record<string, unknown> { return result.output.cleanup as Record<string, unknown>; }
function upstreamOf(result: CliResult): Record<string, unknown> { return result.output.upstream_herdr_error as Record<string, unknown>; }

describe("herdr-delegate", () => {
  test("maps the one fresh-worker command and emits verified runtime and terminal text", async () => {
    const result = await runCli(["builder", "Do work", "--kind", "pi", "--direction", "down", "--cwd", "/repo path", "--start-timeout", "4567", "--timeout", "0", "--lines", "42", "--", "--provider", "openai-codex", "--model", "gpt-5.6-sol", "--thinking", "medium"]);
    expect(result.code).toBe(0); expect(result.stderr).toBe("");
    expect(result.calls).toEqual([
      ["agent", "list"],
      ["pane", "split", "--current", "--direction", "down", "--cwd", "/repo path", "--no-focus"],
      ["agent", "start", "builder", "--kind", "pi", "--pane", "w4:p2", "--timeout", "4567", "--", "--provider", "openai-codex", "--model", "gpt-5.6-sol", "--thinking", "medium"],
      ["agent", "get", "builder"],
      ["agent", "prompt", "builder", `Do work\n\n${WORKER_CONTRACTS}`, "--wait", "--timeout", "0"],
      ["agent", "read", "builder", "--source", "visible", "--lines", "42", "--format", "text"],
    ]);
    expect(result.output).toEqual({ ok: true, created: true, agent: { name: "builder", kind: "pi", pane_id: "w4:p2", tab_id: "w4:t1", workspace_id: "w4", status: "done" }, runtime: { requested: { provider: "openai-codex", model: "gpt-5.6-sol", reasoning_level: "medium" }, resolved: resolvedRuntime, verified: true, matches_requested: true }, prompt: { accepted: true, settled: "done" }, terminal_text: "raw terminal\nnot json {still raw}\n" });
  });

  test("moves into an exact existing tab and returns final handles", async () => {
    const result = await runCli(["tab-worker", "Work", "--kind", "pi", "--tab", "wB:t1", "--direction", "down"]);
    expect(result.code).toBe(0);
    expect(commands(result)).toEqual(["agent list", "pane split", "agent start", "agent get", "pane move", "agent prompt", "agent read"]);
    expect(result.calls[4]).toEqual(["pane", "move", "w4:p2", "--tab", "wB:t1", "--split", "down", "--no-focus"]);
    expect(agentOf(result)).toMatchObject({ pane_id: "wB:p3", tab_id: "wB:t1", workspace_id: "wB" });
  });

  test("resolves a workspace label to its active existing tab before creating", async () => {
    const result = await runCli(["arbe-worker", "Work", "--kind", "pi", "--workspace", "arbe"]);
    expect(result.code).toBe(0);
    expect(commands(result)).toEqual(["workspace list", "agent list", "pane split", "agent start", "agent get", "pane move", "agent prompt", "agent read"]);
    expect(result.calls[5]).toEqual(["pane", "move", "w4:p2", "--tab", "wB:t1", "--split", "right", "--no-focus"]);
  });

  test("rejects a duplicate workspace label before creating a pane", async () => {
    const result = await runCli(["ambiguous", "Work", "--kind", "pi", "--workspace", "arbe"], "duplicate-workspace");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("preflight"); expect(result.output.created).toBe(false);
    expect(upstreamOf(result)).toMatchObject({ code: "herdr_delegate_workspace_ambiguous", workspace_ids: ["wB", "wC"] });
    expect(commands(result)).toEqual(["workspace list"]);
  });

  test("parses provider, model, and thinking shorthand from native Pi arguments", async () => {
    const result = await runCli(["resolved", "Work", "--kind", "pi", "--", "--model", "openai-codex/gpt-5.6-sol:medium"]);
    expect(result.code).toBe(0);
    expect(result.output.runtime).toEqual({ requested: { provider: "openai-codex", model: "gpt-5.6-sol", reasoning_level: "medium" }, resolved: resolvedRuntime, verified: true, matches_requested: true });
  });

  test.each(["missing-session", "unreadable-session"])("a %s Pi JSONL reports unknown resolved values", async (scenario) => {
    const result = await runCli(["unknown", "Work", "--kind", "pi"], scenario);
    expect(result.code).toBe(0);
    expect(result.output.runtime).toEqual({ requested: { provider: null, model: null, reasoning_level: null }, resolved: { provider: null, model: null, reasoning_level: null, subscription_billed: null }, verified: false, matches_requested: null });
  }, 15_000);

  test("an explicit provider keeps a slashed openrouter model ID whole", async () => {
    await writeFile(sessionPath, '{"type":"model_change","provider":"openrouter","modelId":"google/gemini-3.8-flash"}\n{"type":"thinking_level_change","thinkingLevel":"low"}\n');
    const result = await runCli(["gemini", "Work", "--kind", "pi", "--", "--provider", "openrouter", "--model", "google/gemini-3.8-flash", "--thinking", "low"]);
    expect(result.code).toBe(0);
    expect(result.output.runtime).toEqual({ requested: { provider: "openrouter", model: "google/gemini-3.8-flash", reasoning_level: "low" }, resolved: { provider: "openrouter", model: "google/gemini-3.8-flash", reasoning_level: "low", subscription_billed: false }, verified: true, matches_requested: true });
  });

  async function writeClaudeSession(home: string, model: string): Promise<void> {
    const projectDir = join(home, ".claude", "projects", process.cwd().replace(/[^A-Za-z0-9-]/g, "-"));
    await mkdir(projectDir, { recursive: true });
    await writeFile(join(projectDir, "sess-1.jsonl"), `{"type":"user"}\n{"type":"assistant","message":{"model":"${model}"}}\n`);
  }

  test("claude resolves its model post-prompt and an alias matches the full ID", async () => {
    await writeClaudeSession(directory, "claude-fable-5-1");
    const result = await runCli(["fable-worker", "Work", "--kind", "claude", "--", "--model", "fable", "--effort", "low"], "success", "1", { HOME: directory, FAKE_CLAUDE_SESSION_ID: "sess-1" });
    expect(result.code).toBe(0);
    expect(result.output.runtime).toEqual({ requested: { provider: null, model: "fable", reasoning_level: "low" }, resolved: { provider: "anthropic", model: "claude-fable-5-1", reasoning_level: null, subscription_billed: null }, verified: true, matches_requested: true });
  });

  test("a claude model mismatch fails post-prompt but preserves the agent", async () => {
    await writeClaudeSession(directory, "claude-fable-5-1");
    const result = await runCli(["wrong-claude", "Work", "--kind", "claude", "--", "--model", "opus"], "success", "1", { HOME: directory, FAKE_CLAUDE_SESSION_ID: "sess-1" });
    expect(result.code).toBe(1); expect(result.output.stage).toBe("verify"); expect(result.output.created).toBe(true);
    expect(upstreamOf(result).code).toBe("herdr_delegate_runtime_mismatch");
    expect(cleanupOf(result)).toEqual({ action: "none", reason: "matching_agent_preserved" });
    expect(result.output.terminal_text).toBe("raw terminal\nnot json {still raw}\n");
  });

  test("a runtime mismatch fails but preserves the confirmed agent", async () => {
    await writeFile(sessionPath, '{"type":"model_change","provider":"openai","modelId":"gpt-4o"}\n{"type":"thinking_level_change","thinkingLevel":"off"}\n');
    const result = await runCli(["wrong", "Work", "--kind", "pi", "--", "--provider", "openai-codex", "--model", "gpt-5.6-sol", "--thinking", "medium"]);
    expect(result.code).toBe(1); expect(result.output.stage).toBe("verify"); expect(result.output.created).toBe(true);
    expect(upstreamOf(result).code).toBe("herdr_delegate_runtime_mismatch");
    expect(cleanupOf(result)).toEqual({ action: "none", reason: "matching_agent_preserved" });
    expect(result.calls.some((call) => call[0] === "pane" && call[1] === "close")).toBe(false);
  });

  test.each(["claude", "cursor"])("%s leaves runtime resolution unknown", async (kind) => {
    const result = await runCli([`${kind}-worker`, "Work", "--kind", kind]);
    expect(result.code).toBe(0);
    expect(result.output.runtime).toEqual({ requested: { provider: null, model: null, reasoning_level: null }, resolved: { provider: null, model: null, reasoning_level: null, subscription_billed: null }, verified: false, matches_requested: null });
  });

  test("changed false is a preserved move failure", async () => {
    const result = await runCli(["kept", "Work", "--kind", "pi", "--tab", "wB:t1"], "move-unchanged");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("move"); expect(result.output.created).toBe(true);
    expect(upstreamOf(result)).toMatchObject({ code: "herdr_delegate_move_unchanged", reason: "zoomed_tab" });
    expect(cleanupOf(result)).toEqual({ action: "none", reason: "agent_started_preserved" });
    expect(result.calls.some((call) => call[1] === "close")).toBe(false);
  });

  test("startup retries only agent_pane_busy", async () => {
    const result = await runCli(["racer", "Work", "--kind", "pi"], "busy-start-once");
    expect(result.code).toBe(0);
    expect(commands(result)).toEqual(["agent list", "pane split", "agent start", "agent start", "agent get", "agent prompt", "agent read"]);
  }, 7_000);

  test("ambiguous start preserves a matching registered agent", async () => {
    const result = await runCli(["blocked", "Work", "--kind", "pi"], "ambiguous-start");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("start"); expect(result.output.created).toBe(true);
    expect(cleanupOf(result)).toEqual({ action: "none", reason: "matching_agent_preserved" });
  });

  test("definite failed start closes only the new pane", async () => {
    const result = await runCli(["broken", "Work", "--kind", "pi"], "definite-start-failure");
    expect(result.code).toBe(1); expect(result.output.created).toBe(false); expect(result.output.stage).toBe("start");
    expect(cleanupOf(result)).toEqual({ action: "pane_close", pane_id: "w4:p2", outcome: "closed" });
  });

  test("prompt timeout preserves the confirmed worker", async () => {
    const result = await runCli(["slow", "Work", "--kind", "pi", "--timeout", "10"], "prompt-timeout");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("prompt"); expect(result.output.created).toBe(true);
    expect(upstreamOf(result)).toEqual({ code: "timeout", message: "prompt timed out" });
    expect(cleanupOf(result)).toEqual({ action: "none", reason: "agent_started_preserved" });
  });

  test("rejects a live name before creating a pane", async () => {
    const result = await runCli(["taken", "Work", "--kind", "pi"], "name-conflict");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("preflight");
    expect(commands(result)).toEqual(["agent list"]);
  });

  test.each([
    ["missing prompt", ["worker"]],
    ["missing kind", ["worker", "Work"]],
    ["two destinations", ["worker", "Work", "--kind", "pi", "--tab", "wB:t1", "--workspace", "arbe"]],
    ["old run subcommand", ["run", "worker", "Work", "--kind", "pi"]],
    ["invalid timeout", ["worker", "Work", "--kind", "pi", "--timeout", "x"]],
  ])("rejects %s", async (_label, args) => {
    const result = await runCli(args as string[]);
    expect(result.code).toBe(1); expect(result.output.stage).toBe("arguments"); expect(result.calls).toEqual([]);
  });

  test("requires a Herdr environment", async () => {
    const result = await runCli(["worker", "Work", "--kind", "pi"], "success", "0");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("environment"); expect(result.calls).toEqual([]);
  });
});

describe("herdr-delegate wait", () => {
  test("re-arms while the pane still paints activity and settles only on a confirmed quiet pane", async () => {
    const result = await runWaitCli(["alpha", "--confirm-interval", "10"], "flap-then-settle");
    expect(result.code).toBe(0); expect(result.stderr).toBe("");
    expect(commands(result)).toEqual(["agent get", "agent wait", "agent get", "agent read", "agent wait", "agent get", "agent read", "agent get", "agent read"]);
    expect(result.calls[1]).toEqual(["agent", "wait", "alpha", "--until", "done", "--until", "blocked"]);
    expect(result.calls[3]).toEqual(["agent", "read", "alpha", "--source", "visible", "--lines", "120", "--format", "text"]);
    expect(result.output).toEqual({ ok: true, stage: "wait", settled: [{ name: "alpha", status: "done", classification: "report", terminal_text: "raw terminal\nnot json {still raw}\n" }], running: [], timed_out: [] });
  });

  test("a Claude spinner line keeps the wait armed", async () => {
    const result = await runWaitCli(["alpha", "--confirm-interval", "10"], "claude-spinner-then-settle");
    expect(result.code).toBe(0);
    expect(commands(result).filter((command) => command === "agent wait")).toHaveLength(2);
    expect(settledOf(result)[0]).toMatchObject({ name: "alpha", classification: "report" });
  });

  test("agent_not_running over a busy pane is a flap, not a settle", async () => {
    const result = await runWaitCli(["alpha", "--confirm-interval", "10"], "not-running-flap");
    expect(result.code).toBe(0);
    expect(commands(result).filter((command) => command === "agent wait")).toHaveLength(2);
    expect(result.output.running).toEqual([]);
  });

  test("an unknown name fails precheck before any wait is armed", async () => {
    const result = await runWaitCli(["alpha", "ghost"], "missing-name");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("precheck");
    expect(result.output.missing).toEqual(["ghost"]);
    expect(upstreamOf(result)).toMatchObject({ code: "herdr_delegate_agent_not_found", names: ["ghost"] });
    expect(commands(result)).toEqual(["agent get", "agent get"]);
    expect(result.output).toMatchObject({ settled: [], running: [], timed_out: [] });
  });

  test("an ORCHESTRATOR line classifies a settled worker as blocked", async () => {
    const result = await runWaitCli(["alpha", "--confirm-interval", "10"], "blocked-line");
    expect(result.code).toBe(0);
    expect(settledOf(result)[0]).toEqual({ name: "alpha", status: "done", classification: "blocked", terminal_text: "worker log\nORCHESTRATOR: which repo do you mean?\n" });
  });

  test("an untouched context statusline classifies as never_ran", async () => {
    const result = await runWaitCli(["alpha", "--confirm-interval", "10"], "never-ran");
    expect(result.code).toBe(0);
    expect(settledOf(result)[0]).toMatchObject({ name: "alpha", classification: "never_ran" });
  });

  test("--any returns the first settle and reports the rest as still running", async () => {
    const result = await runWaitCli(["alpha", "beta", "--confirm-interval", "10"], "slow-second");
    expect(result.code).toBe(0);
    expect(settledOf(result).map((agent) => agent.name)).toEqual(["alpha"]);
    expect(result.output.running).toEqual(["beta"]); expect(result.output.timed_out).toEqual([]);
  }, 10_000);

  test("--all keeps waiting and times out the worker that never settles", async () => {
    const result = await runWaitCli(["alpha", "beta", "--all", "--confirm-interval", "10", "--timeout", "400"], "slow-second");
    expect(result.code).toBe(1);
    expect(settledOf(result).map((agent) => agent.name)).toEqual(["alpha"]);
    expect(result.output.timed_out).toEqual(["beta"]); expect(result.output.running).toEqual([]);
    expect(result.calls.some((call) => call[1] === "wait" && call[2] === "beta" && call.includes("--timeout"))).toBe(true);
  }, 10_000);

  test("last N lines only", async () => {
    const result = await runWaitCli(["alpha", "--confirm-interval", "10", "--lines", "1"], "blocked-line");
    expect(result.code).toBe(0);
    expect(settledOf(result)[0]!.terminal_text).toBe("ORCHESTRATOR: which repo do you mean?\n");
  });

  test.each([
    ["no names", []],
    ["an unknown option", ["alpha", "--bogus", "1"]],
    ["a non-numeric interval", ["alpha", "--confirm-interval", "soon"]],
  ])("rejects %s", async (_label, args) => {
    const result = await runWaitCli(args as string[]);
    expect(result.code).toBe(1); expect(result.output.stage).toBe("arguments"); expect(result.calls).toEqual([]);
    expect(result.output).toMatchObject({ settled: [], running: [], timed_out: [] });
  });
});
