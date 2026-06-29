import { basename, join, resolve } from "node:path";
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import { openDb, type SkillRow } from "./db";
import { copyDir, ensureDir, pathExists, removePath, replaceWithSymlink } from "./fs";
import { paths, expandHome } from "./paths";
import { cloneGitSource, isGitSource, parseGitSource } from "./git";
import { assertUsage } from "./errors";
import { getTool, toolAdapters, type ToolAdapter } from "./tools";

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

export async function addSkill(source: string): Promise<SkillRow> {
  const skills = await addSkills(source);
  return skills[0]!;
}

export async function addSkills(source: string): Promise<SkillRow[]> {
  await ensureDir(paths().skillsDir);
  const resolved = isGitSource(source) ? await resolveGitImport(source) : await resolveLocalImport(source);
  const candidates = await findSkillCandidates(resolved.root);
  assertUsage(candidates.length > 0, `No skill found in ${resolved.root}. Expected SKILL.md or skill.md.`);
  const imported: SkillRow[] = [];
  for (const candidate of candidates) imported.push(await importCandidate(candidate, resolved.importSource));
  return imported;
}

export async function addCodexSkills(skillsDir = getTool("codex").skillsDir): Promise<SkillRow[]> {
  return addSkillsFromDirectory(skillsDir, "Codex");
}

export async function addLocalAgentSkills(toolInput: string, tools: ToolAdapter[] = toolAdapters): Promise<ToolSkillImportResult[]> {
  if (toolInput === "all") return addAllLocalAgentSkills(tools);
  const tool = tools.find((adapter) => adapter.key === toolInput) || getTool(toolInput);
  const skills = await addSkillsFromDirectory(tool.skillsDir, tool.displayName);
  return [{ tool: tool.key, skills, skipped: false }];
}

export async function addAllLocalAgentSkills(tools: ToolAdapter[] = toolAdapters): Promise<ToolSkillImportResult[]> {
  const results: ToolSkillImportResult[] = [];
  for (const tool of tools) {
    if (!(await pathExists(tool.skillsDir))) {
      results.push({ tool: tool.key, skills: [], skipped: true, reason: `Skills directory does not exist: ${tool.skillsDir}` });
      continue;
    }
    const skills = await addSkillsFromDirectory(tool.skillsDir, tool.displayName, { requireAny: false });
    results.push({ tool: tool.key, skills, skipped: false });
  }
  assertUsage(results.some((result) => result.skills.length > 0), "No local agent skills found.");
  return results;
}

export async function listAgentSkills(toolInput = "all", tools: ToolAdapter[] = toolAdapters): Promise<Array<{ tool: string; path: string; skills: AgentSkill[] }>> {
  const selected = toolInput === "all" ? tools : [tools.find((adapter) => adapter.key === toolInput) || getTool(toolInput)];
  const results: Array<{ tool: string; path: string; skills: AgentSkill[] }> = [];
  for (const tool of selected) {
    const skills: AgentSkill[] = [];
    let entries;
    try {
      entries = await readdir(tool.skillsDir, { withFileTypes: true });
    } catch {
      results.push({ tool: tool.key, path: tool.skillsDir, skills });
      continue;
    }
    for (const entry of entries) {
      if ((!entry.isDirectory() && !entry.isSymbolicLink()) || entry.name.startsWith(".")) continue;
      const dir = join(tool.skillsDir, entry.name);
      const skillFile = await findSkillFile(dir);
      if (!skillFile) continue;
      const meta = await readSkillMetadata(skillFile);
      skills.push({
        tool: tool.key,
        name: slug(meta.name || entry.name),
        description: meta.description,
        path: dir,
      });
    }
    skills.sort((a, b) => a.name.localeCompare(b.name));
    results.push({ tool: tool.key, path: tool.skillsDir, skills });
  }
  return results;
}

async function addSkillsFromDirectory(skillsDir: string, label: string, options: { requireAny?: boolean } = {}): Promise<SkillRow[]> {
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
      ? await importCandidate({ dir: existingManagedDir, skillFile: (await findSkillFile(existingManagedDir))! }, { sourceType: "local" }, { copy: false })
      : await addSkill(dir);
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

async function importCandidate(candidate: SkillCandidate, source: SkillImportSource, options: { copy?: boolean } = {}): Promise<SkillRow> {
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
  await addSkillToPreset(skill.id);
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
  return db.query("SELECT * FROM skills ORDER BY name").all() as SkillRow[];
}

export async function getSkill(name: string): Promise<SkillRow | null> {
  const db = await openDb();
  return (db.query("SELECT * FROM skills WHERE name = ?").get(name) as SkillRow | null) || null;
}

export async function findSkillAgentLinks(skill: SkillRow, tools: ToolAdapter[] = toolAdapters): Promise<SkillAgentLink[]> {
  const target = await realpath(skill.path).catch(() => resolve(skill.path));
  const links: SkillAgentLink[] = [];
  for (const tool of tools) {
    const path = join(tool.skillsDir, skill.name);
    try {
      if (!(await lstat(path)).isSymbolicLink()) continue;
      if ((await realpath(path)) === target) links.push({ tool: tool.key, path });
    } catch {
      continue;
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

export async function skillMarkdownSummary(skill: SkillRow): Promise<string> {
  const file = (await findSkillFile(skill.path)) || join(skill.path, "SKILL.md");
  const markdown = await readFile(file, "utf8");
  return markdown.split("\n").slice(0, 40).join("\n");
}

export async function readSkillMetadata(skillFile: string): Promise<{ name: string | null; description: string | null }> {
  const text = await readFile(skillFile, "utf8");
  const frontmatter = text.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter?.[1]) return { name: null, description: null };
  return {
    name: readYamlScalar(frontmatter[1], "name") || null,
    description: readYamlScalar(frontmatter[1], "description") || null,
  };
}

function readYamlScalar(text: string, key: string): string | undefined {
  const match = text.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim().replace(/^["']|["']$/g, "");
}

export function slug(input: string): string {
  const value = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return value || "skill";
}
