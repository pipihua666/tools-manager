import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db";
import { ensureDir, pathExists } from "./fs";
import { paths } from "./paths";
import { ensureConfig } from "./config";
import { addSkillToPreset, readSkillMetadata, slug } from "./skill";

export async function initManager(): Promise<void> {
  const p = paths();
  await ensureDir(p.root);
  await ensureDir(p.skillsDir);
  await ensureDir(p.cacheGitDir);
  await ensureDir(p.logsDir);
  await ensureConfig();
  await openDb();
  await installBuiltinSkills();
}

async function installBuiltinSkills(): Promise<void> {
  const builtinDirs = await findBuiltinSkillDirs();
  for (const sourceDir of builtinDirs) {
    await installBuiltinSkill(sourceDir, join(sourceDir, "SKILL.md"));
  }
}

async function findBuiltinSkillDirs(): Promise<string[]> {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", ".."),
    join(here, ".."),
  ];
  for (const candidate of candidates) {
    if (await pathExists(join(candidate, "SKILL.md"))) return [candidate];
  }
  return [];
}

async function installBuiltinSkill(sourceDir: string, skillFile: string): Promise<void> {
  const meta = await readSkillMetadata(skillFile);
  const name = slug(meta.name || sourceDir.split("/").at(-1) || "skill");
  const target = join(paths().skillsDir, name);
  await ensureDir(target);
  await Bun.write(join(target, "SKILL.md"), Bun.file(skillFile));
  const db = await openDb();
  db.query(`
    INSERT INTO skills (name, description, path, source_type, source_url, source_ref, source_subpath, source_commit, updated_at)
    VALUES (?, ?, ?, 'builtin', NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP)
    ON CONFLICT(name) DO UPDATE SET
      description = excluded.description,
      path = excluded.path,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      source_ref = excluded.source_ref,
      source_subpath = excluded.source_subpath,
      source_commit = excluded.source_commit,
      updated_at = CURRENT_TIMESTAMP
  `).run(name, meta.description, target);
  const skill = db.query("SELECT id FROM skills WHERE name = ?").get(name) as { id: number };
  await addSkillToPreset(skill.id);
}
