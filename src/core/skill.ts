import { basename, join, resolve } from "node:path";
import { lstat, readdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { openDb, type SkillRow } from "./db";
import { copyDir, ensureDir, pathExists, removePath, replaceWithSymlink } from "./fs";
import { paths, expandHome } from "./paths";
import { cloneGitSource, isGitSource, parseGitSource } from "./git";
import { assertUsage } from "./errors";
import { getTool, getToolSkillLocations, getToolSkillsDirs, toolAdapters, type ToolAdapter } from "./tools";

export type SkillCandidate = {
  dir: string;
  skillFile: string;
};

export type SkillImportSource = {
  sourceType: "local" | "git";
  url?: string;
  ref?: string;
  subpath?: string;
  commitSha?: string | null;
};

export type ToolSkillImportResult = {
  tool: string;
  skills: SkillRow[];
  skipped: boolean;
  reason?: string;
};

export type SkillAgentLink = {
  tool: string;
  path: string;
};

export type AgentSkill = {
  tool: string;
  name: string;
  description: string | null;
  path: string;
  scope: "user" | "system";
  editable: boolean;
};

export async function findSkillFile(dir: string): Promise<string | null> {
  const canonical = join(dir, "SKILL.md");
  if (await pathExists(canonical)) return canonical;
  const legacy = join(dir, "skill.md");
  if (await pathExists(legacy)) return legacy;
  return null;
}

export async function findSkillCandidates(root: string): Promise<SkillCandidate[]> {
  const candidates: SkillCandidate[] = [];
  await walk(root, candidates);
  return candidates;
}

async function walk(dir: string, candidates: SkillCandidate[]): Promise<void> {
  const skillFile = await findSkillFile(dir);
  if (skillFile) {
    candidates.push({ dir, skillFile });
    return;
  }
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === ".git" || entry.name === "node_modules") continue;
    await walk(join(dir, entry.name), candidates);
  }
}

export async function addSkill(source: string, presetName = "Default"): Promise<SkillRow> {
  const skills = await addSkills(source, presetName);
  return skills[0]!;
}

export async function addSkills(source: string, presetName = "Default"): Promise<SkillRow[]> {
  await ensureDir(paths().skillsDir);
  const resolved = isGitSource(source) ? await resolveGitImport(source) : await resolveLocalImport(source);
  const candidates = await findSkillCandidates(resolved.root);
  assertUsage(candidates.length > 0, `No skill found in ${resolved.root}. Expected SKILL.md or skill.md.`);
  const imported: SkillRow[] = [];
  for (const candidate of candidates) imported.push(await importCandidate(candidate, resolved.importSource, { presetName }));
  return imported;
}

export async function addCodexSkills(skillsDir?: string, presetName = "Default"): Promise<SkillRow[]> {
  if (skillsDir) return addSkillsFromDirectory(skillsDir, "Codex", { presetName });
  return addSkillsFromTool(getTool("codex"), { presetName });
}

export async function addLocalAgentSkills(toolInput: string, tools: ToolAdapter[] = toolAdapters, presetName = "Default"): Promise<ToolSkillImportResult[]> {
  if (toolInput === "all") return addAllLocalAgentSkills(tools, presetName);
  const tool = tools.find((adapter) => adapter.key === toolInput) || getTool(toolInput);
  const skills = await addSkillsFromTool(tool, { presetName });
  return [{ tool: tool.key, skills, skipped: false }];
}

export async function addAllLocalAgentSkills(tools: ToolAdapter[] = toolAdapters, presetName = "Default"): Promise<ToolSkillImportResult[]> {
  const results: ToolSkillImportResult[] = [];
  for (const tool of tools) {
    const existingDirs = [];
    for (const skillsDir of getToolSkillsDirs(tool)) {
      if (await pathExists(skillsDir)) existingDirs.push(skillsDir);
    }
    if (existingDirs.length === 0) {
      results.push({ tool: tool.key, skills: [], skipped: true, reason: `Skills directories do not exist: ${getToolSkillsDirs(tool).join(", ")}` });
      continue;
    }
    const skills = await addSkillsFromTool(tool, { requireAny: false, presetName });
    results.push({ tool: tool.key, skills, skipped: false });
  }
  assertUsage(results.some((result) => result.skills.length > 0), "No local agent skills found.");
  return results;
}

export async function listAgentSkills(toolInput = "all", tools: ToolAdapter[] = toolAdapters): Promise<Array<{ tool: string; path: string; paths: string[]; skills: AgentSkill[] }>> {
  const selected = toolInput === "all" ? tools : [tools.find((adapter) => adapter.key === toolInput) || getTool(toolInput)];
  const results: Array<{ tool: string; path: string; paths: string[]; skills: AgentSkill[] }> = [];
  for (const tool of selected) {
    const skillsByName = new Map<string, AgentSkill>();
    const locations = getToolSkillLocations(tool);
    for (const location of locations) {
      const skillsDir = location.path;
      let entries;
      try {
        entries = await readdir(skillsDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name.startsWith(".")) continue;
        const dir = join(skillsDir, entry.name);
        const skillFile = await findSkillFile(dir);
        if (!skillFile) continue;
        const meta = await readSkillMetadata(skillFile);
        const name = slug(meta.name || entry.name);
        if (!skillsByName.has(name)) {
          skillsByName.set(name, { tool: tool.key, name, description: meta.description, path: dir, scope: location.scope, editable: location.editable });
        }
      }
    }
    const skills = [...skillsByName.values()];
    skills.sort((a, b) => a.name.localeCompare(b.name));
    const skillPaths = locations.map((location) => location.path);
    results.push({ tool: tool.key, path: skillPaths.join(", "), paths: skillPaths, skills });
  }
  return results;
}

export async function readAgentSkillMarkdown(skill: AgentSkill): Promise<string> {
  const file = await findSkillFile(skill.path);
  assertUsage(file, `Skill document not found: ${skill.name}`);
  return readFile(file, "utf8");
}

async function addSkillsFromTool(tool: ToolAdapter, options: { requireAny?: boolean; presetName?: string } = {}): Promise<SkillRow[]> {
  const existingDirs = [];
  for (const skillsDir of getToolSkillsDirs(tool)) {
    if (await pathExists(skillsDir)) existingDirs.push(skillsDir);
  }
  assertUsage(existingDirs.length > 0, `${tool.displayName} skills directories do not exist: ${getToolSkillsDirs(tool).join(", ")}`);
  const imported = new Map<string, SkillRow>();
  for (const skillsDir of existingDirs) {
    const importOptions = { requireAny: false, ...(options.presetName ? { presetName: options.presetName } : {}) };
    for (const skill of await addSkillsFromDirectory(skillsDir, tool.displayName, importOptions)) imported.set(skill.name, skill);
  }
  assertUsage(options.requireAny === false || imported.size > 0, `No skills found in ${existingDirs.join(", ")}. Expected direct child directories with SKILL.md or skill.md.`);
  return [...imported.values()];
}

async function addSkillsFromDirectory(skillsDir: string, label: string, options: { requireAny?: boolean; presetName?: string } = {}): Promise<SkillRow[]> {
  const requireAny = options.requireAny ?? true;
  assertUsage(await pathExists(skillsDir), `${label} skills directory does not exist: ${skillsDir}`);
  const entries = await readdir(skillsDir, { withFileTypes: true });
  const imported: SkillRow[] = [];
  for (const entry of entries) {
    if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name.startsWith(".")) continue;
    const dir = join(skillsDir, entry.name);
    if (!(await findSkillFile(dir))) continue;
    const existingManagedDir = await managedSymlinkTarget(dir);
    const skill = existingManagedDir
      ? await importCandidate({ dir: existingManagedDir, skillFile: (await findSkillFile(existingManagedDir))! }, { sourceType: "local" }, { copy: false, ...(options.presetName ? { presetName: options.presetName } : {}) })
      : await addSkill(dir, options.presetName);
    await linkManagedSkillToSource(skill, dir);
    imported.push(skill);
  }
  assertUsage(!requireAny || imported.length > 0, `No skills found in ${skillsDir}. Expected direct child directories with SKILL.md or skill.md.`);
  return imported;
}

async function managedSymlinkTarget(sourceDir: string): Promise<string | null> {
  try {
    if (!(await lstat(sourceDir)).isSymbolicLink()) return null;
    const target = await realpath(sourceDir);
    const managedRoot = await realpath(paths().skillsDir).catch(() => resolve(paths().skillsDir));
    if (!target.startsWith(`${managedRoot}/`)) return null;
    return (await findSkillFile(target)) ? target : null;
  } catch {
    return null;
  }
}

async function linkManagedSkillToSource(skill: SkillRow, sourceDir: string): Promise<void> {
  const source = resolve(sourceDir);
  const target = resolve(skill.path);
  if (source === target) return;
  try {
    const existing = await lstat(source);
    if (existing.isSymbolicLink()) {
      const linkedPath = await realpath(source);
      const realTarget = await realpath(target);
      if (linkedPath === realTarget) return;
    }
  } catch {
    return;
  }
  await replaceWithSymlink(target, source);
}

async function resolveLocalImport(source: string): Promise<{ root: string; importSource: SkillImportSource }> {
  const root = resolve(expandHome(source));
  assertUsage(await pathExists(root), `Path does not exist: ${root}`);
  assertUsage((await stat(root)).isDirectory(), `Path is not a directory: ${root}`);
  return { root, importSource: { sourceType: "local" } };
}

async function resolveGitImport(source: string): Promise<{ root: string; importSource: SkillImportSource }> {
  const parsed = parseGitSource(source);
  const cloned = await cloneGitSource(parsed);
  const root = parsed.subpath ? join(cloned.checkoutDir, parsed.subpath) : cloned.checkoutDir;
  assertUsage(await pathExists(root), `Git subpath does not exist: ${parsed.subpath}`);
  return {
    root,
    importSource: {
      sourceType: "git",
      url: parsed.url,
      ...(parsed.ref ? { ref: parsed.ref } : {}),
      ...(parsed.subpath ? { subpath: parsed.subpath } : {}),
      commitSha: cloned.commitSha,
    },
  };
}

async function importCandidate(candidate: SkillCandidate, source: SkillImportSource, options: { copy?: boolean; presetName?: string } = {}): Promise<SkillRow> {
  const meta = await readSkillMetadata(candidate.skillFile);
  const name = slug(meta.name || basename(candidate.dir));
  const target = join(paths().skillsDir, name);
  if (options.copy !== false) await copyDir(candidate.dir, target);
  const db = await openDb();
  db.query(`
    INSERT INTO skills (name, description, path, source_type, source_url, source_ref, source_subpath, source_commit, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(name) DO UPDATE SET
      description = excluded.description,
      path = excluded.path,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      source_ref = excluded.source_ref,
      source_subpath = excluded.source_subpath,
      source_commit = excluded.source_commit,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    name,
    meta.description,
    target,
    source.sourceType,
    source.url || null,
    source.ref || null,
    source.subpath || null,
    source.commitSha || null,
  );
  const skill = db.query("SELECT * FROM skills WHERE name = ?").get(name) as SkillRow;
  await addSkillToPreset(skill.id, options.presetName);
  return skill;
}

export async function addSkillToPreset(skillId: number, presetName = "Default"): Promise<void> {
  const db = await openDb();
  db.query("INSERT OR IGNORE INTO presets (name) VALUES (?)").run(presetName);
  const preset = db.query("SELECT id FROM presets WHERE name = ?").get(presetName) as { id: number };
  db.query("INSERT OR IGNORE INTO preset_skills (preset_id, skill_id) VALUES (?, ?)").run(preset.id, skillId);
}

export async function listSkills(): Promise<SkillRow[]> {
  const db = await openDb();
  const skills = db.query("SELECT * FROM skills ORDER BY name").all() as SkillRow[];
  return Promise.all(skills.map(refreshSkillMetadata));
}

export async function getSkill(name: string): Promise<SkillRow | null> {
  const db = await openDb();
  const skill = (db.query("SELECT * FROM skills WHERE name = ?").get(name) as SkillRow | null) || null;
  return skill ? refreshSkillMetadata(skill) : null;
}

async function refreshSkillMetadata(skill: SkillRow): Promise<SkillRow> {
  try {
    const skillFile = await findSkillFile(skill.path);
    if (!skillFile) return skill;
    const metadata = await readSkillMetadata(skillFile);
    if (metadata.description === skill.description) return skill;
    const db = await openDb();
    db.query("UPDATE skills SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(metadata.description, skill.id);
    return db.query("SELECT * FROM skills WHERE id = ?").get(skill.id) as SkillRow;
  } catch {
    return skill;
  }
}

export async function findSkillAgentLinks(skill: SkillRow, tools: ToolAdapter[] = toolAdapters): Promise<SkillAgentLink[]> {
  const target = await realpath(skill.path).catch(() => resolve(skill.path));
  const links: SkillAgentLink[] = [];
  for (const tool of tools) {
    for (const skillsDir of getToolSkillsDirs(tool)) {
      const path = join(skillsDir, skill.name);
      try {
        if (!(await lstat(path)).isSymbolicLink()) continue;
        if ((await realpath(path)) === target) links.push({ tool: tool.key, path });
      } catch {
        continue;
      }
    }
  }
  return links;
}

export async function removeSkill(name: string, options: { removeAgentLinks?: boolean; tools?: ToolAdapter[] } = {}): Promise<{ skill: SkillRow; agentLinks: SkillAgentLink[] }> {
  const db = await openDb();
  const skill = await getSkill(name);
  if (!skill) throw new Error(`Skill not found: ${name}`);
  const agentLinks = await findSkillAgentLinks(skill, options.tools);
  if (options.removeAgentLinks) {
    for (const link of agentLinks) await removePath(link.path);
  }
  db.query("DELETE FROM preset_skills WHERE skill_id = ?").run(skill.id);
  db.query("DELETE FROM skills WHERE id = ?").run(skill.id);
  await removePath(skill.path);
  return { skill, agentLinks };
}

export async function removeSkillAgentLink(
  name: string,
  toolInput: string,
  tools: ToolAdapter[] = toolAdapters,
): Promise<{ skill: SkillRow; agentLink: SkillAgentLink }> {
  const skill = await getSkill(name);
  if (!skill) throw new Error(`Skill not found: ${name}`);
  const tool = tools.find((adapter) => adapter.key === toolInput);
  if (!tool) throw new Error(`Unknown tool: ${toolInput}. Expected one of: ${tools.map((adapter) => adapter.key).join(", ")}`);
  const agentLinks = await findSkillAgentLinks(skill, [tool]);
  const [agentLink] = agentLinks;
  if (!agentLink) throw new Error(`${tool.displayName} does not have a managed symlink for skill: ${name}`);
  for (const link of agentLinks) await removePath(link.path);
  return { skill, agentLink };
}

export async function skillMarkdownSummary(skill: SkillRow): Promise<string> {
  return (await readSkillMarkdown(skill)).split("\n").slice(0, 40).join("\n");
}

export async function readSkillMarkdown(skill: SkillRow): Promise<string> {
  const file = (await findSkillFile(skill.path)) || join(skill.path, "SKILL.md");
  return readFile(file, "utf8");
}

export async function updateSkillMarkdown(name: string, markdown: string): Promise<SkillRow> {
  const skill = await getSkill(name);
  if (!skill) throw new Error(`Skill not found: ${name}`);
  assertUsage(markdown.trim().length > 0, "Skill content cannot be empty.");
  const metadata = parseSkillMetadata(markdown);
  if (metadata.name && slug(metadata.name) !== skill.name) {
    throw new Error(`Skill frontmatter name must remain ${skill.name}.`);
  }
  const file = (await findSkillFile(skill.path)) || join(skill.path, "SKILL.md");
  await writeFile(file, markdown, "utf8");
  const db = await openDb();
  db.query("UPDATE skills SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(metadata.description, skill.id);
  return (await getSkill(name))!;
}

export async function readSkillMetadata(skillFile: string): Promise<{ name: string | null; description: string | null }> {
  return parseSkillMetadata(await readFile(skillFile, "utf8"));
}

function parseSkillMetadata(text: string): { name: string | null; description: string | null } {
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter?.[1]) return { name: null, description: null };
  return {
    name: readYamlScalar(frontmatter[1], "name") || null,
    description: readYamlScalar(frontmatter[1], "description") || null,
  };
}

function readYamlScalar(text: string, key: string): string | undefined {
  const lines = text.split(/\r?\n/);
  const keyPattern = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const index = lines.findIndex((line) => new RegExp(`^${keyPattern}:\\s*(.*)$`).test(line));
  if (index < 0) return undefined;

  const value = lines[index]!.match(new RegExp(`^${keyPattern}:\\s*(.*)$`))?.[1]?.trim() || "";
  const block = value.match(/^([>|])([+-])?(?:\s+#.*)?$/);
  if (!block) return unquoteYamlScalar(value);

  const blockLines: string[] = [];
  let contentIndent: number | undefined;
  for (const line of lines.slice(index + 1)) {
    if (line.trim().length === 0) {
      blockLines.push("");
      continue;
    }
    const indent = line.match(/^ +/)?.[0].length || 0;
    if (indent === 0) break;
    contentIndent ??= indent;
    if (indent < contentIndent) break;
    blockLines.push(line.slice(contentIndent));
  }
  while (blockLines.at(-1) === "") blockLines.pop();
  return block[1] === "|" ? blockLines.join("\n") : foldYamlLines(blockLines);
}

function foldYamlLines(lines: string[]): string {
  let result = "";
  let blankLines = 0;
  for (const line of lines) {
    if (line.length === 0) {
      blankLines += 1;
      continue;
    }
    if (result) result += blankLines > 0 ? "\n".repeat(blankLines) : " ";
    result += line;
    blankLines = 0;
  }
  return result;
}

function unquoteYamlScalar(value: string): string {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.at(-1) === quote) return value.slice(1, -1);
  return value;
}

export function slug(input: string): string {
  const value = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return value || "skill";
}
