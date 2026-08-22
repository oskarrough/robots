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

// Frontmatter keys that only mean something to one target and are stripped
// from the copies written for the others.
const targetOnlyKeys = ["model_claude"];

const claudeFamilies = ["haiku", "sonnet", "opus"] as const;
const thinkingLevels = ["off", "low", "medium", "high", "xhigh"];

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
  if (metadata.thinking && !thinkingLevels.includes(metadata.thinking)) {
    throw new Error(
      `${filename}: thinking '${metadata.thinking}' must be one of ${thinkingLevels.join(", ")}`,
    );
  }

  return {
    name,
    metadata,
    prompt: match[2].trim() + "\n",
    source,
  };
}

// `model` is written for Pi, which takes provider-prefixed ids. Claude only
// understands the three families, so an agent whose Pi model is another
// vendor's declares `model_claude` alongside it.
function claudeModel(agent: Agent): string | undefined {
  const explicit = agent.metadata.model_claude;
  if (explicit) {
    const family = claudeFamilies.find((f) => explicit.toLowerCase().includes(f));
    if (!family) {
      throw new Error(
        `${agent.name}: model_claude '${explicit}' is not one of ${claudeFamilies.join(", ")}`,
      );
    }
    return family;
  }
  const value = agent.metadata.model;
  if (!value) return undefined;
  return claudeFamilies.find((f) => value.toLowerCase().includes(f));
}

function claudeEffort(value: string | undefined): string | undefined {
  if (!value || value === "off") return undefined;
  return value;
}

function codexEffort(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value === "off") return "low";
  if (value === "xhigh") return "high";
  return value;
}

function stripForeignKeys(source: string, keys: string[]): string {
  return source.replace(/^---\r?\n([\s\S]*?)\r?\n---/, (_full, body: string) => {
    const kept = body
      .split(/\r?\n/)
      .filter((line) => !keys.some((key) => line.startsWith(`${key}:`)));
    return `---\n${kept.join("\n")}\n---`;
  });
}

function renderClaude(agent: Agent): string {
  const lines = [
    "---",
    `name: ${agent.name}`,
    `description: ${JSON.stringify(agent.metadata.description)}`,
  ];
  const model = claudeModel(agent);
  const effort = claudeEffort(agent.metadata.thinking);
  if (model) lines.push(`model: ${model}`);
  if (effort) lines.push(`effort: ${effort}`);
  lines.push("---", "", agent.prompt.trimEnd(), "");
  return lines.join("\n");
}

function renderCodex(agent: Agent): string {
  const lines = [
    `name = ${JSON.stringify(agent.name)}`,
    `description = ${JSON.stringify(agent.metadata.description)}`,
    `developer_instructions = ${JSON.stringify(agent.prompt.trimEnd())}`,
  ];
  if (agent.metadata.display_name) {
    lines.push(`nickname_candidates = [${JSON.stringify(agent.metadata.display_name)}]`);
  }
  const effort = codexEffort(agent.metadata.thinking);
  if (effort) lines.push(`model_reasoning_effort = ${JSON.stringify(effort)}`);
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
      const source = stripForeignKeys(agent.source, targetOnlyKeys);
      await writeAtomic(join(home, ".pi", "agent", "agents", `${agent.name}.md`), source);
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
