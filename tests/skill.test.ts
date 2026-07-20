import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { findSkillCandidates } from "../src/core/skill";

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
