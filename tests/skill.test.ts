import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findSkillCandidates, listAgentSkills, readAgentSkillMarkdown, readSkillMetadata } from "../src/core/skill";
import type { ToolAdapter } from "../src/core/tools";

let tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs = [];
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tm-skill-test-"));
  tempDirs.push(dir);
  return dir;
}

test("finds SKILL.md and skill.md", async () => {
  const root = await tempDir();
  await mkdir(join(root, "a"), { recursive: true });
  await mkdir(join(root, "b"), { recursive: true });
  await writeFile(join(root, "a", "SKILL.md"), "---\nname: A\n---\n");
  await writeFile(join(root, "b", "skill.md"), "---\nname: B\n---\n");
  const candidates = await findSkillCandidates(root);
  expect(candidates.map((candidate) => candidate.dir).sort()).toEqual([join(root, "a"), join(root, "b")].sort());
});

test("ignores README-only directories", async () => {
  const root = await tempDir();
  await mkdir(join(root, "docs"), { recursive: true });
  await writeFile(join(root, "docs", "README.md"), "# docs\n");
  expect(await findSkillCandidates(root)).toEqual([]);
});

test("reads an Agent skill document for read-only details", async () => {
  const root = await tempDir();
  await writeFile(join(root, "SKILL.md"), "# Read-only Agent Skill\n");

  const markdown = await readAgentSkillMarkdown({
    tool: "codex",
    name: "read-only-agent-skill",
    description: "Agent-side skill",
    path: root,
    scope: "user",
    editable: false,
  });

  expect(markdown).toBe("# Read-only Agent Skill\n");
});

test("classifies user and system Agent skills by location", async () => {
  const root = await tempDir();
  const userRoot = join(root, "user");
  const systemRoot = join(root, "system");
  await mkdir(join(userRoot, "user-skill"), { recursive: true });
  await mkdir(join(systemRoot, "system-skill"), { recursive: true });
  await writeFile(join(userRoot, "user-skill", "SKILL.md"), "---\nname: User Skill\ndescription: Editable\n---\n");
  await writeFile(join(systemRoot, "system-skill", "SKILL.md"), "---\nname: System Skill\ndescription: Read only\n---\n");
  const tool: ToolAdapter = {
    key: "codex",
    displayName: "Codex",
    detectPath: root,
    skillsDir: userRoot,
    systemSkillsDirs: [systemRoot],
    projectSkillsDir: ".codex/skills",
    mcpKind: "codex-toml",
    mcpPath: join(root, "config.toml"),
  };

  const skills = (await listAgentSkills("codex", [tool]))[0]!.skills;
  expect(skills.map(({ name, scope, editable }) => ({ name, scope, editable }))).toEqual([
    { name: "system-skill", scope: "system", editable: false },
    { name: "user-skill", scope: "user", editable: false },
  ]);
});

test("reads a folded multiline skill description", async () => {
  const root = await tempDir();
  const skillFile = join(root, "SKILL.md");
  await writeFile(skillFile, `---
name: agent-reach
description: >
  MUST USE when user wants to research or search.
  Supports multiple sources.

  Use it for external information.
---
`);

  expect(await readSkillMetadata(skillFile)).toEqual({
    name: "agent-reach",
    description: "MUST USE when user wants to research or search. Supports multiple sources.\nUse it for external information.",
  });
});

test("preserves line breaks in a literal multiline skill description", async () => {
  const root = await tempDir();
  const skillFile = join(root, "SKILL.md");
  await writeFile(skillFile, "---\r\nname: literal\r\ndescription: |-\r\n  First line.\r\n  Second line.\r\n---\r\n");

  expect(await readSkillMetadata(skillFile)).toEqual({
    name: "literal",
    description: "First line.\nSecond line.",
  });
});
