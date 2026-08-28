import { mkdir, readdir, rm, symlink } from "node:fs/promises";
import { join, relative } from "node:path";

// Symlink every skill in this repo into ~/.agents/skills (the canonical store
// that `bunx skills` points all agent directories at), so local edits are live
// everywhere immediately — no push, no reinstall. Also ensures the Claude Code
// link exists for skills added after the last `bunx skills add`.

const repoRoot = join(import.meta.dir, "..");
const home = process.env.HOME;
if (!home) throw new Error("HOME is not set");

const store = join(home, ".agents", "skills");
const claudeSkills = join(home, ".claude", "skills");
await mkdir(store, { recursive: true });
await mkdir(claudeSkills, { recursive: true });

const entries = await readdir(join(repoRoot, "skills"), { withFileTypes: true });

const skillDirs = entries
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

for (const dirName of skillDirs) {
  const skillDir = join(repoRoot, "skills", dirName);
  const skillFile = Bun.file(join(skillDir, "SKILL.md"));
  if (!(await skillFile.exists())) continue;

  const match = (await skillFile.text()).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = match ? Bun.YAML.parse(match[1]) : null;
  const name =
    frontmatter && typeof frontmatter === "object" && !Array.isArray(frontmatter)
      ? (frontmatter as Record<string, unknown>).name
      : null;
  if (typeof name !== "string" || !name) {
    throw new Error(`skills/${dirName}/SKILL.md: frontmatter name is required`);
  }

  const storeLink = join(store, name);
  await rm(storeLink, { recursive: true, force: true });
  await symlink(skillDir, storeLink);
  console.log(`${storeLink} -> ${skillDir}`);

  const claudeLink = join(claudeSkills, name);
  await rm(claudeLink, { recursive: true, force: true });
  await symlink(relative(claudeSkills, storeLink), claudeLink);
}
