#!/usr/bin/env bun

type JsonObject = Record<string, unknown>;
type Direction = "right" | "down";
type AgentHandles = { name: string; kind: string | null; pane_id: string | null; tab_id: string | null; workspace_id: string | null; status: string | null };
type RuntimeValues = { provider: string | null; model: string | null; reasoning_level: string | null };
type ResolvedRuntimeValues = RuntimeValues & { subscription_billed: boolean | null };
type RuntimeState = { requested: RuntimeValues; resolved: ResolvedRuntimeValues; verified: boolean; matches_requested: boolean | null };
type PromptState = { accepted: boolean | null; settled: string | null };
type FreshOptions = { name: string; kind: string; direction: Direction; cwd: string; tab: string | null; workspace: string | null; startTimeoutMs: number; nativeArgs: string[] };
type DelegateCommand = FreshOptions & { prompt: string; timeoutMs?: number; lines: number };

class HerdrDelegateError extends Error {
  constructor(readonly upstream: JsonObject) {
    super(typeof upstream.message === "string" ? upstream.message : "Herdr delegate command failed");
  }
}
class HerdrDelegateUsageError extends Error {}

const usage = "herdr-delegate NAME PROMPT --kind KIND [options] -- [agent args...]";
const HERDR_AGENT_START_BUSY_BACKOFF_MS = [5_000] as const;
const HERDR_DELEGATE_MAX_READ_LINES = 4_294_967_295;
const noCleanup = (reason: string): JsonObject => ({ action: "none", reason });
const emptyHandles = (name: string, kind: string | null = null): AgentHandles => ({ name, kind, pane_id: null, tab_id: null, workspace_id: null, status: null });
const emptyRuntimeValues = (): RuntimeValues => ({ provider: null, model: null, reasoning_level: null });
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

/** Parses delegate options and leaves native agent arguments after `--` untouched. */
export function parseHerdrDelegateArguments(argv: string[], defaultCwd = process.cwd()): DelegateCommand {
  const positionals = argv.slice(0, 2);
  if (positionals.length !== 2 || positionals.some((value) => value === "")) throw new HerdrDelegateUsageError(`Missing NAME or PROMPT\n${usage}`);
  const remainder = argv.slice(2), separator = remainder.indexOf("--");
  const options = separator < 0 ? remainder : remainder.slice(0, separator);
  const nativeArgs = separator < 0 ? [] : remainder.slice(separator + 1);
  let kind: string | undefined, direction: Direction = "right", cwd = defaultCwd, tab: string | null = null, workspace: string | null = null;
  let startTimeoutMs = 30_000, timeoutMs: number | undefined, lines = 120;
  for (let index = 0; index < options.length;) {
    const [flag, value, consumed] = splitOption(options[index]!, options[index + 1]);
    index += consumed;
    if (flag === "--kind") kind = value;
    else if (flag === "--direction" && (value === "right" || value === "down")) direction = value;
    else if (flag === "--cwd") cwd = value;
    else if (flag === "--tab") tab = value;
    else if (flag === "--workspace") workspace = value;
    else if (flag === "--start-timeout") {
      startTimeoutMs = parseSafeInteger(flag, value);
      if (startTimeoutMs < 3001 || startTimeoutMs > 300_000) throw new HerdrDelegateUsageError("--start-timeout must be between 3001 and 300000");
    } else if (flag === "--timeout") timeoutMs = parseSafeInteger(flag, value);
    else if (flag === "--lines") {
      lines = parseSafeInteger(flag, value);
      if (lines > HERDR_DELEGATE_MAX_READ_LINES) throw new HerdrDelegateUsageError(`--lines must be at most ${HERDR_DELEGATE_MAX_READ_LINES}`);
    } else throw new HerdrDelegateUsageError(`Invalid option: ${flag}${flag === "--direction" ? `=${value}` : ""}`);
  }
  if (!kind) throw new HerdrDelegateUsageError("--kind KIND is required");
  if (tab !== null && workspace !== null) throw new HerdrDelegateUsageError("--tab and --workspace are mutually exclusive");
  return { name: positionals[0]!, prompt: positionals[1]!, kind, direction, cwd, tab, workspace, startTimeoutMs, timeoutMs, lines, nativeArgs };
}

const activeHerdrChildren = new Set<{ kill: () => void }>();
/** Kills every Herdr call still in flight, so an early `--any` resolve does not outlive its waits. */
function stopActiveHerdrChildren(): void {
  for (const child of activeHerdrChildren) try { child.kill(); } catch {}
}

async function captureHerdr(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const child = Bun.spawn([process.env.HERDR_BIN_PATH ?? "herdr", ...args], { env: process.env, stdout: "pipe", stderr: "pipe" });
    activeHerdrChildren.add(child);
    try {
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      return { stdout, stderr, code };
    } finally { activeHerdrChildren.delete(child); }
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
function decodePane(value: unknown, command: string): { pane_id: string; tab_id: string; workspace_id: string | null } {
  if (!isObject(value) || typeof value.pane_id !== "string" || typeof value.tab_id !== "string") throw invalidResponse(command);
  const workspaceId = typeof value.workspace_id === "string" ? value.workspace_id : value.pane_id.includes(":") ? value.pane_id.slice(0, value.pane_id.indexOf(":")) : null;
  return { pane_id: value.pane_id, tab_id: value.tab_id, workspace_id: workspaceId };
}
function decodeAgentValue(envelope: JsonObject, command: string): JsonObject {
  const agent = resultObject(envelope, command).agent;
  if (!isObject(agent)) throw invalidResponse(command);
  return agent;
}
function decodeAgent(envelope: JsonObject, name: string, fallbackKind: string | null, command: string): AgentHandles {
  const agent = decodeAgentValue(envelope, command);
  const pane = decodePane(agent, command);
  if (typeof agent.agent_status !== "string") throw invalidResponse(command);
  if (agent.agent !== undefined && typeof agent.agent !== "string") throw invalidResponse(command);
  return { name, kind: typeof agent.agent === "string" ? agent.agent : fallbackKind, ...pane, status: agent.agent_status };
}
function decodeSessionRef(envelope: JsonObject): { kind: string; value: string } | null {
  const session = decodeAgentValue(envelope, "agent get").agent_session;
  return isObject(session) && typeof session.kind === "string" && typeof session.value === "string" ? { kind: session.kind, value: session.value } : null;
}
function decodeSplit(envelope: JsonObject): { pane_id: string; tab_id: string; workspace_id: string | null } {
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

function failure(created: boolean, stage: string, error: unknown, agent: AgentHandles, cleanup: JsonObject, extra: JsonObject = {}): JsonObject {
  return { ok: false, created, stage, agent, upstream_herdr_error: asDelegateError(error).upstream, ...extra, cleanup };
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

type FreshSetup = { handles: AgentHandles; destinationTab: string | null } | { output: JsonObject };
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

async function resolveDestinationTab(command: FreshOptions): Promise<string | null> {
  if (command.tab !== null) return command.tab;
  if (command.workspace === null) return null;
  const workspaces = resultObject(await callHerdrJson(["workspace", "list"]), "workspace list").workspaces;
  if (!Array.isArray(workspaces) || !workspaces.every(isObject)) throw invalidResponse("workspace list");
  const byId = workspaces.filter((workspace) => workspace.workspace_id === command.workspace);
  const matches = byId.length > 0 ? byId : workspaces.filter((workspace) => workspace.label === command.workspace);
  if (matches.length === 0) throw new HerdrDelegateError({ code: "herdr_delegate_workspace_not_found", message: `Workspace ${command.workspace} not found` });
  if (matches.length > 1) throw new HerdrDelegateError({ code: "herdr_delegate_workspace_ambiguous", message: `Workspace label ${command.workspace} is ambiguous`, workspace_ids: matches.map((workspace) => workspace.workspace_id) });
  const activeTabId = matches[0]!.active_tab_id;
  if (typeof activeTabId !== "string") throw invalidResponse("workspace list");
  return activeTabId;
}

async function prepareFreshAgent(command: FreshOptions): Promise<FreshSetup> {
  let handles = emptyHandles(command.name, command.kind), destinationTab: string | null;
  try {
    destinationTab = await resolveDestinationTab(command);
    if (decodeAgentNames(await callHerdrJson(["agent", "list"])).includes(command.name)) throw new HerdrDelegateError({ code: "herdr_delegate_agent_name_conflict", message: `Agent ${command.name} already exists` });
  } catch (error) { return { output: failure(false, "preflight", error, handles, noCleanup("no_pane_created")) }; }
  let pane: { pane_id: string; tab_id: string; workspace_id: string | null };
  try { pane = decodeSplit(await callHerdrJson(["pane", "split", "--current", "--direction", command.direction, "--cwd", command.cwd, "--no-focus"])); }
  catch (error) { return { output: failure(false, "split", error, handles, noCleanup("no_pane_created")) }; }
  handles = { ...handles, ...pane };
  try {
    handles = await startFreshHerdrAgent(command, pane.pane_id);
    return { handles, destinationTab };
  } catch (startError) {
    const inspection = await inspectAgent(command.name, handles, 120);
    if (inspection.ownership === "matching" && inspection.handles.pane_id === pane.pane_id) {
      return { output: failure(true, "start", startError, inspection.handles, noCleanup("matching_agent_preserved"), inspection.terminalText === null ? {} : { terminal_text: inspection.terminalText }) };
    }
    if (inspection.ownership === "uncertain") {
      return { output: failure(false, "start", startError, handles, { action: "none", reason: "ownership_uncertain", ...(inspection.error ? { confirmation_error: inspection.error } : {}) }, inspection.terminalText === null ? {} : { terminal_text: inspection.terminalText }) };
    }
    return { output: failure(false, "start", startError, handles, await closeCreatedPane(pane.pane_id)) };
  }
}

const PI_REASONING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
function requestedRuntime(nativeArgs: string[]): RuntimeValues {
  let provider: string | null = null, modelArgument: string | null = null, reasoningLevel: string | null = null;
  for (let index = 0; index < nativeArgs.length; index++) {
    const argument = nativeArgs[index]!;
    const equals = argument.indexOf("="), flag = equals < 0 ? argument : argument.slice(0, equals);
    if (flag !== "--provider" && flag !== "--model" && flag !== "--thinking" && flag !== "--effort") continue;
    const value = equals < 0 ? nativeArgs[++index] ?? null : argument.slice(equals + 1);
    if (flag === "--provider") provider = value;
    else if (flag === "--model") modelArgument = value;
    else reasoningLevel = value;
  }
  let model = modelArgument;
  if (model !== null) {
    // An explicit --provider wins; only then a slash prefix is part of the model ID (openrouter's google/gemini-*).
    const slash = model.indexOf("/");
    if (provider === null && slash > 0) { provider = model.slice(0, slash); model = model.slice(slash + 1); }
    const colon = model.lastIndexOf(":");
    if (colon > 0 && PI_REASONING_LEVELS.has(model.slice(colon + 1))) {
      if (reasoningLevel === null) reasoningLevel = model.slice(colon + 1);
      model = model.slice(0, colon);
    }
  }
  return { provider, model, reasoning_level: reasoningLevel };
}
async function readResolvedPiRuntime(sessionPath: string): Promise<RuntimeValues> {
  const resolved = emptyRuntimeValues();
  try {
    const text = await Bun.file(sessionPath).text();
    for (const line of text.split("\n")) {
      if (!line) continue;
      let event: unknown;
      try { event = JSON.parse(line); } catch { continue; }
      if (!isObject(event)) continue;
      if (event.type === "model_change" && typeof event.provider === "string" && typeof event.modelId === "string") {
        resolved.provider = event.provider; resolved.model = event.modelId;
      } else if (event.type === "thinking_level_change" && typeof event.thinkingLevel === "string") resolved.reasoning_level = event.thinkingLevel;
    }
  } catch {}
  return resolved;
}
async function readResolvedClaudeRuntime(cwd: string, sessionId: string): Promise<RuntimeValues> {
  const resolved = emptyRuntimeValues(), home = process.env.HOME;
  if (!home) return resolved;
  try {
    const text = await Bun.file(`${home}/.claude/projects/${cwd.replace(/[^A-Za-z0-9-]/g, "-")}/${sessionId}.jsonl`).text();
    for (const line of text.split("\n")) {
      if (!line) continue;
      let event: unknown;
      try { event = JSON.parse(line); } catch { continue; }
      if (isObject(event) && event.type === "assistant" && isObject(event.message) && typeof event.message.model === "string") {
        resolved.provider = "anthropic"; resolved.model = event.message.model;
      }
    }
  } catch {}
  return resolved;
}
// A claude --model value is an alias ("fable"), so a resolved ID that contains it counts as a match.
const modelSatisfies = (requested: string, resolved: string): boolean => resolved === requested || resolved.includes(requested);
function requestedValuesMatch(requested: RuntimeValues, resolved: ResolvedRuntimeValues): boolean | null {
  const comparisons: boolean[] = [];
  if (requested.provider !== null && resolved.provider !== null) comparisons.push(resolved.provider === requested.provider);
  if (requested.model !== null && resolved.model !== null) comparisons.push(modelSatisfies(requested.model, resolved.model));
  if (requested.reasoning_level !== null && resolved.reasoning_level !== null) comparisons.push(resolved.reasoning_level === requested.reasoning_level);
  return comparisons.length === 0 ? null : comparisons.every(Boolean);
}
async function inspectRuntimeOnce(command: FreshOptions, handles: AgentHandles): Promise<{ handles: AgentHandles; values: RuntimeValues }> {
  let inspectedHandles = handles, session: { kind: string; value: string } | null = null;
  try {
    const envelope = await callHerdrJson(["agent", "get", command.name]);
    inspectedHandles = decodeAgent(envelope, command.name, command.kind, "agent get");
    session = decodeSessionRef(envelope);
  } catch {}
  let values = emptyRuntimeValues();
  if (session !== null && command.kind === "pi" && session.kind === "path") values = await readResolvedPiRuntime(session.value);
  else if (session !== null && command.kind === "claude" && session.kind === "id") values = await readResolvedClaudeRuntime(command.cwd, session.value);
  return { handles: inspectedHandles, values };
}
function runtimeState(kind: string, requested: RuntimeValues, values: RuntimeValues): RuntimeState {
  const subscriptionBilled = values.provider === "openai-codex" ? true : values.provider === "openai" || values.provider === "openrouter" || values.provider === "vercel-ai-gateway" ? false : null;
  const resolved = { ...values, subscription_billed: subscriptionBilled };
  const verified = resolved.provider !== null && resolved.model !== null && (kind !== "pi" || resolved.reasoning_level !== null);
  return { requested, resolved, verified, matches_requested: requestedValuesMatch(requested, resolved) };
}
// Herdr registers agent_session asynchronously after start, so an immediate read can miss it.
const RUNTIME_VERIFY_BACKOFF_MS = [500, 1_000, 2_000] as const;
async function inspectFreshRuntime(command: FreshOptions, handles: AgentHandles): Promise<{ handles: AgentHandles; runtime: RuntimeState }> {
  const requested = requestedRuntime(command.nativeArgs);
  if (command.kind !== "pi") return { handles, runtime: runtimeState(command.kind, requested, emptyRuntimeValues()) };
  let inspection = await inspectRuntimeOnce(command, handles);
  for (const backoffMs of RUNTIME_VERIFY_BACKOFF_MS) {
    if (runtimeState("pi", requested, inspection.values).verified) break;
    await Bun.sleep(backoffMs);
    inspection = await inspectRuntimeOnce(command, handles);
  }
  return { handles: inspection.handles, runtime: runtimeState("pi", requested, inspection.values) };
}
function runtimeMismatch(handles: AgentHandles, runtime: RuntimeState): JsonObject | null {
  if (runtime.matches_requested !== false) return null;
  const error = new HerdrDelegateError({ code: "herdr_delegate_runtime_mismatch", message: "Resolved Pi runtime does not match the requested runtime", requested: runtime.requested, resolved: runtime.resolved });
  return failure(true, "verify", error, handles, noCleanup("matching_agent_preserved"), { runtime });
}

async function moveFreshAgent(command: FreshOptions, destinationTab: string | null, handles: AgentHandles, runtime: RuntimeState): Promise<{ handles: AgentHandles } | { output: JsonObject }> {
  if (destinationTab === null) return { handles };
  try {
    const moved = decodeMove(await callHerdrJson(["pane", "move", handles.pane_id!, "--tab", destinationTab, "--split", command.direction, "--no-focus"]), handles);
    if (!moved.changed) {
      const error = new HerdrDelegateError({ code: "herdr_delegate_move_unchanged", message: `Herdr did not move pane: ${String(moved.reason)}`, reason: moved.reason });
      const inspection = await inspectAgent(command.name, moved.handles, 120);
      return { output: failure(true, "move", error, inspection.handles, noCleanup("agent_started_preserved"), { runtime, ...(inspection.terminalText === null ? {} : { terminal_text: inspection.terminalText }) }) };
    }
    return { handles: moved.handles };
  } catch (error) {
    const inspection = await inspectAgent(command.name, handles, 120);
    return { output: failure(true, "move", error, inspection.handles, noCleanup("agent_started_preserved"), { runtime, ...(inspection.terminalText === null ? {} : { terminal_text: inspection.terminalText }) }) };
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

export const WORKER_CONTRACTS = "To ask the orchestrator anything or report a blocker: stop, print one final line starting with `ORCHESTRATOR: <question or blocker>`, and end your turn. Your settled pane is the message. Do not look for another channel or work around the question.\n\nEnd with a written report, not a tool call or silence. If you did nothing, say why. An empty final turn is not a result.";

/** Runs the fresh-agent create → verify → optional move → prompt → read pipeline. */
export async function runFreshDelegatePipeline(command: DelegateCommand): Promise<JsonObject> {
  const setup = await prepareFreshAgent(command); if ("output" in setup) return setup.output;
  const inspection = await inspectFreshRuntime(command, setup.handles), mismatch = runtimeMismatch(inspection.handles, inspection.runtime); if (mismatch) return mismatch;
  const placement = await moveFreshAgent(command, setup.destinationTab, inspection.handles, inspection.runtime); if ("output" in placement) return placement.output;
  let handles = placement.handles, prompt: PromptState;
  try { ({ handles, prompt } = decodePrompt(await callPrompt(command.name, `${command.prompt}\n\n${WORKER_CONTRACTS}`, command.timeoutMs), command.name, command.kind)); }
  catch (error) {
    const inspected = await inspectAgent(command.name, handles, command.lines);
    return failure(true, "prompt", error, inspected.handles, noCleanup("agent_started_preserved"), { runtime: inspection.runtime, prompt: promptErrorState(error), ...(inspected.terminalText === null ? {} : { terminal_text: inspected.terminalText }) });
  }
  let terminalText: string;
  try { terminalText = await readAgentTerminal(command.name, command.lines); }
  catch (error) { return failure(true, "read", error, handles, noCleanup("agent_started_preserved"), { runtime: inspection.runtime, prompt }); }
  // A claude session file (and occasionally a slow pi session) only carries the runtime after the first reply.
  let runtime = inspection.runtime;
  if (!runtime.verified && (command.kind === "pi" || command.kind === "claude")) {
    const late = await inspectRuntimeOnce(command, handles);
    if (late.values.model !== null) runtime = runtimeState(command.kind, runtime.requested, late.values);
    if (runtime.matches_requested === false) {
      const error = new HerdrDelegateError({ code: "herdr_delegate_runtime_mismatch", message: "Resolved runtime does not match the requested runtime", requested: runtime.requested, resolved: runtime.resolved });
      return failure(true, "verify", error, handles, noCleanup("matching_agent_preserved"), { runtime, prompt, terminal_text: terminalText });
    }
  }
  if (prompt.settled === "blocked") return failure(true, "prompt", new HerdrDelegateError({ code: "herdr_delegate_agent_blocked", message: `Agent ${command.name} settled blocked` }), handles, noCleanup("agent_started_preserved"), { runtime, prompt, terminal_text: terminalText });
  return { ok: true, created: true, agent: handles, runtime, prompt, terminal_text: terminalText };
}

type WaitMode = "any" | "all";
type WaitCommand = { names: string[]; timeoutMs?: number; lines: number; confirmIntervalMs: number; mode: WaitMode };
type WaitClassification = "never_ran" | "blocked" | "report";
type SettledAgent = { name: string; status: string | null; classification: WaitClassification; terminal_text: string };
type WatchOutcome = { kind: "settled"; settled: SettledAgent } | { kind: "timed_out" } | { kind: "running" };
type Observation = { status: string | null; text: string };
type Cancellation = { cancelled: boolean; cancel: () => void; sleep: (ms: number) => Promise<void> };

const waitUsage = "herdr-delegate wait NAME [NAME...] [--timeout MS] [--lines N] [--confirm-interval MS] [--any|--all]";
const HERDR_DELEGATE_SETTLED_STATUSES = new Set(["idle", "done", "blocked"]);
const HERDR_DELEGATE_CONFIRM_INTERVAL_MS = 20_000;
const HERDR_DELEGATE_REARM_PAUSE_MS = 1_000;
/** A pane still painting one of these is working, whatever lifecycle status Herdr reports. */
const HERDR_DELEGATE_ACTIVITY_MARKERS = [/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/, /Working\.\.\./, /esc to interrupt/, /^\s*[✻*●]?\s*[A-Z][a-z]+… \(/m, /\d+ shell/, /new message/];

/** Parses the wait subcommand: agent names first, then options. */
export function parseHerdrWaitArguments(argv: string[]): WaitCommand {
  const names: string[] = [];
  let index = 0;
  while (index < argv.length && !argv[index]!.startsWith("--")) names.push(argv[index++]!);
  let timeoutMs: number | undefined, lines = 120, confirmIntervalMs = HERDR_DELEGATE_CONFIRM_INTERVAL_MS, mode: WaitMode = "any";
  while (index < argv.length) {
    const argument = argv[index]!;
    if (argument === "--any" || argument === "--all") { mode = argument.slice(2) as WaitMode; index += 1; continue; }
    const [flag, value, consumed] = splitOption(argument, argv[index + 1]);
    index += consumed;
    if (flag === "--timeout") timeoutMs = parseSafeInteger(flag, value);
    else if (flag === "--confirm-interval") confirmIntervalMs = parseSafeInteger(flag, value);
    else if (flag === "--lines") {
      lines = parseSafeInteger(flag, value);
      if (lines > HERDR_DELEGATE_MAX_READ_LINES) throw new HerdrDelegateUsageError(`--lines must be at most ${HERDR_DELEGATE_MAX_READ_LINES}`);
      if (lines === 0) throw new HerdrDelegateUsageError("--lines must be at least 1");
    } else throw new HerdrDelegateUsageError(`Invalid option: ${flag}`);
  }
  if (names.length === 0 || names.some((name) => name === "")) throw new HerdrDelegateUsageError(`Missing NAME\n${waitUsage}`);
  return { names: [...new Set(names)], timeoutMs, lines, confirmIntervalMs, mode };
}

function createCancellation(): Cancellation {
  const listeners = new Set<() => void>();
  const token: Cancellation = {
    cancelled: false,
    cancel() {
      if (token.cancelled) return;
      token.cancelled = true;
      for (const listener of listeners) listener();
      listeners.clear();
      stopActiveHerdrChildren();
    },
    sleep(ms) {
      return new Promise<void>((resolve) => {
        if (token.cancelled || ms <= 0) return resolve();
        const listener = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => { listeners.delete(listener); resolve(); }, ms);
        listeners.add(listener);
      });
    },
  };
  return token;
}

const hasActivityMarker = (text: string): boolean => HERDR_DELEGATE_ACTIVITY_MARKERS.some((marker) => marker.test(text));
const isSettledObservation = (observation: Observation): boolean =>
  (observation.status === null || HERDR_DELEGATE_SETTLED_STATUSES.has(observation.status)) && !hasActivityMarker(observation.text);
function classifySettledAgent(observation: Observation): WaitClassification {
  if (/0\.0%\//.test(observation.text)) return "never_ran";
  if (observation.status === "blocked" || /^\s*ORCHESTRATOR:/m.test(observation.text)) return "blocked";
  return "report";
}
function lastLines(text: string, lines: number): string {
  const trailing = text.endsWith("\n") ? "\n" : "";
  const rows = (trailing ? text.slice(0, -1) : text).split("\n");
  return rows.length <= lines ? text : rows.slice(rows.length - lines).join("\n") + trailing;
}
/** Reads status and visible pane text together; a vanished agent observes as a null status. */
async function observeAgent(name: string, lines: number): Promise<Observation> {
  let status: string | null = null, text = "";
  try {
    const agent = decodeAgentValue(await callHerdrJson(["agent", "get", name]), "agent get");
    if (typeof agent.agent_status === "string") status = agent.agent_status;
  } catch {}
  try { text = await readAgentTerminal(name, lines); } catch {}
  return { status, text };
}

/** Re-arms `agent wait` until the pane both reports a settled status and stops painting activity. */
async function watchAgent(name: string, command: WaitCommand, deadline: number | null, token: Cancellation): Promise<WatchOutcome> {
  while (!token.cancelled) {
    const remaining = deadline === null ? null : deadline - Date.now();
    if (remaining !== null && remaining <= 0) return { kind: "timed_out" };
    const args = ["agent", "wait", name, "--until", "done", "--until", "blocked"];
    if (remaining !== null) args.push("--timeout", String(remaining));
    try { await callHerdrJson(args); }
    catch (error) {
      if (token.cancelled) break;
      const code = errorCode(error);
      if (code === "timeout") return { kind: "timed_out" };
      if (code !== "agent_not_running") throw error;
    }
    if (token.cancelled) break;
    const observation = await observeAgent(name, command.lines);
    if (token.cancelled) break;
    if (!isSettledObservation(observation)) { await token.sleep(Math.min(command.confirmIntervalMs, HERDR_DELEGATE_REARM_PAUSE_MS)); continue; }
    await token.sleep(command.confirmIntervalMs);
    if (token.cancelled) break;
    const confirmation = await observeAgent(name, command.lines);
    if (token.cancelled) break;
    if (!isSettledObservation(confirmation)) continue;
    return { kind: "settled", settled: { name, status: confirmation.status, classification: classifySettledAgent(confirmation), terminal_text: lastLines(confirmation.text, command.lines) } };
  }
  return { kind: "running" };
}

function collectWaitOutcomes(names: string[], outcomes: Map<string, WatchOutcome>): { settled: SettledAgent[]; running: string[]; timed_out: string[] } {
  const settled: SettledAgent[] = [], running: string[] = [], timedOut: string[] = [];
  for (const name of names) {
    const outcome = outcomes.get(name);
    if (outcome?.kind === "settled") settled.push(outcome.settled);
    else if (outcome?.kind === "timed_out") timedOut.push(name);
    else running.push(name);
  }
  return { settled, running, timed_out: timedOut };
}
function waitFailure(stage: string, upstream: JsonObject, outcomes: { settled: SettledAgent[]; running: string[]; timed_out: string[] } = { settled: [], running: [], timed_out: [] }, extra: JsonObject = {}): JsonObject {
  return { ok: false, stage, upstream_herdr_error: upstream, ...extra, ...outcomes };
}
async function precheckWaitNames(names: string[]): Promise<JsonObject | null> {
  const missing: string[] = [];
  for (const name of names) {
    try { await callHerdrJson(["agent", "get", name]); }
    catch (error) {
      if (errorCode(error) !== "agent_not_found") return waitFailure("precheck", asDelegateError(error).upstream);
      missing.push(name);
    }
  }
  if (missing.length === 0) return null;
  return waitFailure("precheck", { code: "herdr_delegate_agent_not_found", message: `No live agent named ${missing.join(", ")}`, names: missing }, undefined, { missing });
}

/** Waits for real settles across named agents and emits one envelope for all of them. */
export async function runHerdrWaitPipeline(command: WaitCommand): Promise<JsonObject> {
  const precheckFailure = await precheckWaitNames(command.names);
  if (precheckFailure) return precheckFailure;
  const deadline = command.timeoutMs === undefined ? null : Date.now() + command.timeoutMs;
  const token = createCancellation(), outcomes = new Map<string, WatchOutcome>();
  try {
    await Promise.all(command.names.map(async (name) => {
      const outcome = await watchAgent(name, command, deadline, token);
      outcomes.set(name, outcome);
      if (command.mode === "any" && outcome.kind === "settled") token.cancel();
    }));
  } catch (error) {
    token.cancel();
    return waitFailure("wait", asDelegateError(error).upstream, collectWaitOutcomes(command.names, outcomes));
  } finally { token.cancel(); }
  const collected = collectWaitOutcomes(command.names, outcomes);
  const ok = command.mode === "any" ? collected.settled.length > 0 : collected.settled.length === command.names.length;
  return { ok, stage: "wait", ...collected };
}

/** Emits one public JSON envelope and returns its process exit code. */
export async function herdrDelegateMain(argv = process.argv.slice(2)): Promise<number> {
  const waiting = argv[0] === "wait";
  let output: JsonObject;
  if (process.env.HERDR_ENV !== "1") {
    const upstream = { code: "herdr_delegate_environment_required", message: "HERDR_ENV=1 is required" };
    output = waiting ? waitFailure("environment", upstream) : { ok: false, created: false, stage: "environment", upstream_herdr_error: upstream, cleanup: noCleanup("no_pane_created") };
  }
  else try { output = waiting ? await runHerdrWaitPipeline(parseHerdrWaitArguments(argv.slice(1))) : await runFreshDelegatePipeline(parseHerdrDelegateArguments(argv)); }
  catch (error) {
    const upstream = { code: "herdr_delegate_usage_error", message: error instanceof Error ? error.message : String(error) };
    output = waiting ? waitFailure("arguments", upstream) : { ok: false, created: false, stage: "arguments", upstream_herdr_error: upstream, cleanup: noCleanup("no_pane_created") };
  }
  process.stdout.write(`${JSON.stringify(output)}\n`);
  return output.ok === true ? 0 : 1;
}

if (import.meta.main) process.exitCode = await herdrDelegateMain();
