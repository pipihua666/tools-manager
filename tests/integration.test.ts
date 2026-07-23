import { afterEach, expect, test } from "bun:test";
import { lstat, mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runGit } from "../src/core/git";
import { initManager } from "../src/core/init";
import { addAllLocalAgentSkills, addCodexSkills, addLocalAgentSkills, addSkill, addSkills, getSkill, listAgentSkills, listSkills, removeSkill, removeSkillAgentLink } from "../src/core/skill";
import { applyPreset, createPreset, getPresetSkills, listPresets, movePreset, moveSkillPreset, moveSkillsPreset, removeSkillFromPreset, removeSkillsFromPreset, syncSkill } from "../src/core/preset";
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

test("init, add local skill, and default preset membership", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Local Skill\ndescription: Demo\n---\n");
  await initManager();
  const skill = await addSkill(skillDir);
  expect(skill.name).toBe("local-skill");
  const defaultSkills = (await getPresetSkills("Default")).map((item) => item.name).sort();
  expect(defaultSkills).toContain("local-skill");
  expect(defaultSkills).toContain("tools-manager");
});

test("imports a skill into the selected preset", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Work Skill\ndescription: Preset target\n---\n");
  await initManager();

  await addSkills(skillDir, "Work");

  expect((await getPresetSkills("Work")).map((skill) => skill.name)).toEqual(["work-skill"]);
  expect((await getPresetSkills("Default")).map((skill) => skill.name)).not.toContain("work-skill");
});

test("creates an empty preset with a unique name", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  await initManager();

  expect(await createPreset("  Work  ")).toMatchObject({ name: "Work", skill_count: 0 });
  expect((await listPresets()).find((preset) => preset.name === "Work")).toMatchObject({ skill_count: 0 });
  await expect(createPreset("work")).rejects.toThrow("Preset already exists: Work");
  await expect(createPreset("   ")).rejects.toThrow("Preset name cannot be empty");
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
  const defaultSkills = (await getPresetSkills("Default")).map((skill) => skill.name);
  expect(defaultSkills).toEqual(expect.arrayContaining(["multi-a", "multi-b", "tools-manager"]));
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
  expect((await getPresetSkills("Default")).map((skill) => skill.name)).toEqual(
    expect.arrayContaining(["remote-skill-a", "remote-skill-b", "remote-skill-c", "tools-manager"]),
  );
});

test("moves skills from one preset to another", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Preset Skill\ndescription: Demo\n---\n");
  await initManager();
  await addSkill(skillDir);

  const result = await movePreset("Default", "Work");

  expect(result).toEqual({ from: "Default", to: "Work", skillCount: 2 });
  const presets = await listPresets();
  expect(presets.find((preset) => preset.name === "Default")?.skill_count).toBe(0);
  expect(presets.find((preset) => preset.name === "Work")?.skill_count).toBe(2);
});

test("moves one skill from one preset to another", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const root = await tempRoot("tm-multi-skill-");
  await mkdir(join(root, "a"), { recursive: true });
  await mkdir(join(root, "b"), { recursive: true });
  await writeFile(join(root, "a", "SKILL.md"), "---\nname: Move A\ndescription: First\n---\n");
  await writeFile(join(root, "b", "SKILL.md"), "---\nname: Move B\ndescription: Second\n---\n");
  await initManager();
  await addSkills(root);

  const result = await moveSkillPreset("move-a", "Default", "Work");

  expect(result).toEqual({ skill: "move-a", from: "Default", to: "Work" });
  expect((await getPresetSkills("Default")).map((skill) => skill.name)).toEqual(["move-b", "tools-manager"]);
  expect((await getPresetSkills("Work")).map((skill) => skill.name)).toEqual(["move-a"]);
});

test("removes a skill from a preset without deleting the managed skill", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Preset Remove Only\ndescription: Demo\n---\n");
  await initManager();
  const skill = await addSkill(skillDir);

  const result = await removeSkillFromPreset("preset-remove-only", "Default");

  expect(result).toEqual({ skill: "preset-remove-only", preset: "Default" });
  expect((await getPresetSkills("Default")).map((item) => item.name)).not.toContain("preset-remove-only");
  expect(await getSkill("preset-remove-only")).not.toBeNull();
  expect(await pathExists(skill.path)).toBe(true);
});

test("moves and removes multiple preset skills atomically", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const root = await tempRoot("tm-batch-preset-skills-");
  await mkdir(join(root, "a"), { recursive: true });
  await mkdir(join(root, "b"), { recursive: true });
  await writeFile(join(root, "a", "SKILL.md"), "---\nname: Batch A\ndescription: First\n---\n");
  await writeFile(join(root, "b", "SKILL.md"), "---\nname: Batch B\ndescription: Second\n---\n");
  await initManager();
  await addSkills(root);

  await expect(moveSkillsPreset(["batch-a", "missing"], "Default", "Work")).rejects.toThrow("Skill not found: missing");
  expect((await getPresetSkills("Default")).map((skill) => skill.name)).toEqual(expect.arrayContaining(["batch-a", "batch-b"]));
  expect((await listPresets()).some((preset) => preset.name === "Work")).toBe(false);

  const moved = await moveSkillsPreset(["batch-a", "batch-b", "batch-a"], "Default", "Work");
  expect(moved).toEqual({ skills: ["batch-a", "batch-b"], from: "Default", to: "Work", count: 2 });
  expect((await getPresetSkills("Default")).map((skill) => skill.name)).not.toEqual(expect.arrayContaining(["batch-a", "batch-b"]));
  expect((await getPresetSkills("Work")).map((skill) => skill.name)).toEqual(["batch-a", "batch-b"]);
  await expect(moveSkillsPreset(["batch-a"], "Work", "Work")).rejects.toThrow("Source and destination presets must be different");

  await expect(removeSkillsFromPreset(["batch-a", "tools-manager"], "Work")).rejects.toThrow("Skill tools-manager is not in preset Work");
  expect((await getPresetSkills("Work")).map((skill) => skill.name)).toEqual(["batch-a", "batch-b"]);

  const removed = await removeSkillsFromPreset(["batch-a", "batch-b"], "Work");
  expect(removed).toEqual({ skills: ["batch-a", "batch-b"], preset: "Work", count: 2 });
  expect(await getPresetSkills("Work")).toEqual([]);
  expect(await getSkill("batch-a")).not.toBeNull();
  expect(await getSkill("batch-b")).not.toBeNull();
});

test("refuses to sync temporary manager skills into real agent directories", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Temp Sync Guard\ndescription: Demo\n---\n");
  await initManager();
  await addSkill(skillDir);

  await expect(applyPreset("Default", "codex")).rejects.toThrow("Refusing to symlink skills from temporary Tools Manager home");
});

test("applies preset with explicit copy sync mode", async () => {
  const managerHome = await tempRoot("tm-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  const skillDir = await tempRoot("tm-local-skill-");
  const agentRoot = await tempRoot("tm-agent-skills-");
  await writeFile(join(skillDir, "SKILL.md"), "---\nname: Copy Sync\ndescription: Demo\n---\n");
  await initManager();
  await addSkill(skillDir);

  const result = await applyPreset("Default", undefined, "copy", [fakeTool("codex", "Codex", agentRoot)]);
  const target = join(agentRoot, "copy-sync");

  expect(result).toContainEqual({ tool: "codex", skill: "copy-sync", mode: "copy", target });
  expect((await lstat(target)).isSymbolicLink()).toBe(false);
  expect(await pathExists(join(target, "SKILL.md"))).toBe(true);
});

test("syncs one managed skill without applying its whole preset", async () => {
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

test("removes skill record, files, and preset membership", async () => {
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
  expect((await getPresetSkills("Default")).map((item) => item.name)).toEqual(["tools-manager"]);
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
  const presets = await listPresets();
  expect(presets.find((preset) => preset.name === "Default")?.skill_count).toBeGreaterThanOrEqual(1);
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
  const defaultSkills = (await getPresetSkills("Default")).map((skill) => skill.name);
  expect(defaultSkills).toEqual(expect.arrayContaining(["codex-managed", "claude-managed", "tools-manager"]));
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

test("supports Codex skills in both tool-specific and shared agent directories", async () => {
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
  expect(synced.map((item) => item.target)).toEqual([
    join(codexRoot, "synced-codex"),
    join(sharedRoot, "synced-codex"),
  ]);

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
  };
}
