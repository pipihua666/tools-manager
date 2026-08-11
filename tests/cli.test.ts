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

test("adds and lists managed skills through the CLI", async () => {
  const managerHome = await mkdtemp(join(tmpdir(), "tm-cli-home-"));
  const skillSource = await mkdtemp(join(tmpdir(), "tm-cli-skill-"));
  roots.push(managerHome, skillSource);
  await mkdir(skillSource, { recursive: true });
  await writeFile(join(skillSource, "SKILL.md"), "---\nname: CLI Managed\ndescription: Demo\n---\n");

  expect((await runCli(managerHome, "init")).exitCode).toBe(0);
  const added = await runCli(managerHome, "skills", "add", skillSource, "--json");
  const listed = await runCli(managerHome, "skills", "list", "--json");

  expect(added.stderr).toBe("");
  expect(added.exitCode).toBe(0);
  expect(JSON.parse(added.stdout)[0]).toMatchObject({ name: "cli-managed" });
  expect(listed.exitCode).toBe(0);
  expect(JSON.parse(listed.stdout).map((skill: { name: string }) => skill.name)).toContain("cli-managed");
});

test("rejects the removed presets command", async () => {
  const managerHome = await mkdtemp(join(tmpdir(), "tm-cli-home-"));
  roots.push(managerHome);
  const result = await runCli(managerHome, "presets", "list");

  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("Unknown command: presets");
});
