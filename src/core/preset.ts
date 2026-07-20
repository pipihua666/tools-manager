import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openDb, type PresetRow, type SkillRow } from "./db";
import { readConfig } from "./config";
import { syncDir } from "./fs";
import { managerRoot } from "./paths";
import { getSkill } from "./skill";
import { toolAdapters, resolveTools, type ToolAdapter } from "./tools";
import { UsageError } from "./errors";

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
  const db = await openDb();
  const skill = db.query("SELECT id, name FROM skills WHERE name = ?").get(skillName) as { id: number; name: string } | null;
  if (!skill) throw new Error(`Skill not found: ${skillName}`);
  const from = db.query("SELECT id FROM presets WHERE name = ?").get(fromName) as { id: number } | null;
  if (!from) throw new Error(`Preset not found: ${fromName}`);
  const membership = db.query("SELECT 1 FROM preset_skills WHERE preset_id = ? AND skill_id = ?").get(from.id, skill.id);
  if (!membership) throw new Error(`Skill ${skillName} is not in preset ${fromName}`);

  db.query("INSERT OR IGNORE INTO presets (name) VALUES (?)").run(toName);
  const to = db.query("SELECT id FROM presets WHERE name = ?").get(toName) as { id: number };
  db.query("INSERT OR IGNORE INTO preset_skills (preset_id, skill_id) VALUES (?, ?)").run(to.id, skill.id);
  db.query("DELETE FROM preset_skills WHERE preset_id = ? AND skill_id = ?").run(from.id, skill.id);
  return { skill: skill.name, from: fromName, to: toName };
}

export async function removeSkillFromPreset(skillName: string, presetName: string): Promise<{ skill: string; preset: string }> {
  const db = await openDb();
  const skill = db.query("SELECT id, name FROM skills WHERE name = ?").get(skillName) as { id: number; name: string } | null;
  if (!skill) throw new Error(`Skill not found: ${skillName}`);
  const preset = db.query("SELECT id, name FROM presets WHERE name = ?").get(presetName) as { id: number; name: string } | null;
  if (!preset) throw new Error(`Preset not found: ${presetName}`);
  const result = db.query("DELETE FROM preset_skills WHERE preset_id = ? AND skill_id = ?").run(preset.id, skill.id);
  if (result.changes === 0) throw new Error(`Skill ${skillName} is not in preset ${presetName}`);
  return { skill: skill.name, preset: preset.name };
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
  for (const tool of tools) {
    for (const skill of skills) {
      const target = join(tool.skillsDir, skill.name);
      const appliedMode = await syncDir(skill.path, target, mode);
      results.push({ tool: tool.key, skill: skill.name, mode: appliedMode, target });
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
  for (const tool of tools) {
    const target = join(tool.skillsDir, skill.name);
    const appliedMode = await syncDir(skill.path, target, mode);
    results.push({ tool: tool.key, skill: skill.name, mode: appliedMode, target });
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
  const realAgentSkillDirs = new Set(toolAdapters.map((tool) => resolve(tool.skillsDir)));
  const selectedRealTools = tools.filter((tool) => realAgentSkillDirs.has(resolve(tool.skillsDir)));
  if (selectedRealTools.length === 0) return;

  throw new UsageError(
    `Refusing to symlink skills from temporary Tools Manager home (${root}) into real agent directories. ` +
      `Use a non-temporary TOOLS_MANAGER_HOME, set sync_mode = "copy", or pass test-only tool adapters.`,
  );
}
