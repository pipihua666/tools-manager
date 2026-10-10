import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let roots: string[] = [];

async function runCli(managerHome: string, ...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return runCliWithEnv(managerHome, {}, ...args);
}

async function runCliWithEnv(managerHome: string, env: Record<string, string>, ...args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const child = Bun.spawn([process.execPath, "run", join(import.meta.dir, "..", "src", "cli.ts"), ...args], {
    env: { ...Bun.env, TOOLS_MANAGER_HOME: managerHome, ...env },
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

async function setupUpdate(): Promise<{ managerHome: string; env: Record<string, string>; argsPath: string }> {
  const root = await mkdtemp(join(tmpdir(), "tm-cli-update-"));
  roots.push(root);
  const managerHome = join(root, "home");
  const binDir = join(root, "bin");
  const argsPath = join(root, "args");
  await mkdir(managerHome);
  await mkdir(binDir);
  await writeFile(join(binDir, "npm"), '#!/bin/sh\nprintf "%s\\n" "$@" > "$TM_UPDATE_ARGS"\nprintf "npm output\\n"\nif [ "${TM_UPDATE_EXIT:-0}" != "0" ]; then\n  printf "npm error: permission denied\\n" >&2\nfi\nexit "${TM_UPDATE_EXIT:-0}"\n', { mode: 0o755 });
  return { managerHome, env: { PATH: binDir, TM_UPDATE_ARGS: argsPath, TM_UPDATE_EXIT: "0" }, argsPath };
}

test("updates the global CLI to latest without initializing managed data", async () => {
  const { managerHome, env, argsPath } = await setupUpdate();
  const result = await runCliWithEnv(managerHome, env, "update");

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(result.stdout).toContain("Updated Tools Manager to the latest version.");
  expect(await readFile(argsPath, "utf8")).toBe("install\n--global\ntools-manager@latest\n");
  expect(await readdir(managerHome)).toEqual([]);
});

test("returns clean JSON after a successful CLI update", async () => {
  const { managerHome, env } = await setupUpdate();
  const result = await runCliWithEnv(managerHome, env, "update", "--json");

  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual({ updated: true, package: "tools-manager", tag: "latest" });
});

test("reports npm update failures without claiming success", async () => {
  const { managerHome, env } = await setupUpdate();
  const result = await runCliWithEnv(managerHome, { ...env, TM_UPDATE_EXIT: "1" }, "update", "--json");

  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("Failed to update Tools Manager (npm exited with code 1).");
  expect(result.stderr).toContain("npm error: permission denied");
});

test("reports missing npm when updating", async () => {
  const managerHome = await mkdtemp(join(tmpdir(), "tm-cli-home-"));
  roots.push(managerHome);
  const result = await runCliWithEnv(managerHome, { PATH: managerHome }, "update");

  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("npm is required to update Tools Manager.");
});

test("rejects update arguments before running npm", async () => {
  const { managerHome, env, argsPath } = await setupUpdate();
  const result = await runCliWithEnv(managerHome, env, "update", "--unknown");

  expect(result.exitCode).toBe(2);
  expect(result.stderr).toContain("Usage: tm update [--json]");
  expect(await Bun.file(argsPath).exists()).toBe(false);
});

test("includes update in CLI help", async () => {
  const managerHome = await mkdtemp(join(tmpdir(), "tm-cli-home-"));
  roots.push(managerHome);
  const result = await runCli(managerHome, "--help");

  expect(result.exitCode).toBe(0);
  expect(result.stdout).toContain("tm update [--json]");
});
