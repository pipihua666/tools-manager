import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { lstat, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runGit } from "../src/core/git";
import { initManager } from "../src/core/init";
import { addAllLocalAgentSkills, addCodexSkills, addLocalAgentSkills, addSkill, addSkills, getSkill, listAgentSkills, listSkills, removeSkill, removeSkillAgentLink, syncSkill } from "../src/core/skill";
import { closeDb } from "../src/core/db";
import { pathExists } from "../src/core/fs";
import { getTool, getToolSkillsDirs, type ToolAdapter } from "../src/core/tools";
import { listAgentOverview } from "../src/core/agent";

let roots: string[] = [];

afterEach(async () => {
  closeDb();
  delete process.env.TOOLS_MANAGER_HOME;
  await Promise.all(roots.map((dir) => rm(dir, { recursive: true, force: true })));
  roots = [];
});

async function tempRoot(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

test("removes legacy preset tables during migration", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const legacy = new Database(join(managerHome, "tools-manager.db"), { create: true });
  legacy.exec(`
    CREATE TABLE presets (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
    CREATE TABLE preset_skills (preset_id INTEGER NOT NULL, skill_id INTEGER NOT NULL);
    INSERT INTO presets (name) VALUES ('Legacy');
  `);
  legacy.close();

  await initManager();
  const migrated = new Database(join(managerHome, "tools-manager.db"), { readonly: true });
  const tables = migrated.query("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
  migrated.close();

  expect(tables.map((table) => table.name)).not.toContain("presets");
  expect(tables.map((table) => table.name)).not.toContain("preset_skills");
});

test("initializes and adds a local skill to the managed registry", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Local Skill\ndescription: Demo\n---\n");
  await initManager();
  const skill = await addSkill(skillDir);
  expect(skill.name).toBe("local-skill");
  expect((await listSkills()).map((item) => item.name)).toEqual(expect.arrayContaining(["local-skill", "tools-manager"]));
});

test("adds multiple skills from one source and updates existing skills", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const root = await tempRoot("tm-multi-skill-");
  await mkdir(join(root, "a"), { recursive: true });
  await mkdir(join(root, "b"), { recursive: true });
  await writeFile(join(root, "a", "SKILL.md"), "---\nname: Multi A\ndescription: First\n---\n");
  await writeFile(join(root, "b", "SKILL.md"), "---\nname: Multi B\ndescription: Second\n---\n");
  await initManager();

  const imported = await addSkills(root);
  await writeFile(join(root, "a", "SKILL.md"), "---\nname: Multi A\ndescription: Updated\n---\n");
  const updated = await addSkills(root);

  expect(imported.map((skill) => skill.name).sort()).toEqual(["multi-a", "multi-b"]);
  expect(updated.map((skill) => skill.name).sort()).toEqual(["multi-a", "multi-b"]);
  expect((await getSkill("multi-a"))?.description).toBe("Updated");
  expect((await listSkills()).map((skill) => skill.name)).toEqual(expect.arrayContaining(["multi-a", "multi-b", "tools-manager"]));
});

test("refreshes a stored skill description from multiline frontmatter", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Folded Skill\ndescription: Old description\n---\n");
  await initManager();
  const skill = await addSkill(skillDir);
  await writeFile(join(skill.path, "SKILL.md"), "---\nname: Folded Skill\ndescription: >-\n  First description line.\n  Second description line.\n---\n");

  expect((await getSkill("folded-skill"))?.description).toBe("First description line. Second description line.");
  expect((await listSkills()).find((item) => item.name === "folded-skill")?.description).toBe("First description line. Second description line.");
});

test("adds multiple skills from a remote repository skills directory", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const repo = await tempRoot("tm-remote-skills-");
  await mkdir(join(repo, "skills", "skill-a"), { recursive: true });
  await mkdir(join(repo, "skills", "skill-b"), { recursive: true });
  await mkdir(join(repo, "skills", "skill-c"), { recursive: true });
  await writeFile(join(repo, "skills", "skill-a", "SKILL.md"), "---\nname: Remote Skill A\ndescription: First\n---\n");
  await writeFile(join(repo, "skills", "skill-b", "SKILL.md"), "---\nname: Remote Skill B\ndescription: Second\n---\n");
  await writeFile(join(repo, "skills", "skill-c", "SKILL.md"), "---\nname: Remote Skill C\ndescription: Third\n---\n");
  runGit(["-C", repo, "init", "-b", "main"], "Failed to initialize test repository.");
  runGit(["-C", repo, "add", "."], "Failed to stage test repository.");
  runGit(["-C", repo, "-c", "user.name=Tools Manager Test", "-c", "user.email=test@example.com", "commit", "-m", "add skills"], "Failed to commit test repository.");

  await initManager();
  const imported = await addSkills(`file://${repo}#main:skills`);
  const importedFromRoot = await addSkills(`file://${repo}#main`);

  expect(imported.map((skill) => skill.name).sort()).toEqual(["remote-skill-a", "remote-skill-b", "remote-skill-c"]);
  expect(importedFromRoot.map((skill) => skill.name).sort()).toEqual(["remote-skill-a", "remote-skill-b", "remote-skill-c"]);
  expect((await listSkills()).map((skill) => skill.name)).toEqual(
    expect.arrayContaining(["remote-skill-a", "remote-skill-b", "remote-skill-c", "tools-manager"]),
  );
});

test("refuses to sync temporary manager skills into real agent directories", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Temp Sync Guard\ndescription: Demo\n---\n");
  await initManager();
  await addSkill(skillDir);

  await expect(syncSkill("temp-sync-guard", "codex")).rejects.toThrow("Refusing to symlink skills from temporary Tools Manager home");
});

test("syncs a skill with explicit copy mode", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  const agentRoot = await tempRoot("tm-agent-skills-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Copy Sync\ndescription: Demo\n---\n");
  await initManager();
  await addSkill(skillDir);

  const result = await syncSkill("copy-sync", undefined, "copy", [fakeTool("codex", "Codex", agentRoot)]);
  const target = join(agentRoot, "copy-sync");

  expect(result).toContainEqual({ tool: "codex", skill: "copy-sync", mode: "copy", target });
  expect((await lstat(target)).isSymbolicLink()).toBe(false);
  expect(await pathExists(join(target, "SKILL.md"))).toBe(true);
});

test("syncs one managed skill without syncing other skills", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const firstDir = await tempRoot("tm-local-skill-");
  const secondDir = await tempRoot("tm-local-skill-");
  const agentRoot = await tempRoot("tm-agent-skills-");
  await writeFile(join(firstDir, "SKILL.md"), "---\nname: Sync Only This\ndescription: Demo\n---\n");
  await writeFile(join(secondDir, "SKILL.md"), "---\nname: Leave This\ndescription: Demo\n---\n");
  await initManager();
  await addSkill(firstDir);
  await addSkill(secondDir);

  const result = await syncSkill("sync-only-this", "codex", "copy", [fakeTool("codex", "Codex", agentRoot)]);

  expect(result).toHaveLength(1);
  expect(await pathExists(join(agentRoot, "sync-only-this", "SKILL.md"))).toBe(true);
  expect(await pathExists(join(agentRoot, "leave-this"))).toBe(false);
});

test("removes skill record and files", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Remove Me\ndescription: Demo\n---\n");
  await initManager();
  const skill = await addSkill(skillDir);

  const removed = await removeSkill("remove-me");

  expect(removed.skill.name).toBe("remove-me");
  expect(await getSkill("remove-me")).toBeNull();
  expect(await pathExists(skill.path)).toBe(false);
});

test("removes agent symlinks that point to managed skill", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  const agentRoot = await tempRoot("tm-agent-skills-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Linked Remove\ndescription: Demo\n---\n");
  await initManager();
  const skill = await addSkill(skillDir);
  const agentLink = join(agentRoot, "linked-remove");
  await symlink(skill.path, agentLink, "dir");

  const removed = await removeSkill("linked-remove", { removeAgentLinks: true, tools: [fakeTool("codex", "Codex", agentRoot)] });

  expect(removed.agentLinks).toEqual([{ tool: "codex", path: agentLink }]);
  expect(await pathExists(skill.path)).toBe(false);
  expect(await pathExists(agentLink)).toBe(false);
});

test("removes one agent symlink without deleting the managed skill", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  const codexRoot = await tempRoot("tm-codex-skills-");
  const cursorRoot = await tempRoot("tm-cursor-skills-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Agent Only Remove\ndescription: Demo\n---\n");
  await initManager();
  const skill = await addSkill(skillDir);
  const codexLink = join(codexRoot, "agent-only-remove");
  const cursorLink = join(cursorRoot, "agent-only-remove");
  await symlink(skill.path, codexLink, "dir");
  await symlink(skill.path, cursorLink, "dir");

  const removed = await removeSkillAgentLink("agent-only-remove", "codex", [
    fakeTool("codex", "Codex", codexRoot),
    fakeTool("cursor", "Cursor", cursorRoot),
  ]);

  expect(removed.agentLink).toEqual({ tool: "codex", path: codexLink });
  expect(await getSkill("agent-only-remove")).not.toBeNull();
  expect(await pathExists(skill.path)).toBe(true);
  expect(await pathExists(codexLink)).toBe(false);
  expect(await pathExists(cursorLink)).toBe(true);
});

test("adds direct Codex skills into manager", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const codexRoot = await tempRoot("tm-codex-skills-");
  const codexSkill = join(codexRoot, "tm-test-codex-import");
  await mkdir(codexSkill, { recursive: true });
  await writeFile(join(codexSkill, "SKILL.md"), "---\nname: Codex Import\ndescription: Existing Codex skill\n---\n");
  await mkdir(join(codexRoot, "tm-test-not-a-skill"), { recursive: true });
  await writeFile(join(codexRoot, "tm-test-not-a-skill", "README.md"), "# Not a skill\n");

  await initManager();
  const skills = await addCodexSkills(codexRoot);

  expect(skills.some((skill) => skill.name === "codex-import")).toBe(true);
  expect(skills.some((skill) => skill.name === "tm-test-not-a-skill")).toBe(false);
  expect((await lstat(codexSkill)).isSymbolicLink()).toBe(true);
  expect((await listSkills()).some((skill) => skill.name === "codex-import")).toBe(true);
});

test("adds skills from all local agent directories", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const codexRoot = await tempRoot("tm-codex-skills-");
  const claudeRoot = await tempRoot("tm-claude-skills-");
  const missingRoot = join(await tempRoot("tm-missing-parent-"), "missing");
  await mkdir(join(codexRoot, "codex-skill"), { recursive: true });
  await writeFile(join(codexRoot, "codex-skill", "SKILL.md"), "---\nname: Codex Managed\n---\n");
  await mkdir(join(claudeRoot, "claude-skill"), { recursive: true });
  await writeFile(join(claudeRoot, "claude-skill", "SKILL.md"), "---\nname: Claude Managed\n---\n");
  const tools = [
    fakeTool("codex", "Codex", codexRoot),
    fakeTool("claude_code", "Claude Code", claudeRoot),
    fakeTool("cursor", "Cursor", missingRoot),
  ];

  await initManager();
  const result = await addAllLocalAgentSkills(tools);

  expect(result.find((tool) => tool.tool === "codex")?.skills.map((skill) => skill.name)).toEqual(["codex-managed"]);
  expect(result.find((tool) => tool.tool === "claude_code")?.skills.map((skill) => skill.name)).toEqual(["claude-managed"]);
  expect(result.find((tool) => tool.tool === "cursor")?.skipped).toBe(true);
  expect((await lstat(join(codexRoot, "codex-skill"))).isSymbolicLink()).toBe(true);
  expect((await lstat(join(claudeRoot, "claude-skill"))).isSymbolicLink()).toBe(true);
  const secondResult = await addAllLocalAgentSkills(tools);
  expect(secondResult.find((tool) => tool.tool === "codex")?.skills.map((skill) => skill.name)).toEqual(["codex-managed"]);
  expect((await listSkills()).map((skill) => skill.name)).toEqual(expect.arrayContaining(["codex-managed", "claude-managed", "tools-manager"]));
});

test("adds skills from a selected local agent", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const codexRoot = await tempRoot("tm-codex-skills-");
  await mkdir(join(codexRoot, "codex-skill"), { recursive: true });
  await writeFile(join(codexRoot, "codex-skill", "SKILL.md"), "---\nname: Codex Selected\n---\n");
  const tool = fakeTool("codex", "Codex", codexRoot);

  await initManager();
  const result = await addLocalAgentSkills(tool.key, [tool]);

  expect(result).toHaveLength(1);
  expect(result[0]?.tool).toBe("codex");
  expect(result[0]?.skills.map((skill) => skill.name)).toEqual(["codex-selected"]);
  expect((await lstat(join(codexRoot, "codex-skill"))).isSymbolicLink()).toBe(true);
});

test("supports shared Agent skill imports without cross-syncing a selected Agent", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const codexRoot = await tempRoot("tm-codex-skills-");
  const sharedRoot = await tempRoot("tm-shared-skills-");
  const sourceDir = await tempRoot("tm-local-skill-");
  await mkdir(join(sharedRoot, "shared-codex"), { recursive: true });
  await writeFile(join(sharedRoot, "shared-codex", "SKILL.md"), "---\nname: Shared Codex\ndescription: Shared agent skill\n---\n");
  await writeFile(join(sourceDir, "SKILL.md"), "---\nname: Synced Codex\ndescription: Synced to both roots\n---\n");
  const tool = {
    ...fakeTool("codex", "Codex", codexRoot),
    additionalSkillsDirs: [sharedRoot],
  };

  await initManager();
  const imported = await addLocalAgentSkills("codex", [tool]);
  expect(imported[0]?.skills.map((skill) => skill.name)).toEqual(["shared-codex"]);
  expect((await lstat(join(sharedRoot, "shared-codex"))).isSymbolicLink()).toBe(true);

  await addSkill(sourceDir);
  const synced = await syncSkill("synced-codex", "codex", "symlink", [tool]);
  expect(synced.map((item) => item.target)).toEqual([join(codexRoot, "synced-codex")]);
  expect(await pathExists(join(sharedRoot, "synced-codex"))).toBe(false);

  const listed = await listAgentSkills("codex", [tool]);
  expect(listed[0]?.skills.map((skill) => skill.name)).toEqual(["shared-codex", "synced-codex"]);
  expect(listed[0]?.paths).toEqual([codexRoot, sharedRoot]);

  await removeSkillAgentLink("synced-codex", "codex", [tool]);
  expect(await pathExists(join(codexRoot, "synced-codex"))).toBe(false);
  expect(await pathExists(join(sharedRoot, "synced-codex"))).toBe(false);
});

test("configures the shared agent skills directory for Codex and Claude Code", () => {
  for (const toolKey of ["codex", "claude_code"] as const) {
    expect(getToolSkillsDirs(getTool(toolKey)).some((dir) => dir.endsWith("/.agents/skills"))).toBe(true);
  }
});

test("lists skills and MCP servers for each agent", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const codexRoot = await tempRoot("tm-codex-skills-");
  const cursorRoot = await tempRoot("tm-cursor-skills-");
  await mkdir(join(codexRoot, "codex-skill"), { recursive: true });
  await writeFile(join(codexRoot, "codex-skill", "SKILL.md"), "---\nname: Codex Visible\ndescription: Codex skill\n---\n");
  await writeFile(join(codexRoot, "config.toml"), '[mcp_servers.playwright]\ncommand = "npx"\nargs = ["@playwright/mcp@latest"]\n');
  await writeFile(join(cursorRoot, "config.toml"), '{"mcpServers":{"filesystem":{"command":"npx","args":["-y","@modelcontextprotocol/server-filesystem"]}}}');
  const tools = [
    fakeTool("codex", "Codex", codexRoot),
    { ...fakeTool("cursor", "Cursor", cursorRoot), mcpKind: "cursor-json" as const },
  ];

  await initManager();
  const result = await listAgentOverview("all", tools);

  expect(result.map((agent) => agent.tool)).toEqual(["codex", "cursor"]);
  expect(result.find((agent) => agent.tool === "codex")?.skillsPaths).toEqual([codexRoot]);
  expect(result.find((agent) => agent.tool === "codex")?.skills.map((skill) => skill.name)).toEqual(["codex-visible"]);
  expect(result.find((agent) => agent.tool === "codex")?.mcpServers.map((server) => server.name)).toEqual(["playwright"]);
  expect(result.find((agent) => agent.tool === "cursor")?.mcpServers.map((server) => server.name)).toEqual(["filesystem"]);
});

function fakeTool(key: ToolAdapter["key"], displayName: string, skillsDir: string): ToolAdapter {
  return {
    key,
    displayName,
    detectPath: skillsDir,
    skillsDir,
    projectSkillsDir: ".skills",
    mcpKind: "codex-toml",
    mcpPath: join(skillsDir, "config.toml"),
    hookKind: "codex-notify",
    hookPath: join(skillsDir, "config.toml"),
  };
}
