import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeDb } from "../src/core/db";
import { pathExists } from "../src/core/fs";
import { initManager } from "../src/core/init";
import { addSkills, getSkill } from "../src/core/skill";
import type { ToolAdapter } from "../src/core/tools";

let roots: string[] = [];

afterEach(async () => {
  closeDb();
  delete process.env.TOOLS_MANAGER_HOME;
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots = [];
});

async function tempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

test("does not add system skills to the managed store", async () => {
  const managerHome = await tempRoot("tm-home-");
  const sourceRoot = await tempRoot("tm-local-skills-");
  const systemRoot = await tempRoot("tm-system-skills-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  await mkdir(join(sourceRoot, "system-skill"), { recursive: true });
  await mkdir(join(sourceRoot, "user-skill"), { recursive: true });
  await mkdir(join(systemRoot, "system-skill"), { recursive: true });
  await writeFile(join(sourceRoot, "system-skill", "SKILL.md"), "---\nname: system-skill\ndescription: Copied system skill\n---\n");
  await writeFile(join(sourceRoot, "user-skill", "SKILL.md"), "---\nname: user-skill\ndescription: User skill\n---\n");
  await writeFile(join(systemRoot, "system-skill", "SKILL.md"), "---\nname: system-skill\ndescription: Read only\n---\n");
  const tool: ToolAdapter = {
    key: "codex",
    displayName: "Codex",
    detectPath: systemRoot,
    skillsDir: join(systemRoot, "user"),
    systemSkillsDirs: [systemRoot],
    projectSkillsDir: ".codex/skills",
    mcpKind: "codex-toml",
    mcpPath: join(systemRoot, "config.toml"),
    hookKind: "codex-notify",
    hookPath: join(systemRoot, "config.toml"),
  };

  await initManager();
  const skills = await addSkills(sourceRoot, { tools: [tool] });

  expect(skills.map((skill) => skill.name)).toEqual(["user-skill"]);
  expect(await getSkill("system-skill")).toBeNull();
  expect(await pathExists(join(managerHome, "skills", "system-skill"))).toBe(false);
});
