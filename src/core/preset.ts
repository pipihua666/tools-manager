import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openDb, type PresetRow, type SkillRow } from "./db";
import { readConfig } from "./config";
import { syncDir } from "./fs";
import { managerRoot } from "./paths";
import { getSkill } from "./skill";
import { getToolSkillsDirs, toolAdapters, resolveTools, type ToolAdapter } from "./tools";
import { assertUsage, UsageError } from "./errors";

export type PresetSummary = PresetRow & {
  skill_count: number;
};

export type SyncMode = "symlink" | "copy";

export async function listPresets(): Promise<PresetSummary[]> {
  const db = await openDb();
  return db.query(`
    SELECT p.*, COUNT(ps.skill_id) AS skill_count
    FROM presets p
    LEFT JOIN preset_skills ps ON ps.preset_id = p.id
    GROUP BY p.id
    ORDER BY p.name
  `).all() as PresetSummary[];
}

export async function createPreset(input: string): Promise<PresetSummary> {
  const name = input.trim();
  assertUsage(name.length > 0, "Preset name cannot be empty.");
  assertUsage(name.length <= 80, "Preset name must be 80 characters or fewer.");
  const db = await openDb();
  const existing = db.query("SELECT name FROM presets WHERE name = ? COLLATE NOCASE").get(name) as { name: string } | null;
  assertUsage(!existing, `Preset already exists: ${existing?.name || name}`);
  db.query("INSERT INTO presets (name) VALUES (?)").run(name);
  return db.query(`
    SELECT p.*, 0 AS skill_count
    FROM presets p
    WHERE p.name = ?
  `).get(name) as PresetSummary;
}

export async function getPresetSkills(presetName: string): Promise<SkillRow[]> {
  const db = await openDb();
  return db.query(`
    SELECT s.*
    FROM skills s
    JOIN preset_skills ps ON ps.skill_id = s.id
    JOIN presets p ON p.id = ps.preset_id
    WHERE p.name = ?
    ORDER BY s.name
  `).all(presetName) as SkillRow[];
}

export async function movePreset(fromName: string, toName: string): Promise<{ from: string; to: string; skillCount: number }> {
  const db = await openDb();
  const from = db.query("SELECT id FROM presets WHERE name = ?").get(fromName) as { id: number } | null;
  if (!from) throw new Error(`Preset not found: ${fromName}`);
  db.query("INSERT OR IGNORE INTO presets (name) VALUES (?)").run(toName);
  const to = db.query("SELECT id FROM presets WHERE name = ?").get(toName) as { id: number };
  db.query(`
    INSERT OR IGNORE INTO preset_skills (preset_id, skill_id)
    SELECT ?, skill_id
    FROM preset_skills
    WHERE preset_id = ?
  `).run(to.id, from.id);
  db.query("DELETE FROM preset_skills WHERE preset_id = ?").run(from.id);
  const skillCount = (db.query("SELECT COUNT(*) AS count FROM preset_skills WHERE preset_id = ?").get(to.id) as { count: number }).count;
  return { from: fromName, to: toName, skillCount };
}

export async function moveSkillPreset(skillName: string, fromName: string, toName: string): Promise<{ skill: string; from: string; to: string }> {
  const result = await moveSkillsPreset([skillName], fromName, toName);
  return { skill: result.skills[0]!, from: result.from, to: result.to };
}

export async function moveSkillsPreset(skillNames: string[], fromName: string, toName: string): Promise<{ skills: string[]; from: string; to: string; count: number }> {
  const db = await openDb();
  const names = normalizeSkillNames(skillNames);
  assertUsage(fromName !== toName, "Source and destination presets must be different.");
  const from = db.query("SELECT id FROM presets WHERE name = ?").get(fromName) as { id: number } | null;
  if (!from) throw new Error(`Preset not found: ${fromName}`);
  const skills = names.map((name) => {
    const skill = db.query("SELECT id, name FROM skills WHERE name = ?").get(name) as { id: number; name: string } | null;
    if (!skill) throw new Error(`Skill not found: ${name}`);
    const membership = db.query("SELECT 1 FROM preset_skills WHERE preset_id = ? AND skill_id = ?").get(from.id, skill.id);
    if (!membership) throw new Error(`Skill ${name} is not in preset ${fromName}`);
    return skill;
  });

  db.transaction(() => {
    db.query("INSERT OR IGNORE INTO presets (name) VALUES (?)").run(toName);
    const to = db.query("SELECT id FROM presets WHERE name = ?").get(toName) as { id: number };
    for (const skill of skills) {
      db.query("INSERT OR IGNORE INTO preset_skills (preset_id, skill_id) VALUES (?, ?)").run(to.id, skill.id);
      db.query("DELETE FROM preset_skills WHERE preset_id = ? AND skill_id = ?").run(from.id, skill.id);
    }
  })();
  return { skills: skills.map((skill) => skill.name), from: fromName, to: toName, count: skills.length };
}

export async function removeSkillFromPreset(skillName: string, presetName: string): Promise<{ skill: string; preset: string }> {
  const result = await removeSkillsFromPreset([skillName], presetName);
  return { skill: result.skills[0]!, preset: result.preset };
}

export async function removeSkillsFromPreset(skillNames: string[], presetName: string): Promise<{ skills: string[]; preset: string; count: number }> {
  const db = await openDb();
  const names = normalizeSkillNames(skillNames);
  const preset = db.query("SELECT id, name FROM presets WHERE name = ?").get(presetName) as { id: number; name: string } | null;
  if (!preset) throw new Error(`Preset not found: ${presetName}`);
  const skills = names.map((name) => {
    const skill = db.query("SELECT id, name FROM skills WHERE name = ?").get(name) as { id: number; name: string } | null;
    if (!skill) throw new Error(`Skill not found: ${name}`);
    const membership = db.query("SELECT 1 FROM preset_skills WHERE preset_id = ? AND skill_id = ?").get(preset.id, skill.id);
    if (!membership) throw new Error(`Skill ${name} is not in preset ${presetName}`);
    return skill;
  });

  db.transaction(() => {
    for (const skill of skills) db.query("DELETE FROM preset_skills WHERE preset_id = ? AND skill_id = ?").run(preset.id, skill.id);
  })();
  return { skills: skills.map((skill) => skill.name), preset: preset.name, count: skills.length };
}

function normalizeSkillNames(values: string[]): string[] {
  const names = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  assertUsage(names.length > 0, "Select at least one skill.");
  return names;
}

export async function applyPreset(presetName: string, toolInput?: string, syncMode?: SyncMode, adapters?: ToolAdapter[]): Promise<Array<{ tool: string; skill: string; mode: string; target: string }>> {
  const skills = await getPresetSkills(presetName);
  if (skills.length === 0) {
    throw new Error(`Preset not found or empty: ${presetName}`);
  }
  const config = await readConfig();
  const tools = adapters ? resolveSelectedTools(toolInput, adapters) : resolveTools(toolInput);
  const mode = syncMode || config.syncMode;
  assertNoTempManagerSymlinkToRealAgents(mode, tools);
  const results: Array<{ tool: string; skill: string; mode: string; target: string }> = [];
  const syncedTargets = new Map<string, string>();
  for (const tool of tools) {
    for (const skill of skills) {
      for (const skillsDir of getToolSkillsDirs(tool)) {
        const target = join(skillsDir, skill.name);
        const appliedMode = syncedTargets.get(target) || await syncDir(skill.path, target, mode);
        syncedTargets.set(target, appliedMode);
        results.push({ tool: tool.key, skill: skill.name, mode: appliedMode, target });
      }
    }
  }
  return results;
}

export async function syncSkill(skillName: string, toolInput?: string, syncMode?: SyncMode, adapters?: ToolAdapter[]): Promise<Array<{ tool: string; skill: string; mode: string; target: string }>> {
  const skill = await getSkill(skillName);
  if (!skill) throw new Error(`Skill not found: ${skillName}`);
  const config = await readConfig();
  const tools = adapters ? resolveSelectedTools(toolInput, adapters) : resolveTools(toolInput);
  const mode = syncMode || config.syncMode;
  assertNoTempManagerSymlinkToRealAgents(mode, tools);
  const results: Array<{ tool: string; skill: string; mode: string; target: string }> = [];
  const syncedTargets = new Map<string, string>();
  for (const tool of tools) {
    for (const skillsDir of getToolSkillsDirs(tool)) {
      const target = join(skillsDir, skill.name);
      const appliedMode = syncedTargets.get(target) || await syncDir(skill.path, target, mode);
      syncedTargets.set(target, appliedMode);
      results.push({ tool: tool.key, skill: skill.name, mode: appliedMode, target });
    }
  }
  return results;
}

function resolveSelectedTools(toolInput: string | undefined, adapters: ToolAdapter[]): ToolAdapter[] {
  if (!toolInput || toolInput === "all") return adapters;
  const tool = adapters.find((adapter) => adapter.key === toolInput);
  if (!tool) throw new Error(`Unknown tool: ${toolInput}. Expected one of: ${adapters.map((adapter) => adapter.key).join(", ")}`);
  return [tool];
}

function assertNoTempManagerSymlinkToRealAgents(syncMode: SyncMode, tools: ReturnType<typeof resolveTools>): void {
  if (syncMode !== "symlink") return;
  const root = resolve(managerRoot());
  const tmp = resolve(tmpdir());
  if (!root.startsWith(`${tmp}/`)) return;
  const realAgentSkillDirs = new Set(toolAdapters.flatMap(getToolSkillsDirs).map((dir) => resolve(dir)));
  const selectedRealTools = tools.filter((tool) => getToolSkillsDirs(tool).some((dir) => realAgentSkillDirs.has(resolve(dir))));
  if (selectedRealTools.length === 0) return;

  throw new UsageError(
    `Refusing to symlink skills from temporary Tools Manager home (${root}) into real agent directories. ` +
      `Use a non-temporary TOOLS_MANAGER_HOME, set sync_mode = "copy", or pass test-only tool adapters.`,
  );
}
