import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let roots: string[] = [];

async function runCli(managerHome: string, ...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const child = Bun.spawn([process.execPath, "run", join(import.meta.dir, "..", "src", "cli.ts"), ...args], {
    env: { ...Bun.env, TOOLS_MANAGER_HOME: managerHome },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

afterEach(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots = [];
});

test("creates a preset through the CLI", async () => {
  const managerHome = await mkdtemp(join(tmpdir(), "tm-cli-home-"));
  roots.push(managerHome);
  const { exitCode, stdout, stderr } = await runCli(managerHome, "presets", "create", "CLI Work", "--json");

  expect(stderr).toBe("");
  expect(exitCode).toBe(0);
  expect(JSON.parse(stdout)).toMatchObject({ name: "CLI Work", skill_count: 0 });
});

test("moves and removes multiple preset skills through the CLI", async () => {
  const managerHome = await mkdtemp(join(tmpdir(), "tm-cli-home-"));
  const skillSource = await mkdtemp(join(tmpdir(), "tm-cli-skills-"));
  roots.push(managerHome, skillSource);
  await mkdir(join(skillSource, "a"), { recursive: true });
  await mkdir(join(skillSource, "b"), { recursive: true });
  await writeFile(join(skillSource, "a", "SKILL.md"), "---\nname: CLI Batch A\ndescription: First\n---\n");
  await writeFile(join(skillSource, "b", "SKILL.md"), "---\nname: CLI Batch B\ndescription: Second\n---\n");

  expect((await runCli(managerHome, "init")).exitCode).toBe(0);
  expect((await runCli(managerHome, "skills", "add", skillSource, "--json")).exitCode).toBe(0);
  const moved = await runCli(managerHome, "presets", "move-skills", "Default", "Work", "cli-batch-a", "cli-batch-b", "--json");
  const removed = await runCli(managerHome, "presets", "remove-skills", "Work", "cli-batch-a", "cli-batch-b", "--json");

  expect(moved.stderr).toBe("");
  expect(moved.exitCode).toBe(0);
  expect(JSON.parse(moved.stdout)).toEqual({ skills: ["cli-batch-a", "cli-batch-b"], from: "Default", to: "Work", count: 2 });
  expect(removed.stderr).toBe("");
  expect(removed.exitCode).toBe(0);
  expect(JSON.parse(removed.stdout)).toEqual({ skills: ["cli-batch-a", "cli-batch-b"], preset: "Work", count: 2 });
});
