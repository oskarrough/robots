import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const cliPath = join(import.meta.dir, "herdr-delegate.ts");
const fakeHerdr = `#!/usr/bin/env bun
import { appendFile, readFile } from "node:fs/promises";
const argv = process.argv.slice(2), command = argv.slice(0, 2).join(" "), scenario = process.env.FAKE_HERDR_SCENARIO ?? "success";
await appendFile(process.env.FAKE_HERDR_RECORD!, JSON.stringify(argv) + "\\n");
const name = argv[2] ?? "worker";
const pane = (pane_id = "pane-created", tab_id = "tab-origin") => ({ pane_id, tab_id });
const agent = (pane_id = "pane-created", tab_id = "tab-origin") => ({ name, agent: "pi", ...pane(pane_id, tab_id), agent_status: scenario === "working-target" ? "working" : "done" });
function ok(result) { process.stdout.write(JSON.stringify({ id: "fake", result }) + "\\n"); process.exit(0); }
function fail(code, message = code) { process.stderr.write(JSON.stringify({ id: "fake", error: { code, message } }) + "\\n"); process.exit(1); }
function failPlain(message) { process.stderr.write(message + "\\n"); process.exit(2); }
if (command === "agent list") ok({ agents: [] });
if (command === "pane split") {
  if (scenario === "invalid-split") ok({ pane: { id: "wrong" } });
  ok({ pane: pane() });
}
if (command === "agent start") {
  if (scenario === "busy-start-once") {
    const calls = (await readFile(process.env.FAKE_HERDR_RECORD!, "utf8")).trim().split("\\n").map((line) => JSON.parse(line));
    if (calls.filter((call) => call[0] === "agent" && call[1] === "start").length === 1) fail("agent_pane_busy");
  }
  if (scenario === "ambiguous-start") fail("agent_not_ready", "blocked during startup");
  if (scenario === "definite-start-failure") fail("agent_start_failed");
  if (scenario === "plain-start-failure") failPlain("error: invalid value for --kind");
  ok({ agent: agent() });
}
if (command === "pane move") {
  if (scenario === "move-unchanged") ok({ move_result: { changed: false, reason: "zoomed_tab", pane: pane() } });
  ok({ move_result: { changed: true, reason: null, pane: pane("pane-moved", "tab-new") } });
}
if (command === "agent prompt") {
  if (scenario === "prompt-not-found") fail("agent_not_found");
  if (scenario === "prompt-timeout") fail("timeout", "prompt timed out");
  ok({ agent: agent() });
}
if (command === "agent get") {
  if (scenario === "definite-start-failure" || scenario === "plain-start-failure") fail("agent_not_found");
  ok({ agent: agent() });
}
if (command === "agent read") { process.stdout.write("raw terminal\\nnot json {still raw}\\n"); process.exit(0); }
if (command === "pane close") ok({ closed: true });
fail("unexpected_fake_command", command);
`;

type CliResult = { code: number; output: Record<string, unknown>; calls: string[][]; stderr: string };
let directory: string, fakePath: string, recordPath: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "herdr-delegate-"));
  fakePath = join(directory, "fake-herdr.ts"); recordPath = join(directory, "calls.jsonl");
  await writeFile(fakePath, fakeHerdr); await writeFile(recordPath, ""); await chmod(fakePath, 0o755);
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

async function runCli(args: string[], scenario = "success"): Promise<CliResult> {
  const child = Bun.spawn([process.execPath, cliPath, ...args], {
    env: { ...process.env, HERDR_ENV: "1", HERDR_BIN_PATH: fakePath, FAKE_HERDR_RECORD: recordPath, FAKE_HERDR_SCENARIO: scenario }, stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  const records = (await readFile(recordPath, "utf8")).trim();
  return { code, output: JSON.parse(stdout), calls: records ? records.split("\n").map((line) => JSON.parse(line)) : [], stderr };
}
const commands = (result: CliResult) => result.calls.map((call) => call.slice(0, 2).join(" "));

function agentOf(result: CliResult): Record<string, unknown> { return result.output.agent as Record<string, unknown>; }
function cleanupOf(result: CliResult): Record<string, unknown> { return result.output.cleanup as Record<string, unknown>; }
function upstreamOf(result: CliResult): Record<string, unknown> { return result.output.upstream_herdr_error as Record<string, unknown>; }

describe("herdr-delegate", () => {
  test("run maps options, exact agent paths, and raw text stdout", async () => {
    const result = await runCli(["run", "builder", "Do work", "--kind", "pi", "--direction", "down", "--cwd", "/repo path", "--start-timeout", "4567", "--timeout", "0", "--lines", "42", "--", "--model", "model x"]);
    expect(result.code).toBe(0); expect(result.stderr).toBe("");
    expect(result.calls).toEqual([
      ["agent", "list"],
      ["pane", "split", "--current", "--direction", "down", "--cwd", "/repo path", "--no-focus"],
      ["agent", "start", "builder", "--kind", "pi", "--pane", "pane-created", "--timeout", "4567", "--", "--model", "model x"],
      ["agent", "prompt", "builder", "Do work", "--wait", "--timeout", "0"],
      ["agent", "read", "builder", "--source", "visible", "--lines", "42", "--format", "text"],
    ]);
    expect(result.output).toEqual({ ok: true, mode: "run", created: true, agent: { name: "builder", kind: "pi", pane_id: "pane-created", tab_id: "tab-origin", status: "done" }, prompt: { accepted: true, settled: "done" }, terminal_text: "raw terminal\nnot json {still raw}\n" });
  });

  test("launch maps move_result.pane handles", async () => {
    const result = await runCli(["launch", "warm", "--kind", "pi", "--place", "tab", "--tab-label", "Crew"], "move-success");
    expect(result.code).toBe(0); expect(commands(result)).toEqual(["agent list", "pane split", "agent start", "pane move"]);
    expect(result.calls[3]).toEqual(["pane", "move", "pane-created", "--new-tab", "--label", "Crew", "--no-focus"]);
    expect(agentOf(result)).toEqual({ name: "warm", kind: "pi", pane_id: "pane-moved", tab_id: "tab-new", status: "done" });
  });

  test("existing prompt maps prompt agent and never creates", async () => {
    const result = await runCli(["prompt", "warm", "Continue", "--lines", "9"]);
    expect(result.code).toBe(0); expect(commands(result)).toEqual(["agent get", "agent prompt", "agent read"]);
    expect(result.output.created).toBe(false); expect(agentOf(result).pane_id).toBe("pane-created");
    expect(result.output.terminal_text).toBe("raw terminal\nnot json {still raw}\n");
  });

  test("exit-zero changed false is a preserved move failure with its reason", async () => {
    const result = await runCli(["launch", "kept", "--kind", "pi", "--place", "tab"], "move-unchanged");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("move"); expect(result.output.created).toBe(true);
    expect(upstreamOf(result)).toMatchObject({ code: "herdr_delegate_move_unchanged", reason: "zoomed_tab" });
    expect(cleanupOf(result)).toEqual({ action: "none", reason: "agent_started_preserved" });
    expect(commands(result)).toEqual(["agent list", "pane split", "agent start", "pane move", "agent get", "agent read"]);
    expect(result.calls.some((call) => call[1] === "close")).toBe(false);
  });

  test("new pane startup retries only the transient agent_pane_busy race", async () => {
    const result = await runCli(["launch", "racer", "--kind", "pi"], "busy-start-once");
    expect(result.code).toBe(0);
    expect(commands(result)).toEqual(["agent list", "pane split", "agent start", "agent start"]);
  }, 7_000);

  test("ambiguous start resolving to the new pane preserves the registered agent", async () => {
    const result = await runCli(["launch", "blocked", "--kind", "pi"], "ambiguous-start");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("start"); expect(result.output.created).toBe(true);
    expect(upstreamOf(result).code).toBe("agent_not_ready");
    expect(cleanupOf(result)).toEqual({ action: "none", reason: "matching_agent_preserved" });
    expect(commands(result)).toEqual(["agent list", "pane split", "agent start", "agent get", "agent read"]);
    expect(result.output.terminal_text).toBe("raw terminal\nnot json {still raw}\n");
  });

  test("definite start failure plus agent_not_found closes only the new pane", async () => {
    const result = await runCli(["launch", "broken", "--kind", "pi"], "definite-start-failure");
    expect(result.code).toBe(1); expect(result.output.created).toBe(false); expect(result.output.stage).toBe("start");
    expect(commands(result)).toEqual(["agent list", "pane split", "agent start", "agent get", "pane close"]);
    expect(cleanupOf(result)).toEqual({ action: "pane_close", pane_id: "pane-created", outcome: "closed" });
  });

  test("prompt agent_not_found does not claim preservation", async () => {
    const result = await runCli(["prompt", "gone", "Continue"], "prompt-not-found");
    expect(result.code).toBe(1); expect(result.output.created).toBe(false); expect(agentOf(result).pane_id).toBe("pane-created");
    expect(cleanupOf(result)).toEqual({ action: "none", reason: "existing_agent_not_found" });
    expect(commands(result)).toEqual(["agent get", "agent prompt"]);
  });

  test("timeout uses stderr error JSON and preserves a confirmed existing target", async () => {
    const result = await runCli(["prompt", "slow", "Wait", "--timeout", "10"], "prompt-timeout");
    expect(result.code).toBe(1); expect(upstreamOf(result)).toEqual({ code: "timeout", message: "prompt timed out" });
    expect(cleanupOf(result)).toEqual({ action: "none", reason: "existing_agent_preserved" });
    expect(commands(result)).toEqual(["agent get", "agent prompt", "agent get", "agent read"]);
  });

  test("existing prompt rejects a working target before sending text", async () => {
    const result = await runCli(["prompt", "busy", "Do not queue"], "working-target");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("preflight");
    expect(upstreamOf(result).code).toBe("herdr_delegate_agent_not_idle");
    expect(commands(result)).toEqual(["agent get"]);
  });

  test("plain stderr failures retain their message and exit code", async () => {
    const result = await runCli(["launch", "bad-kind", "--kind", "bogus"], "plain-start-failure");
    expect(result.code).toBe(1);
    expect(upstreamOf(result)).toMatchObject({ code: "herdr_delegate_cli_error", message: "error: invalid value for --kind", exit_code: 2 });
  });

  test("invalid exact response path has one response error", async () => {
    const result = await runCli(["launch", "bad", "--kind", "pi"], "invalid-split");
    expect(result.code).toBe(1); expect(result.output.stage).toBe("split");
    expect(upstreamOf(result).code).toBe("herdr_delegate_invalid_response");
    expect(commands(result)).toEqual(["agent list", "pane split"]);
  });

  test.each(["--kind", "--direction", "--cwd", "--place", "--tab-label", "--start-timeout"])("prompt rejects fresh-only %s", async (flag) => {
    const result = await runCli(["prompt", "warm", "Go", flag, flag === "--start-timeout" ? "5000" : "x"]);
    expect(result.code).toBe(1); expect(result.output.stage).toBe("arguments"); expect(result.calls).toEqual([]);
  });

  test.each([
    ["launch", "--timeout", "1"], ["launch", "--lines", "1"],
    ["run", "--start-timeout", "3000"], ["run", "--start-timeout", "300001"],
    ["prompt", "--timeout", "9007199254740992"], ["prompt", "--lines", "1.5"],
    ["prompt", "--lines", "4294967296"],
  ])("rejects invalid mode or integer option: %s %s", async (mode, flag, value) => {
    const args = mode === "launch" ? [mode, "x", "--kind", "pi", flag, value] : mode === "run" ? [mode, "x", "Go", "--kind", "pi", flag, value] : [mode, "x", "Go", flag, value];
    const result = await runCli(args); expect(result.code).toBe(1); expect(result.output.stage).toBe("arguments"); expect(result.calls).toEqual([]);
  });
});
