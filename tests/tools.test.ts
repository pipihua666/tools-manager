import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isToolInstalled, type ToolAdapter } from "../src/core/tools";

let roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots = [];
});

async function adapter(overrides: Partial<ToolAdapter> = {}): Promise<ToolAdapter> {
  const root = await mkdtemp(join(tmpdir(), "tm-tool-"));
  roots.push(root);
  const detectPath = join(root, "config");
  await mkdir(detectPath);
  return {
    key: "cursor",
    displayName: "Test",
    detectPath,
    skillsDir: join(root, "skills"),
    projectSkillsDir: ".test/skills",
    mcpKind: "cursor-json",
    mcpPath: join(root, "mcp.json"),
    ...overrides,
  };
}

test("does not treat a config directory as an installed Agent when install hints exist", async () => {
  const tool = await adapter({ installCommands: ["tools-manager-definitely-missing-command"], installPaths: ["/tools-manager/definitely-missing.app"] });
  expect(await isToolInstalled(tool)).toBe(false);
});

test("detects an Agent from an application install path", async () => {
  const installRoot = await mkdtemp(join(tmpdir(), "tm-app-"));
  roots.push(installRoot);
  const tool = await adapter({ installPaths: [installRoot] });
  expect(await isToolInstalled(tool)).toBe(true);
});
