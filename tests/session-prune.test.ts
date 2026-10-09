import { afterEach, expect, test } from "bun:test";
import { appendFile, mkdtemp, mkdir, stat, rm, symlink, utimes, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { previewSessionPrune, pruneSessions } from "../src/core/session-prune";
import { createWebHandler } from "../src/web/server";
import { pathExists } from "../src/core/fs";

let root = "";
const now = Date.now();
const day = 86400000;

afterEach(async () => {
  delete process.env.CODEX_HOME;
  delete process.env.CLAUDE_CONFIG_DIR;
  if (root) await rm(root, { recursive: true, force: true });
  root = "";
});

async function setup() {
  root = await mkdtemp(join(tmpdir(), "tm-session-prune-"));
  process.env.CODEX_HOME = join(root, "codex");
  process.env.CLAUDE_CONFIG_DIR = join(root, "claude");
}

async function session(id: string, age: number, users: number, provider = "codex", modifiedAge = age) {
  const dir = provider === "codex" ? join(root, "codex", "sessions") : join(root, "claude", "projects", "project");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${id}.jsonl`);
  const timestamp = new Date(now - age * day).toISOString();
  const lines: unknown[] = provider === "codex" ? [{ type: "session_meta", timestamp, payload: { id, cwd: "/tmp/project" } }] : [];
  for (let i = 0; i < users; i++) {
    lines.push(provider === "codex"
      ? { type: "response_item", timestamp, payload: { type: "message", role: "user", content: [{ type: "input_text", text: `Task ${i}` }] } }
      : { sessionId: id, type: "user", timestamp, message: { role: "user", content: `Task ${i}` } });
  }
  await writeFile(path, lines.map((line) => JSON.stringify(line)).join("\n") + "\n");
  await utimes(path, new Date(now - modifiedAge * day), new Date(now - modifiedAge * day));
  return path;
}

test("previews conservative age and conversation-length rules and keeps recently modified files", async () => {
  await setup();
  await session("old-long-0001", 91, 3);
  await session("old-short-0001", 31, 1);
  await session("medium-long-0001", 31, 2);
  await session("recent-short-0001", 29, 1);
  await session("active-old-0001", 100, 1, "codex", 0);
  const preview = await previewSessionPrune("codex", now);
  expect(preview.candidates.map((candidate) => candidate.session.sessionId).sort()).toEqual(["old-long-0001", "old-short-0001"]);
  expect(preview.candidates.find((candidate) => candidate.session.sessionId === "old-short-0001")?.reason).toBe("short-conversation");
  const expected = await Promise.all(preview.candidates.map((candidate) => stat(candidate.session.sourcePath)));
  expect(preview.estimatedBytes).toBe(expected.reduce((sum, info) => sum + info.size, 0));
});

test("prunes only previewed unchanged sessions and reports actual file and Claude sidecar bytes", async () => {
  await setup();
  const oldPath = await session("old-codex-0001", 100, 2);
  const changedPath = await session("changed-codex-0001", 100, 2);
  const claudePath = await session("old-claude-0001", 100, 1, "claude");
  const sidecar = join(root, "claude", "projects", "project", "old-claude-0001");
  await mkdir(join(sidecar, "nested"), { recursive: true });
  await writeFile(join(sidecar, "nested", "tool.txt"), "tool output");
  const outside = join(root, "keep.txt");
  await writeFile(outside, "keep this external file");
  await symlink(outside, join(sidecar, "external"));
  const preview = await previewSessionPrune(undefined, now);
  const claudeCandidate = preview.candidates.find((candidate) => candidate.session.providerId === "claude")!;
  expect(claudeCandidate.dataPaths).toHaveLength(2);
  expect(claudeCandidate.dataPaths[0]).toEndWith("old-claude-0001.jsonl");
  expect(claudeCandidate.dataPaths[1]).toEndWith("old-claude-0001");
  const expectedBytes = preview.candidates.filter((candidate) => candidate.session.sessionId !== "changed-codex-0001").reduce((sum, candidate) => sum + candidate.bytes, 0);
  await appendFile(changedPath, "\n");
  const newPath = await session("new-codex-0001", 100, 1);
  const result = await pruneSessions(preview, now);
  expect(result).toEqual({ deletedCount: 2, skippedCount: 1, freedBytes: expectedBytes, errors: [] });
  expect(await pathExists(oldPath)).toBe(false);
  expect(await pathExists(claudePath)).toBe(false);
  expect(await pathExists(sidecar)).toBe(false);
  expect(await pathExists(changedPath)).toBe(true);
  expect(await pathExists(newPath)).toBe(true);
  expect(await pathExists(outside)).toBe(true);
});

test("cleanup API protects mutations, respects provider scope and consumes preview only once", async () => {
  await setup();
  await session("api-codex-0001", 100, 1);
  const claude = await session("api-claude-0001", 100, 1, "claude");
  const handler = createWebHandler("prune-test-token");
  const previewResponse = await handler(new Request("http://127.0.0.1:4343/api/sessions/prune-preview?provider=codex"));
  const preview = await previewResponse.json();
  expect(preview.count).toBe(1);
  expect(preview.candidates).toHaveLength(1);
  expect(preview.candidates[0]).toMatchObject({ provider: "codex", sessionId: "api-codex-0001", title: "Task 0", reason: "inactive" });
  expect(preview.candidates[0].dataPaths).toHaveLength(1);
  expect(preview.candidates[0].dataPaths[0]).toEndWith("api-codex-0001.jsonl");
  expect(preview.candidates[0].bytes).toBe(preview.estimatedBytes);
  const request = (token: string) => new Request("http://127.0.0.1:4343/api/sessions/prune", {
    method: "POST", headers: { "content-type": "application/json", "x-tm-token": token }, body: JSON.stringify({ planId: preview.planId }),
  });
  expect((await handler(request("wrong-token"))).status).toBe(403);
  const result = await (await handler(request("prune-test-token"))).json();
  expect(result.deletedCount).toBe(1);
  expect(result.freedBytes).toBe(preview.estimatedBytes);
  expect((await handler(request("prune-test-token"))).status).toBe(400);
  expect(await pathExists(claude)).toBe(true);
});
