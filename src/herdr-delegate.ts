#!/usr/bin/env bun
// herdr-delegate: one envelope per worker turn.
//   herdr-delegate NAME BRIEF --kind KIND [--timeout MS] [--tab ID | --workspace ID | --new-tab LABEL] [--direction right|down] [--cwd DIR] [--start-timeout MS] [--lines N] -- [agent args]
//   herdr-delegate prompt NAME TEXT [--timeout MS] [--lines N]
//   herdr-delegate wait NAME [--timeout MS] [--lines N] [--confirm-interval MS]
// A settle is confirmed from the worker's transcript (herdr's `agent_session`), not the screen.
// The fresh form appends the worker contracts to the brief and verifies the started runtime before prompting.

type Json = Record<string, unknown>;
type Agent = { name: string; kind: string | null; pane_id: string | null; tab_id: string | null; workspace_id: string | null; status: string | null };
type RuntimeValues = { provider: string | null; model: string | null; reasoning_level: string | null };
type RuntimeState = { requested: RuntimeValues; resolved: RuntimeValues & { subscription_billed: boolean | null }; verified: boolean; matches_requested: boolean | null };
type Transcript = { available: boolean; turn_ended: boolean | null; stop: string | null; last_message: string | null; marker: string; runtime: RuntimeValues };
type Observation = { agent: Agent; transcript: Transcript };
type Common = { timeoutMs?: number; lines: number; confirmIntervalMs: number };
type Fresh = Common & { name: string; prompt: string; kind: string; direction: string; cwd: string; tab: string | null; workspace: string | null; newTab: string | null; startTimeoutMs: number; nativeArgs: string[] };

class HerdrError extends Error {
  constructor(readonly upstream: Json) { super(String(upstream.message ?? "herdr failed")); }
}
class UsageError extends Error {}

const SETTLED = new Set(["idle", "done", "blocked"]);
const CONFIRM_INTERVAL_MS = 20_000;
const PROMPT_GATE_MS = 30_000;
/** [herdr bug] `agent start` can race the shell in a fresh split and return `agent_pane_busy`. */
const START_BUSY_BACKOFF_MS = 5_000;
/** Herdr registers `agent_session` asynchronously after start, so an immediate read can miss it. */
const RUNTIME_VERIFY_BACKOFF_MS = [500, 1_000, 2_000, 4_000, 4_000] as const;
/** A worker that ended its turn on its contract line is settled by definition; no confirmation interval. */
const CONTRACT_LINE = /^\s*\[worker [a-z][a-z0-9_-]{0,31}\]\s*(?:DONE|BLOCKED):/m;
const PI_REASONING_LEVELS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max"]);
const emptyRuntime = (): RuntimeValues => ({ provider: null, model: null, reasoning_level: null });
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => typeof v === "string" ? v : null;
const code = (e: unknown): string | null => e instanceof HerdrError ? str(e.upstream.code) : null;
const upstream = (e: unknown): Json => e instanceof HerdrError ? e.upstream : { code: "herdr_delegate_internal_error", message: e instanceof Error ? e.message : String(e) };

/** Reporting contract appended to every fresh brief so results travel back without polling. */
export const workerContract = (worker: string, delegator: string): string =>
  `Your delegator is Herdr pane \`${delegator}\`. You are worker \`${worker}\`; every message you send them starts with \`[worker ${worker}]\` so it is not mistaken for the human. If you need help, send \`[worker ${worker}] BLOCKED: <question>\` with \`herdr agent prompt ${delegator} '<message>'\` (no \`--wait\`), then end your turn with the same line. When finished, send \`[worker ${worker}] DONE: <concise report>\` the same way, then end with that report. If you did nothing, say why.`;

// ---- herdr calls ---------------------------------------------------------------------------

async function runHerdr(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const child = Bun.spawn([process.env.HERDR_BIN_PATH ?? "herdr", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  if (exit === 0) return { stdout, stderr, code: exit };
  try {
    const envelope: unknown = JSON.parse(stderr.trim());
    if (isObject(envelope) && isObject(envelope.error)) throw new HerdrError(envelope.error);
  } catch (error) { if (error instanceof HerdrError) throw error; }
  throw new HerdrError({ code: "herdr_delegate_cli_error", message: stderr.trim() || `herdr exited ${exit}`, argv: args });
}
/** Calls a herdr JSON command and returns its `.result`. */
export async function callHerdrJson(args: string[]): Promise<Json> {
  const envelope: unknown = JSON.parse((await runHerdr(args)).stdout);
  if (!isObject(envelope) || !isObject(envelope.result)) throw new HerdrError({ code: "herdr_delegate_invalid_response", message: `Invalid herdr response for ${args.join(" ")}` });
  return envelope.result;
}
const readTerminal = (name: string, lines: number): Promise<string> =>
  runHerdr(["agent", "read", name, "--source", "visible", "--lines", String(lines), "--format", "text"]).then((r) => r.stdout).catch(() => "");

function toAgent(raw: Json, name: string, kind: string | null): Agent {
  const paneId = str(raw.pane_id);
  return { name, kind: str(raw.agent) ?? kind, pane_id: paneId, tab_id: str(raw.tab_id), workspace_id: str(raw.workspace_id) ?? (paneId?.includes(":") ? paneId.slice(0, paneId.indexOf(":")) : null), status: str(raw.agent_status) };
}
async function getAgent(name: string, kind: string | null = null): Promise<{ agent: Agent; raw: Json } | null> {
  try { const raw = (await callHerdrJson(["agent", "get", name])).agent as Json; return { agent: toAgent(raw, name, kind), raw }; }
  catch { return null; }
}

// ---- transcript ----------------------------------------------------------------------------

/** Locates the session file herdr reports: a path for pi/omp, an id under ~/.claude/projects for Claude. */
function sessionPath(raw: Json, kind: string | null = null): string | null {
  const session = raw.agent_session;
  if (!isObject(session) || typeof session.value !== "string") return null;
  if (session.kind === "path") return session.value;
  const agent = str(session.agent) ?? kind;
  if (session.kind === "id" && agent === "claude" && typeof raw.cwd === "string") {
    return `${process.env.HOME}/.claude/projects/${raw.cwd.replace(/[^a-zA-Z0-9]/g, "-")}/${session.value}.jsonl`;
  }
  if (session.kind === "id" && agent === "codex") {
    const matches = [...new Bun.Glob(`sessions/*/*/*/rollout-*-${session.value}.jsonl`).scanSync({ cwd: `${process.env.HOME}/.codex`, absolute: true })];
    return matches.sort().at(-1) ?? null;
  }
  return null;
}
const textOf = (content: unknown): string =>
  Array.isArray(content) ? content.flatMap((b) => isObject(b) && b.type === "text" && typeof b.text === "string" ? [b.text] : []).join("\n") : "";

/** Resolved runtime as the session file records it: pi/omp `model_change` and `thinking_level_change`
 * events, Claude `message.model` on assistant records. Empty when the format is unknown. */
function runtimeFromRecords(records: Json[]): RuntimeValues {
  const runtime = emptyRuntime();
  for (const r of records) {
    if (r.type === "model_change") { runtime.provider = str(r.provider) ?? runtime.provider; runtime.model = str(r.modelId) ?? runtime.model; }
    else if (r.type === "thinking_level_change") runtime.reasoning_level = str(r.thinkingLevel) ?? runtime.reasoning_level;
    else if (r.type === "assistant" && isObject(r.message) && typeof r.message.model === "string") { runtime.provider = runtime.provider ?? "anthropic"; runtime.model = r.message.model; }
  }
  return runtime;
}

/** Reads the tail of the transcript and reports whether the last assistant turn ended, plus its text.
 * pi/omp: `{type:"message", message:{role, content, stopReason}}`; Claude: `{type:"assistant"|"user", message:{content, stop_reason}}`;
 * codex: `{type:"event_msg", payload:{type:"task_started"|"task_complete"}}` around `{type:"response_item", payload:{type:"message", role, content:[{type:"output_text", text}]}}`. */
export async function readTranscript(path: string | null): Promise<Transcript> {
  const none: Transcript = { available: false, turn_ended: null, stop: null, last_message: null, marker: "", runtime: emptyRuntime() };
  if (!path) return none;
  try {
    const file = Bun.file(path), size = file.size;
    const tail = await file.slice(Math.max(0, size - 262_144), size).text();
    const records = tail.split("\n").slice(1).flatMap((line) => { try { return [JSON.parse(line) as Json]; } catch { return []; } });
    const runtime = runtimeFromRecords(records);
    const texts: string[] = [];
    let ended: boolean | null = null, stopReason: string | null = null, marker = `${size}`;
    if (records.some((r) => r.type === "session_meta" || r.type === "event_msg")) return readCodexTail(records, size, runtime);
    for (let i = records.length - 1; i >= 0; i--) {
      const r = records[i]!;
      const claude = r.type === "assistant" || r.type === "user";
      const pi = r.type === "message";
      if (!claude && !pi) continue;
      const msg = isObject(r.message) ? r.message : r, role = pi ? msg.role : r.type;
      if (role !== "assistant") { if (texts.length || ended !== null) break; ended = false; break; }
      const stop = str(msg.stop_reason) ?? str(msg.stopReason);
      if (ended === null) { stopReason = stop; ended = stop !== null && stop !== "tool_use" && stop !== "toolUse"; marker += `:${str(r.uuid) ?? str(r.id) ?? str(r.timestamp) ?? i}`; }
      const text = textOf(msg.content);
      if (text) texts.unshift(text);
    }
    return { available: true, turn_ended: ended ?? false, stop: stopReason, last_message: texts.length ? texts.join("\n") : null, marker, runtime };
  } catch { return none; }
}

function readCodexTail(records: Json[], size: number, runtime: RuntimeValues): Transcript {
  let ended: boolean | null = null, marker = `${size}`;
  const texts: string[] = [];
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i]!, payload = isObject(r.payload) ? r.payload : {};
    if (r.type === "event_msg" && (payload.type === "task_complete" || payload.type === "task_started")) {
      if (ended === null) { ended = payload.type === "task_complete"; marker += `:${str(r.timestamp) ?? i}`; }
      if (payload.type === "task_started") break;
    }
    if (r.type === "response_item" && payload.type !== "message" && payload.type !== "reasoning" && texts.length) break;
    if (r.type === "response_item" && payload.type === "message" && payload.role === "assistant" && Array.isArray(payload.content)) {
      const text = payload.content.flatMap((b) => isObject(b) && b.type === "output_text" && typeof b.text === "string" ? [b.text] : []).join("\n");
      if (text) texts.unshift(text);
    }
  }
  return { available: true, turn_ended: ended ?? false, stop: null, last_message: texts.length ? texts.join("\n") : null, marker, runtime };
}

// ---- runtime verification ------------------------------------------------------------------

/** Reads the requested runtime out of the native agent args, so a started worker can be checked
 * against it. `--provider`/`--model`/`--thinking`/`--effort`; a model id may carry a provider prefix
 * or a `:reasoning` suffix. */
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
// A claude --model value is an alias ("opus"), so a resolved id that contains it counts as a match.
const modelSatisfies = (requested: string, resolved: string): boolean => resolved === requested || resolved.includes(requested);
function requestedValuesMatch(requested: RuntimeValues, resolved: RuntimeValues): boolean | null {
  const comparisons: boolean[] = [];
  if (requested.provider !== null && resolved.provider !== null) comparisons.push(resolved.provider === requested.provider);
  if (requested.model !== null && resolved.model !== null) comparisons.push(modelSatisfies(requested.model, resolved.model));
  if (requested.reasoning_level !== null && resolved.reasoning_level !== null) comparisons.push(resolved.reasoning_level === requested.reasoning_level);
  return comparisons.length === 0 ? null : comparisons.every(Boolean);
}
function runtimeState(kind: string | null, requested: RuntimeValues, values: RuntimeValues): RuntimeState {
  const subscription_billed = values.provider === "openai-codex" ? true : values.provider === "openai" || values.provider === "openrouter" || values.provider === "vercel-ai-gateway" ? false : null;
  const resolved = { ...values, subscription_billed };
  const verified = resolved.provider !== null && resolved.model !== null && (kind !== "pi" || resolved.reasoning_level !== null);
  return { requested, resolved, verified, matches_requested: requestedValuesMatch(requested, resolved) };
}
const runtimeMismatch = (runtime: RuntimeState): HerdrError =>
  new HerdrError({ code: "herdr_delegate_runtime_mismatch", message: "Resolved runtime does not match the requested runtime", requested: runtime.requested, resolved: runtime.resolved });
/** Verifies a just-started fresh worker while the session file is still being written. */
async function inspectRuntime(cmd: Fresh): Promise<RuntimeState> {
  const requested = requestedRuntime(cmd.nativeArgs);
  let state = runtimeState(cmd.kind, requested, emptyRuntime());
  for (const backoffMs of [0, ...RUNTIME_VERIFY_BACKOFF_MS]) {
    if (backoffMs > 0) await Bun.sleep(backoffMs);
    const got = await getAgent(cmd.name, cmd.kind);
    if (!got) break;
    state = runtimeState(cmd.kind, requested, (await readTranscript(sessionPath(got.raw, cmd.kind))).runtime);
    if (state.verified || state.matches_requested === false) break;
  }
  return state;
}

// ---- settle --------------------------------------------------------------------------------

async function observe(name: string, kind: string | null): Promise<Observation | null> {
  const got = await getAgent(name, kind);
  return got && { agent: got.agent, transcript: await readTranscript(sessionPath(got.raw, kind)) };
}
/** The transcript wins when readable: an omp/pi hook can report `working` after the turn ended (a stuck
 * background job keeps the spinner), and a screen-derived Claude status can flap. `blocked` is always
 * settled: a dialog mid-turn leaves the transcript on a tool call. */
const isSettled = (o: Observation): boolean =>
  o.agent.status === "blocked" || (o.transcript.available ? o.transcript.turn_ended === true : SETTLED.has(o.agent.status ?? ""));

/**
 * Waits for a real settle: herdr reports idle/done/blocked, the transcript's last assistant turn has
 * ended, and both hold again after `confirmIntervalMs`. A bare `agent wait` is re-armed through
 * `timeout` and `agent_not_running` (the latter fires when a pane moves mid-wait) because a finished
 * turn lands as `idle` or `done` depending on seen-state and lifecycle status can flap between tools.
 */
async function settle(name: string, kind: string | null, opts: Common, deadline: number | null): Promise<{ kind: "settled"; observation: Observation } | { kind: "timed_out" } | { kind: "gone" }> {
  for (;;) {
    const remaining = deadline === null ? null : deadline - Date.now();
    if (remaining !== null && remaining <= 0) return { kind: "timed_out" };
    // An ended transcript needs confirmation, not another status wait (which may use up the budget).
    let first = await observe(name, kind);
    if (!first) return { kind: "gone" };
    if (!isSettled(first)) {
      // Slice the wait so a status that never settles still gets the transcript checked every interval.
      const slice = Math.min(deadline === null ? opts.confirmIntervalMs : Math.max(1, deadline - Date.now()), opts.confirmIntervalMs);
      try { await callHerdrJson(["agent", "wait", name, "--timeout", String(slice)]); }
      catch (error) { const c = code(error); if (c === "agent_not_found") return { kind: "gone" }; if (c !== "timeout" && c !== "agent_not_running") throw error; }
      first = await observe(name, kind);
      if (!first) return { kind: "gone" };
    }
    const left = deadline === null ? Infinity : Math.max(0, deadline - Date.now());
    if (!isSettled(first)) { await Bun.sleep(Math.min(1_000, left)); continue; }
    if (first.transcript.turn_ended === true && CONTRACT_LINE.test(first.transcript.last_message ?? "")) return { kind: "settled", observation: first };
    await Bun.sleep(Math.min(opts.confirmIntervalMs, left));
    if (deadline !== null && Date.now() >= deadline) return { kind: "timed_out" };
    const second = await observe(name, kind);
    if (!second) return { kind: "gone" };
    if (isSettled(second) && second.transcript.marker === first.transcript.marker) return { kind: "settled", observation: second };
  }
}

/** `error`: the provider ended the turn (pi records `stopReason: "error"`); `empty`: a turn with no
 * assistant text, e.g. a quota refusal. Both are `ok: false` so a silent failure never reads as a report. */
function classify(o: Observation): "blocked" | "error" | "empty" | "report" {
  const { transcript: t } = o;
  if (o.agent.status === "blocked" || /^\s*(?:\[worker [a-z][a-z0-9_-]{0,31}\]\s*)?BLOCKED(?:\s+[a-z][a-z0-9_-]{0,31})?:/m.test(t.last_message ?? "")) return "blocked";
  if (t.available && t.stop === "error") return "error";
  if (t.available && t.last_message === null) return "empty";
  return "report";
}

/** Turns a settle outcome into the final envelope; `base` carries stage-specific fields. A `requested`
 * runtime re-checks the settled transcript, catching kinds (claude) whose session only names the model
 * after the first reply. */
async function finish(name: string, kind: string | null, opts: Common, deadline: number | null, base: Json, stage: "prompt" | "wait" = "wait", requested?: RuntimeValues): Promise<Json> {
  const outcome = await settle(name, kind, opts, deadline);
  const terminal_text = await readTerminal(name, opts.lines);
  if (outcome.kind === "gone") return { ok: false, ...base, stage: "wait", error: { code: "herdr_delegate_agent_not_found", message: `No live agent named ${name}` }, terminal_text };
  if (outcome.kind === "timed_out") return { ok: false, ...base, stage, agent: (await getAgent(name, kind))?.agent ?? null, error: { code: "timeout", message: `Worker ${name} has not confirmed a settle; rerun herdr-delegate wait ${name}` }, terminal_text };
  const { agent, transcript } = outcome.observation, classification = classify(outcome.observation);
  const runtime = runtimeState(kind, requested ?? emptyRuntime(), transcript.runtime);
  if (requested && runtime.matches_requested === false) return { ok: false, ...base, stage: "verify", agent, classification, last_message: transcript.last_message, terminal_text, runtime, error: runtimeMismatch(runtime).upstream };
  return { ok: classification === "report", ...base, stage: "settled", agent, classification, last_message: transcript.last_message, terminal_text, runtime };
}

async function promptAndFinish(name: string, kind: string | null, text: string, opts: Common, base: Json, requested?: RuntimeValues): Promise<Json> {
  const deadline = opts.timeoutMs === undefined ? null : Date.now() + opts.timeoutMs;
  // `--wait` is used only for its activity gate (`agent_prompt_stalled` within ~5s); the settle itself is
  // ours, so the prompt timeout stays short and a `timeout` here just means the turn started.
  try { await callHerdrJson(["agent", "prompt", name, text, "--wait", "--timeout", String(Math.min(opts.timeoutMs ?? PROMPT_GATE_MS, PROMPT_GATE_MS))]); }
  catch (error) {
    const c = code(error);
    if (c !== "timeout") {
      const agent = (await getAgent(name, kind))?.agent ?? null, terminal_text = await readTerminal(name, opts.lines);
      if (c === "agent_prompt_stalled" || c === "agent_not_found" || c === "agent_not_running") return { ok: false, ...base, stage: "prompt", agent, classification: "never_ran", error: upstream(error), terminal_text };
      if (c === "agent_blocked") return { ok: false, ...base, stage: "prompt", agent, classification: "blocked", error: upstream(error), terminal_text };
      return { ok: false, ...base, stage: "prompt", agent, error: upstream(error), terminal_text };
    }
  }
  return finish(name, kind, opts, deadline, base, "prompt", requested);
}

// ---- fresh worker --------------------------------------------------------------------------

/** Resolves `--workspace` (id or label, unique) to its active tab; `--tab` passes through. */
async function resolveDestinationTab(cmd: Fresh): Promise<string | null> {
  if (cmd.tab !== null) return cmd.tab;
  if (cmd.workspace === null) return null;
  const workspaces = (await callHerdrJson(["workspace", "list"])).workspaces;
  if (!Array.isArray(workspaces) || !workspaces.every(isObject)) throw new HerdrError({ code: "herdr_delegate_invalid_response", message: "Invalid herdr response for workspace list" });
  const byId = workspaces.filter((w) => w.workspace_id === cmd.workspace);
  const matches = byId.length > 0 ? byId : workspaces.filter((w) => w.label === cmd.workspace);
  if (matches.length === 0) throw new HerdrError({ code: "herdr_delegate_workspace_not_found", message: `Workspace ${cmd.workspace} not found` });
  if (matches.length > 1) throw new HerdrError({ code: "herdr_delegate_workspace_ambiguous", message: `Workspace label ${cmd.workspace} is ambiguous`, workspace_ids: matches.map((w) => w.workspace_id) });
  const activeTabId = matches[0]!.active_tab_id;
  if (typeof activeTabId !== "string") throw new HerdrError({ code: "herdr_delegate_invalid_response", message: "Invalid herdr response for workspace list" });
  return activeTabId;
}

async function startFresh(cmd: Fresh): Promise<Json> {
  const base: Json = { created: false };
  const fail = (stage: string, error: unknown, extra: Json = {}): Json => ({ ok: false, ...base, stage, error: upstream(error), ...extra });
  const delegator = process.env.HERDR_PANE_ID;
  if (!delegator) return fail("environment", new HerdrError({ code: "herdr_delegate_caller_unknown", message: "HERDR_PANE_ID is required to tell the worker where to report" }));
  let destinationTab: string | null;
  try { destinationTab = await resolveDestinationTab(cmd); }
  catch (error) { return fail("preflight", error); }
  try {
    const agents = (await callHerdrJson(["agent", "list"])).agents;
    if (Array.isArray(agents) && agents.some((a) => isObject(a) && a.name === cmd.name)) return fail("preflight", new HerdrError({ code: "herdr_delegate_agent_name_conflict", message: `Agent ${cmd.name} already exists` }));
  } catch (error) { return fail("preflight", error); }
  let pane: Json;
  try { pane = (await callHerdrJson(["pane", "split", "--current", "--direction", cmd.direction, "--cwd", cmd.cwd, "--no-focus"])).pane as Json; }
  catch (error) { return fail("split", error); }
  const paneId = String(pane.pane_id);
  const startArgs = ["agent", "start", cmd.name, "--kind", cmd.kind, "--pane", paneId, "--timeout", String(cmd.startTimeoutMs), "--", ...cmd.nativeArgs];
  try {
    try { await callHerdrJson(startArgs); }
    catch (error) { if (code(error) !== "agent_pane_busy") throw error; await Bun.sleep(START_BUSY_BACKOFF_MS); await callHerdrJson(startArgs); }
  } catch (error) { return fail("start", error, { pane_id: paneId, terminal_text: await readTerminal(paneId, cmd.lines) }); }
  base.created = true;
  const runtime = await inspectRuntime(cmd);
  base.runtime = runtime;
  // A wrong-model worker is a wasted turn: fail before prompting, keeping the pane for inspection.
  if (runtime.matches_requested === false) return fail("verify", runtimeMismatch(runtime), { agent: (await getAgent(cmd.name, cmd.kind))?.agent ?? null, terminal_text: await readTerminal(cmd.name, cmd.lines) });
  if (destinationTab || cmd.newTab !== null) {
    try {
      const moveArgs = cmd.newTab
        ? ["pane", "move", paneId, "--new-tab", "--workspace", process.env.HERDR_WORKSPACE_ID!, "--label", cmd.newTab, "--no-focus"]
        : ["pane", "move", paneId, "--tab", destinationTab!, "--split", cmd.direction, "--no-focus"];
      const move = (await callHerdrJson(moveArgs)).move_result as Json;
      // [herdr bug] `pane move` silently no-ops on a zoomed tab; report it rather than assume placement.
      // `same_tab` is the only other no-op reason and means the pane is already where it was asked to be.
      if (move.changed !== true && move.reason !== "same_tab") throw new HerdrError({ code: "herdr_delegate_move_unchanged", message: `herdr did not move pane: ${String(move.reason)}` });
    } catch (error) { return fail("move", error, { agent: (await getAgent(cmd.name, cmd.kind))?.agent ?? null }); }
  }
  return promptAndFinish(cmd.name, cmd.kind, `${cmd.prompt}\n\n${workerContract(cmd.name, delegator)}`, cmd, base, runtime.requested);
}

// ---- arguments -----------------------------------------------------------------------------

type Parsed = { positionals: string[]; flags: Map<string, string>; nativeArgs: string[] };
function parseArgs(argv: string[], allowed: string[]): Parsed {
  const separator = argv.indexOf("--"), own = separator < 0 ? argv : argv.slice(0, separator);
  const positionals: string[] = [], flags = new Map<string, string>();
  for (let i = 0; i < own.length; i++) {
    const arg = own[i]!;
    if (!arg.startsWith("--")) { positionals.push(arg); continue; }
    const eq = arg.indexOf("="), flag = eq < 0 ? arg : arg.slice(0, eq), value = eq < 0 ? own[++i] : arg.slice(eq + 1);
    if (!allowed.includes(flag)) throw new UsageError(`Invalid option: ${flag}`);
    if (value === undefined) throw new UsageError(`${flag} requires a value`);
    flags.set(flag, value);
  }
  return { positionals, flags, nativeArgs: separator < 0 ? [] : argv.slice(separator + 1) };
}
function integer(flags: Map<string, string>, flag: string, fallback: number | undefined): number | undefined {
  const value = flags.get(flag);
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new UsageError(`${flag} requires a non-negative integer`);
  return Number(value);
}
function common(flags: Map<string, string>): Common {
  const lines = integer(flags, "--lines", 120)!;
  if (lines < 1) throw new UsageError("--lines must be at least 1");
  return { timeoutMs: integer(flags, "--timeout", undefined), lines, confirmIntervalMs: integer(flags, "--confirm-interval", CONFIRM_INTERVAL_MS)! };
}

const USAGE = `herdr-delegate NAME BRIEF --kind KIND [--timeout MS] [--tab ID | --workspace ID | --new-tab LABEL] [--direction right|down] [--cwd DIR] [--start-timeout MS] [--lines N] -- [agent args]
herdr-delegate prompt NAME TEXT [--timeout MS] [--lines N]
herdr-delegate wait NAME [--timeout MS] [--lines N] [--confirm-interval MS]

Spawns, prompts, or waits for a herdr worker and prints one JSON envelope:
{ok, stage, agent, runtime, classification, last_message, terminal_text, error}.
classification: report | blocked | error | empty | never_ran. Exit 0 only when ok.`;

/** Dispatches on the first argument and returns the envelope. */
export async function run(argv: string[]): Promise<Json> {
  const [sub] = argv;
  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) { process.stdout.write(`${USAGE}\n`); process.exit(0); }
  if (sub === "wait") {
    const { positionals, flags } = parseArgs(argv.slice(1), ["--timeout", "--lines", "--confirm-interval"]);
    if (positionals.length !== 1) throw new UsageError("Usage: herdr-delegate wait NAME [--timeout MS] [--lines N] [--confirm-interval MS]");
    const name = positionals[0]!, opts = common(flags);
    if (!await getAgent(name)) return { ok: false, stage: "precheck", error: { code: "herdr_delegate_agent_not_found", message: `No live agent named ${name}` } };
    return finish(name, null, opts, opts.timeoutMs === undefined ? null : Date.now() + opts.timeoutMs, {});
  }
  if (sub === "prompt") {
    const { positionals, flags } = parseArgs(argv.slice(1), ["--timeout", "--lines", "--confirm-interval"]);
    if (positionals.length !== 2) throw new UsageError("Usage: herdr-delegate prompt NAME TEXT [--timeout MS] [--lines N]");
    return promptAndFinish(positionals[0]!, null, positionals[1]!, common(flags), {});
  }
  const { positionals, flags, nativeArgs } = parseArgs(argv, ["--kind", "--timeout", "--tab", "--workspace", "--new-tab", "--direction", "--cwd", "--start-timeout", "--lines", "--confirm-interval"]);
  if (positionals.length !== 2 || !flags.get("--kind")) throw new UsageError("Usage: herdr-delegate NAME BRIEF --kind KIND [--timeout MS] [--tab ID | --workspace ID | --new-tab LABEL] [--direction right|down] [--cwd DIR] [--start-timeout MS] [--lines N] -- [agent args]");
  const direction = flags.get("--direction") ?? "right";
  if (direction !== "right" && direction !== "down") throw new UsageError("--direction must be right or down");
  const tab = flags.get("--tab") ?? null, workspace = flags.get("--workspace") ?? null, newTab = flags.get("--new-tab") ?? null;
  if ([tab, workspace, newTab].filter((value) => value !== null).length > 1) throw new UsageError("--tab, --workspace, and --new-tab are mutually exclusive");
  if (newTab === "") throw new UsageError("--new-tab requires a non-empty label");
  if (newTab !== null && !process.env.HERDR_WORKSPACE_ID) throw new UsageError("--new-tab requires HERDR_WORKSPACE_ID");
  return startFresh({ ...common(flags), name: positionals[0]!, prompt: positionals[1]!, kind: flags.get("--kind")!, direction, cwd: flags.get("--cwd") ?? process.cwd(), tab, workspace, newTab, startTimeoutMs: integer(flags, "--start-timeout", 30_000)!, nativeArgs });
}

if (import.meta.main) {
  let output: Json;
  if (process.env.HERDR_ENV !== "1") output = { ok: false, stage: "environment", error: { code: "herdr_delegate_environment_required", message: "HERDR_ENV=1 is required" } };
  else try { output = await run(process.argv.slice(2)); }
  catch (error) { output = { ok: false, stage: error instanceof UsageError ? "arguments" : "internal", error: error instanceof UsageError ? { code: "herdr_delegate_usage_error", message: error.message } : upstream(error) }; }
  process.stdout.write(`${JSON.stringify(output)}\n`);
  process.exitCode = output.ok === true ? 0 : 1;
}