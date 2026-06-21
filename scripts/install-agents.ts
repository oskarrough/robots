import { mkdir, readdir, rename } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

type Frontmatter = Record<string, string>;

type Agent = {
  name: string;
  metadata: Frontmatter;
  prompt: string;
  source: string;
};

const repoRoot = join(import.meta.dir, "..");
const home = process.env.HOME;

if (!home) throw new Error("HOME is not set");

const requestedTargets = process.argv.slice(2);
const targets = requestedTargets.length
  ? requestedTargets
  : ["pi", "claude", "codex"];
const validTargets = new Set(["pi", "claude", "codex"]);

for (const target of targets) {
  if (!validTargets.has(target)) {
    throw new Error(`Unknown target '${target}'. Use pi, claude, or codex.`);
  }
}

function parseAgent(source: string, filename: string): Agent {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: missing YAML frontmatter`);

  const parsed = Bun.YAML.parse(match[1]);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filename}: frontmatter must be a YAML object`);
  }

  const metadata: Frontmatter = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(`${filename}: frontmatter field '${key}' must be a string`);
    }
    metadata[key] = value;
  }

  const name = basename(filename, ".md");
  if (!metadata.description) throw new Error(`${filename}: description is required`);

  return {
    name,
    metadata,
    prompt: match[2].trim() + "\n",
    source,
  };
}

function parseTools(value: string | undefined): string[] | undefined {
  if (!value || value === "all" || value === "*") return undefined;
  return value.split(",").map((tool) => tool.trim().toLowerCase());
}

function claudeTools(value: string | undefined): string | undefined {
  const tools = parseTools(value);
  if (!tools) return undefined;

  const aliases: Record<string, string> = {
    read: "Read",
    write: "Write",
    edit: "Edit",
    bash: "Bash",
    grep: "Grep",
    find: "Glob",
    ls: "Glob",
  };
  const mapped = [...new Set(tools.map((tool) => aliases[tool]))];
  const unknown = tools.filter((tool) => !aliases[tool]);
  if (unknown.length) throw new Error(`Unsupported Claude tools: ${unknown.join(", ")}`);
  return mapped.join(", ");
}

function claudeModel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  for (const family of ["haiku", "sonnet", "opus"] as const) {
    if (value.toLowerCase().includes(family)) return family;
  }
  throw new Error(`Cannot map model '${value}' to a Claude model family`);
}

function renderClaude(agent: Agent): string {
  const lines = [
    "---",
    `name: ${agent.name}`,
    `description: ${JSON.stringify(agent.metadata.description)}`,
  ];
  const tools = claudeTools(agent.metadata.tools);
  const model = claudeModel(agent.metadata.model);
  if (tools) lines.push(`tools: ${tools}`);
  if (model) lines.push(`model: ${model}`);
  if (["low", "medium", "high"].includes(agent.metadata.thinking)) {
    lines.push(`effort: ${agent.metadata.thinking}`);
  }
  lines.push("---", "", agent.prompt.trimEnd(), "");
  return lines.join("\n");
}

function renderCodex(agent: Agent): string {
  const tools = parseTools(agent.metadata.tools);
  const readOnly = tools && !tools.some((tool) => tool === "write" || tool === "edit");
  const lines = [
    `name = ${JSON.stringify(agent.name)}`,
    `description = ${JSON.stringify(agent.metadata.description)}`,
    `developer_instructions = ${JSON.stringify(agent.prompt.trimEnd())}`,
  ];
  if (agent.metadata.display_name) {
    lines.push(`nickname_candidates = [${JSON.stringify(agent.metadata.display_name)}]`);
  }
  if (readOnly) lines.push('sandbox_mode = "read-only"');
  if (["low", "medium", "high"].includes(agent.metadata.thinking)) {
    lines.push(`model_reasoning_effort = ${JSON.stringify(agent.metadata.thinking)}`);
  } else if (agent.metadata.thinking === "off") {
    lines.push('model_reasoning_effort = "low"');
  }
  return lines.join("\n") + "\n";
}

async function writeAtomic(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await Bun.write(temporary, content);
  await rename(temporary, path);
  console.log(path);
}

const filenames = (await readdir(join(repoRoot, "agents")))
  .filter((name) => name.endsWith(".md"))
  .sort();
const agents = await Promise.all(
  filenames.map(async (filename) => {
    const source = await Bun.file(join(repoRoot, "agents", filename)).text();
    return parseAgent(source, filename);
  }),
);

for (const target of targets) {
  for (const agent of agents) {
    if (target === "pi") {
      await writeAtomic(join(home, ".pi", "agent", "agents", `${agent.name}.md`), agent.source);
    } else if (target === "claude") {
      await writeAtomic(join(home, ".claude", "agents", `${agent.name}.md`), renderClaude(agent));
    } else {
      await writeAtomic(join(home, ".codex", "agents", `${agent.name}.toml`), renderCodex(agent));
    }
  }
  if (target === "pi") {
    const settings = await Bun.file(join(repoRoot, "subagents.json")).text();
    await writeAtomic(join(home, ".pi", "agent", "subagents.json"), settings);
  }
}
