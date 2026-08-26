#!/usr/bin/env bun

export type HerdrDelegateMode = "run" | "launch" | "prompt";
type JsonObject = Record<string, unknown>;
type FreshMode = "run" | "launch";
type Placement = "sibling" | "tab";
type Direction = "right" | "down";
type AgentHandles = { name: string; kind: string | null; pane_id: string | null; tab_id: string | null; status: string | null };
type PromptState = { accepted: boolean | null; settled: string | null };
type FreshOptions = { name: string; kind: string; direction: Direction; cwd: string; place: Placement; tabLabel: string; startTimeoutMs: number; nativeArgs: string[] };
type DelegateCommand =
  | ({ mode: "run"; prompt: string; timeoutMs?: number; lines: number } & FreshOptions)
  | ({ mode: "launch" } & FreshOptions)
  | { mode: "prompt"; name: string; prompt: string; timeoutMs?: number; lines: number };

class HerdrDelegateError extends Error {
  constructor(readonly upstream: JsonObject) {
    super(typeof upstream.message === "string" ? upstream.message : "Herdr delegate command failed");
  }
}
class HerdrDelegateUsageError extends Error {}

const usage = "herdr-delegate run NAME PROMPT --kind KIND [options] -- [agent args...]\nherdr-delegate launch NAME --kind KIND [options] -- [agent args...]\nherdr-delegate prompt NAME PROMPT [--timeout MS] [--lines N]";
const HERDR_AGENT_START_BUSY_BACKOFF_MS = [5_000] as const;
const HERDR_DELEGATE_MAX_READ_LINES = 4_294_967_295;
const noCleanup = (reason: string): JsonObject => ({ action: "none", reason });
const emptyHandles = (name: string, kind: string | null = null): AgentHandles => ({ name, kind, pane_id: null, tab_id: null, status: null });
const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const errorCode = (error: unknown): string | null => error instanceof HerdrDelegateError && typeof error.upstream.code === "string" ? error.upstream.code : null;
const asDelegateError = (error: unknown): HerdrDelegateError => error instanceof HerdrDelegateError ? error : new HerdrDelegateError({ code: "herdr_delegate_internal_error", message: error instanceof Error ? error.message : String(error) });
const invalidResponse = (command: string): HerdrDelegateError => new HerdrDelegateError({ code: "herdr_delegate_invalid_response", message: `Invalid Herdr response for ${command}` });

function parseSafeInteger(flag: string, value: string | undefined): number {
  if (value === undefined || !/^\d+$/.test(value)) throw new HerdrDelegateUsageError(`${flag} requires a non-negative integer`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new HerdrDelegateUsageError(`${flag} requires a safe integer`);
  return parsed;
}

function splitOption(argument: string, following: string | undefined): [string, string, number] {
  const equals = argument.indexOf("=");
  if (equals >= 0) return [argument.slice(0, equals), argument.slice(equals + 1), 1];
  if (following === undefined) throw new HerdrDelegateUsageError(`${argument} requires a value`);
  return [argument, following, 2];
}

/** Parses each mode's own options and leaves fresh-agent arguments after `--` untouched. */
export function parseHerdrDelegateArguments(argv: string[], defaultCwd = process.cwd()): DelegateCommand {
  const mode = argv[0] as HerdrDelegateMode | undefined;
  if (mode !== "run" && mode !== "launch" && mode !== "prompt") throw new HerdrDelegateUsageError(`Unknown command: ${mode ?? "(missing)"}\n${usage}`);
  const positionalCount = mode === "launch" ? 1 : 2;
  const positionals = argv.slice(1, positionalCount + 1);
  if (positionals.length !== positionalCount || positionals.some((value) => value === "")) throw new HerdrDelegateUsageError(`Missing ${mode} argument\n${usage}`);
  const remainder = argv.slice(positionalCount + 1);
  const separator = remainder.indexOf("--");
  if (mode === "prompt" && separator >= 0) throw new HerdrDelegateUsageError("prompt does not accept native agent arguments");
  const options = separator < 0 ? remainder : remainder.slice(0, separator);
  const nativeArgs = separator < 0 ? [] : remainder.slice(separator + 1);
  let kind: string | undefined, direction: Direction = "right", cwd = defaultCwd, place: Placement = "sibling", tabLabel: string | undefined;
  let startTimeoutMs = 30_000, timeoutMs: number | undefined, lines = 120;
  for (let index = 0; index < options.length;) {
    const [flag, value, consumed] = splitOption(options[index]!, options[index + 1]);
    index += consumed;
    const freshOnly = ["--kind", "--direction", "--cwd", "--place", "--tab-label", "--start-timeout"].includes(flag);
    if (mode === "prompt" && freshOnly) throw new HerdrDelegateUsageError(`prompt does not accept ${flag}`);
    if (flag === "--kind") kind = value;
    else if (flag === "--direction" && (value === "right" || value === "down")) direction = value;
    else if (flag === "--cwd") cwd = value;
    else if (flag === "--place" && (value === "sibling" || value === "tab")) place = value;
    else if (flag === "--tab-label") tabLabel = value;
    else if (flag === "--start-timeout") {
      startTimeoutMs = parseSafeInteger(flag, value);
      if (startTimeoutMs < 3001 || startTimeoutMs > 300_000) throw new HerdrDelegateUsageError("--start-timeout must be between 3001 and 300000");
    } else if (flag === "--timeout" && mode !== "launch") timeoutMs = parseSafeInteger(flag, value);
    else if (flag === "--lines" && mode !== "launch") {
      lines = parseSafeInteger(flag, value);
      if (lines > HERDR_DELEGATE_MAX_READ_LINES) throw new HerdrDelegateUsageError(`--lines must be at most ${HERDR_DELEGATE_MAX_READ_LINES}`);
    }
    else throw new HerdrDelegateUsageError(`Invalid ${mode} option: ${flag}${flag === "--direction" || flag === "--place" ? `=${value}` : ""}`);
  }
  const name = positionals[0]!;
  if (mode === "prompt") return { mode, name, prompt: positionals[1]!, timeoutMs, lines };
  if (!kind) throw new HerdrDelegateUsageError(`${mode} requires --kind KIND`);
  const fresh = { name, kind, direction, cwd, place, tabLabel: tabLabel ?? name, startTimeoutMs, nativeArgs };
  return mode === "run" ? { mode, ...fresh, prompt: positionals[1]!, timeoutMs, lines } : { mode, ...fresh };
}

async function captureHerdr(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const child = Bun.spawn([process.env.HERDR_BIN_PATH ?? "herdr", ...args], { env: process.env, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    return { stdout, stderr, code };
  } catch (error) {
    throw new HerdrDelegateError({ code: "herdr_delegate_spawn_failed", message: String(error) });
  }
}

function parseHerdrFailure(stderr: string, args: string[], exitCode: number): HerdrDelegateError {
  try {
    const envelope: unknown = JSON.parse(stderr.trim());
    if (isObject(envelope) && isObject(envelope.error)) return new HerdrDelegateError(envelope.error);
  } catch {
    // Some Herdr argument failures are plain stderr rather than JSON envelopes.
  }
  return new HerdrDelegateError({
    code: "herdr_delegate_cli_error",
    message: stderr.trim() || `Herdr exited with code ${exitCode}`,
    exit_code: exitCode,
    argv: args,
  });
}

/** Calls a Herdr JSON command: success JSON is stdout; failure JSON is stderr. */
export async function callHerdrJson(args: string[]): Promise<JsonObject> {
  const result = await captureHerdr(args);
  if (result.code !== 0) throw parseHerdrFailure(result.stderr, args, result.code);
  try {
    const envelope: unknown = JSON.parse(result.stdout.trim());
    if (!isObject(envelope) || !isObject(envelope.result) || envelope.error !== undefined) throw invalidResponse(args.join(" "));
    return envelope;
  } catch (error) {
    if (error instanceof HerdrDelegateError) throw error;
    throw invalidResponse(args.join(" "));
  }
}

/** Calls `herdr agent read --format text`, whose successful stdout is raw terminal text. */
export async function callHerdrText(args: string[]): Promise<string> {
  const result = await captureHerdr(args);
  if (result.code !== 0) throw parseHerdrFailure(result.stderr, args, result.code);
  return result.stdout;
}

function resultObject(envelope: JsonObject, command: string): JsonObject {
  if (!isObject(envelope.result)) throw invalidResponse(command);
  return envelope.result;
}
function decodePane(value: unknown, command: string): { pane_id: string; tab_id: string } {
  if (!isObject(value) || typeof value.pane_id !== "string" || typeof value.tab_id !== "string") throw invalidResponse(command);
  return { pane_id: value.pane_id, tab_id: value.tab_id };
}
function decodeAgent(envelope: JsonObject, name: string, fallbackKind: string | null, command: string): AgentHandles {
  const agent = resultObject(envelope, command).agent;
  const pane = decodePane(agent, command);
  if (!isObject(agent) || typeof agent.agent_status !== "string") throw invalidResponse(command);
  if (agent.agent !== undefined && typeof agent.agent !== "string") throw invalidResponse(command);
  return { name, kind: typeof agent.agent === "string" ? agent.agent : fallbackKind, ...pane, status: agent.agent_status };
}
function decodeSplit(envelope: JsonObject): { pane_id: string; tab_id: string } {
  return decodePane(resultObject(envelope, "pane split").pane, "pane split");
}
function decodeAgentNames(envelope: JsonObject): string[] {
  const agents = resultObject(envelope, "agent list").agents;
  if (!Array.isArray(agents) || !agents.every(isObject)) throw invalidResponse("agent list");
  return agents.flatMap((agent) => typeof agent.name === "string" ? [agent.name] : []);
}
function decodeMove(envelope: JsonObject, current: AgentHandles): { changed: boolean; reason: unknown; handles: AgentHandles } {
  const move = resultObject(envelope, "pane move").move_result;
  if (!isObject(move) || typeof move.changed !== "boolean" || !isObject(move.pane)) throw invalidResponse("pane move");
  const pane = decodePane(move.pane, "pane move");
  const kind = typeof move.pane.agent === "string" ? move.pane.agent : current.kind;
  const status = typeof move.pane.agent_status === "string" ? move.pane.agent_status : current.status;
  return { changed: move.changed, reason: move.reason ?? null, handles: { name: current.name, kind, ...pane, status } };
}

function failure(mode: HerdrDelegateMode, created: boolean, stage: string, error: unknown, agent: AgentHandles, cleanup: JsonObject, extra: JsonObject = {}): JsonObject {
  return { ok: false, mode, created, stage, agent, upstream_herdr_error: asDelegateError(error).upstream, ...extra, cleanup };
}
async function closeCreatedPane(paneId: string): Promise<JsonObject> {
  try { await callHerdrJson(["pane", "close", paneId]); return { action: "pane_close", pane_id: paneId, outcome: "closed" }; }
  catch (error) { return { action: "pane_close", pane_id: paneId, outcome: "failed", upstream_herdr_error: asDelegateError(error).upstream }; }
}
async function readAgentTerminal(name: string, lines: number): Promise<string> {
  return callHerdrText(["agent", "read", name, "--source", "visible", "--lines", String(lines), "--format", "text"]);
}
async function inspectAgent(name: string, initial: AgentHandles, lines: number): Promise<{ ownership: "matching" | "missing" | "uncertain"; handles: AgentHandles; terminalText: string | null; error?: JsonObject }> {
  let handles = initial, ownership: "matching" | "missing" | "uncertain" = "uncertain", inspectionError: JsonObject | undefined;
  try { handles = decodeAgent(await callHerdrJson(["agent", "get", name]), name, initial.kind, "agent get"); ownership = "matching"; }
  catch (error) { inspectionError = asDelegateError(error).upstream; if (errorCode(error) === "agent_not_found") ownership = "missing"; }
  let terminalText: string | null = null;
  if (ownership !== "missing") try { terminalText = await readAgentTerminal(name, lines); } catch {}
  return { ownership, handles, terminalText, ...(inspectionError ? { error: inspectionError } : {}) };
}

type FreshSetup = { handles: AgentHandles; paneId: string } | { output: JsonObject };
async function startFreshHerdrAgent(command: FreshOptions, paneId: string): Promise<AgentHandles> {
  const args = ["agent", "start", command.name, "--kind", command.kind, "--pane", paneId, "--timeout", String(command.startTimeoutMs), "--", ...command.nativeArgs];
  for (const backoffMs of [...HERDR_AGENT_START_BUSY_BACKOFF_MS, null]) {
    try { return decodeAgent(await callHerdrJson(args), command.name, command.kind, "agent start"); }
    catch (error) {
      if (errorCode(error) !== "agent_pane_busy" || backoffMs === null) throw error;
      await Bun.sleep(backoffMs);
    }
  }
  throw new HerdrDelegateError({ code: "herdr_delegate_internal_error", message: "Agent start retry loop ended unexpectedly" });
}

async function prepareFreshAgent(mode: FreshMode, command: FreshOptions): Promise<FreshSetup> {
  let handles = emptyHandles(command.name, command.kind);
  try {
    if (decodeAgentNames(await callHerdrJson(["agent", "list"])).includes(command.name)) throw new HerdrDelegateError({ code: "herdr_delegate_agent_name_conflict", message: `Agent ${command.name} already exists` });
  } catch (error) { return { output: failure(mode, false, "preflight", error, handles, noCleanup("no_pane_created")) }; }
  let pane: { pane_id: string; tab_id: string };
  try { pane = decodeSplit(await callHerdrJson(["pane", "split", "--current", "--direction", command.direction, "--cwd", command.cwd, "--no-focus"])); }
  catch (error) { return { output: failure(mode, false, "split", error, handles, noCleanup("no_pane_created")) }; }
  handles = { ...handles, ...pane };
  try {
    handles = await startFreshHerdrAgent(command, pane.pane_id);
    return { handles, paneId: pane.pane_id };
  } catch (startError) {
    const inspection = await inspectAgent(command.name, handles, 120);
    if (inspection.ownership === "matching" && inspection.handles.pane_id === pane.pane_id) {
      return { output: failure(mode, true, "start", startError, inspection.handles, noCleanup("matching_agent_preserved"), inspection.terminalText === null ? {} : { terminal_text: inspection.terminalText }) };
    }
    if (inspection.ownership === "uncertain") {
      return { output: failure(mode, false, "start", startError, handles, { action: "none", reason: "ownership_uncertain", ...(inspection.error ? { confirmation_error: inspection.error } : {}) }, inspection.terminalText === null ? {} : { terminal_text: inspection.terminalText }) };
    }
    return { output: failure(mode, false, "start", startError, handles, await closeCreatedPane(pane.pane_id)) };
  }
}

async function moveFreshAgent(mode: FreshMode, command: FreshOptions, handles: AgentHandles): Promise<{ handles: AgentHandles } | { output: JsonObject }> {
  if (command.place === "sibling") return { handles };
  try {
    const moved = decodeMove(await callHerdrJson(["pane", "move", handles.pane_id!, "--new-tab", "--label", command.tabLabel, "--no-focus"]), handles);
    if (!moved.changed) {
      const error = new HerdrDelegateError({ code: "herdr_delegate_move_unchanged", message: `Herdr did not move pane: ${String(moved.reason)}`, reason: moved.reason });
      const inspection = await inspectAgent(command.name, moved.handles, 120);
      return { output: failure(mode, true, "move", error, inspection.handles, noCleanup("agent_started_preserved"), inspection.terminalText === null ? {} : { terminal_text: inspection.terminalText }) };
    }
    return { handles: moved.handles };
  } catch (error) {
    const inspection = await inspectAgent(command.name, handles, 120);
    return { output: failure(mode, true, "move", error, inspection.handles, noCleanup("agent_started_preserved"), inspection.terminalText === null ? {} : { terminal_text: inspection.terminalText }) };
  }
}

function decodePrompt(envelope: JsonObject, name: string, kind: string | null): { handles: AgentHandles; prompt: PromptState } {
  const handles = decodeAgent(envelope, name, kind, "agent prompt");
  return { handles, prompt: { accepted: true, settled: handles.status } };
}
function promptErrorState(error: unknown): PromptState {
  const code = errorCode(error);
  return code === "agent_blocked" ? { accepted: false, settled: "blocked" } : code === "timeout" || code === "agent_prompt_stalled" ? { accepted: true, settled: null } : { accepted: null, settled: null };
}
async function callPrompt(name: string, text: string, timeoutMs?: number): Promise<JsonObject> {
  const args = ["agent", "prompt", name, text, "--wait"];
  if (timeoutMs !== undefined) args.push("--timeout", String(timeoutMs));
  return callHerdrJson(args);
}

/** Runs the fresh-agent create → optional move → prompt → read pipeline. */
export async function runFreshDelegatePipeline(command: Extract<DelegateCommand, { mode: "run" }>): Promise<JsonObject> {
  const setup = await prepareFreshAgent("run", command); if ("output" in setup) return setup.output;
  const placement = await moveFreshAgent("run", command, setup.handles); if ("output" in placement) return placement.output;
  let handles = placement.handles, prompt: PromptState;
  try { ({ handles, prompt } = decodePrompt(await callPrompt(command.name, command.prompt, command.timeoutMs), command.name, command.kind)); }
  catch (error) {
    const inspected = await inspectAgent(command.name, handles, command.lines);
    return failure("run", true, "prompt", error, inspected.handles, noCleanup("agent_started_preserved"), { prompt: promptErrorState(error), ...(inspected.terminalText === null ? {} : { terminal_text: inspected.terminalText }) });
  }
  let terminalText: string;
  try { terminalText = await readAgentTerminal(command.name, command.lines); }
  catch (error) { return failure("run", true, "read", error, handles, noCleanup("agent_started_preserved"), { prompt }); }
  if (prompt.settled === "blocked") return failure("run", true, "prompt", new HerdrDelegateError({ code: "herdr_delegate_agent_blocked", message: `Agent ${command.name} settled blocked` }), handles, noCleanup("agent_started_preserved"), { prompt, terminal_text: terminalText });
  return { ok: true, mode: "run", created: true, agent: handles, prompt, terminal_text: terminalText };
}

/** Runs the fresh-agent create → optional move pipeline without prompting. */
export async function launchFreshDelegatePipeline(command: Extract<DelegateCommand, { mode: "launch" }>): Promise<JsonObject> {
  const setup = await prepareFreshAgent("launch", command); if ("output" in setup) return setup.output;
  const placement = await moveFreshAgent("launch", command, setup.handles); if ("output" in placement) return placement.output;
  return { ok: true, mode: "launch", created: true, agent: placement.handles };
}

/** Runs the existing-agent preflight → prompt → read pipeline without claiming fresh creation. */
export async function promptExistingDelegatePipeline(command: Extract<DelegateCommand, { mode: "prompt" }>): Promise<JsonObject> {
  let handles = emptyHandles(command.name), prompt: PromptState;
  try { handles = decodeAgent(await callHerdrJson(["agent", "get", command.name]), command.name, null, "agent get"); }
  catch (error) { return failure("prompt", false, "preflight", error, handles, noCleanup("existing_agent_not_found")); }
  if (handles.status !== "idle" && handles.status !== "done") {
    return failure("prompt", false, "preflight", new HerdrDelegateError({ code: "herdr_delegate_agent_not_idle", message: `Agent ${command.name} is ${handles.status ?? "unknown"}; prompt requires idle or done` }), handles, noCleanup("existing_agent_preserved"));
  }
  try { ({ handles, prompt } = decodePrompt(await callPrompt(command.name, command.prompt, command.timeoutMs), command.name, handles.kind)); }
  catch (error) {
    if (errorCode(error) === "agent_not_found") return failure("prompt", false, "prompt", error, handles, noCleanup("existing_agent_not_found"), { prompt: promptErrorState(error) });
    const inspected = await inspectAgent(command.name, handles, command.lines);
    const cleanup = inspected.ownership === "matching" ? noCleanup("existing_agent_preserved") : noCleanup(inspected.ownership === "missing" ? "existing_agent_not_found" : "existing_agent_ownership_uncertain");
    return failure("prompt", false, "prompt", error, inspected.handles, cleanup, { prompt: promptErrorState(error), ...(inspected.terminalText === null ? {} : { terminal_text: inspected.terminalText }) });
  }
  let terminalText: string;
  try { terminalText = await readAgentTerminal(command.name, command.lines); }
  catch (error) { return failure("prompt", false, "read", error, handles, noCleanup("existing_agent_preserved"), { prompt }); }
  if (prompt.settled === "blocked") return failure("prompt", false, "prompt", new HerdrDelegateError({ code: "herdr_delegate_agent_blocked", message: `Agent ${command.name} settled blocked` }), handles, noCleanup("existing_agent_preserved"), { prompt, terminal_text: terminalText });
  return { ok: true, mode: "prompt", created: false, agent: handles, prompt, terminal_text: terminalText };
}

/** Emits one public JSON envelope and returns its process exit code. */
export async function herdrDelegateMain(argv = process.argv.slice(2)): Promise<number> {
  let output: JsonObject;
  if (process.env.HERDR_ENV !== "1") output = { ok: false, mode: argv[0] ?? null, created: false, stage: "environment", upstream_herdr_error: { code: "herdr_delegate_environment_required", message: "HERDR_ENV=1 is required" }, cleanup: noCleanup("no_pane_created") };
  else try {
    const command = parseHerdrDelegateArguments(argv);
    output = command.mode === "run" ? await runFreshDelegatePipeline(command) : command.mode === "launch" ? await launchFreshDelegatePipeline(command) : await promptExistingDelegatePipeline(command);
  } catch (error) {
    output = { ok: false, mode: argv[0] ?? null, created: false, stage: "arguments", upstream_herdr_error: { code: "herdr_delegate_usage_error", message: error instanceof Error ? error.message : String(error) }, cleanup: noCleanup("no_pane_created") };
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
  return output.ok === true ? 0 : 1;
}

if (import.meta.main) process.exitCode = await herdrDelegateMain();
