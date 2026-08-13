import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deleteSession, getSession, listSessions, loadSessionMessages } from "../src/core/session";
import { pathExists } from "../src/core/fs";

let roots: string[] = [];

afterEach(async () => {
  delete process.env.CODEX_HOME;
  delete process.env.CLAUDE_CONFIG_DIR;
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots = [];
});

async function tempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

test("scans Codex sessions with indexed titles and filters subagents", async () => {
  const codexHome = await tempRoot("tm-codex-sessions-");
  process.env.CODEX_HOME = codexHome;
  const sessionDir = join(codexHome, "sessions", "2026", "08", "11");
  await mkdir(sessionDir, { recursive: true });
  const sessionId = "019ff054-ef79-7250-a034-4eced14ac171";
  const sessionPath = join(sessionDir, `rollout-2026-08-11T10-18-59-${sessionId}.jsonl`);
  await writeFile(sessionPath, [
    JSON.stringify({ timestamp: "2026-08-11T10:18:59Z", type: "session_meta", payload: { id: sessionId, timestamp: "2026-08-11T10:18:59Z", cwd: "/tmp/project" } }),
    JSON.stringify({ timestamp: "2026-08-11T10:19:00Z", type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Review this change" }] } }),
    JSON.stringify({ timestamp: "2026-08-11T10:20:00Z", type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "No findings." }] } }),
  ].join("\n") + "\n");
  await writeFile(join(codexHome, "session_index.jsonl"), JSON.stringify({ id: sessionId, thread_name: "Review code changes" }) + "\n");
  await writeFile(join(sessionDir, "rollout-subagent.jsonl"), JSON.stringify({ type: "session_meta", payload: { id: "019ff054-ef79-7250-a034-4eced14ac172", source: { subagent: "review" } } }) + "\n");

  const sessions = await listSessions("codex");
  const transcript = await loadSessionMessages("codex", sessionId, sessionPath);

  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({ sessionId, title: "Review code changes", projectDir: "/tmp/project", resumeCommand: `codex resume ${sessionId}` });
  expect(transcript.messages.map((message) => [message.role, message.content])).toEqual([
    ["user", "Review this change"],
    ["assistant", "No findings."],
  ]);
  expect(transcript.truncated).toBe(false);
});

test("parses and safely deletes a Claude session and its sidecar", async () => {
  const claudeHome = await tempRoot("tm-claude-sessions-");
  process.env.CLAUDE_CONFIG_DIR = claudeHome;
  const sessionDir = join(claudeHome, "projects", "project-a");
  const sessionId = "019ff054-ef79-7250-a034-4eced14ac173";
  const sessionPath = join(sessionDir, `${sessionId}.jsonl`);
  const sidecar = join(sessionDir, sessionId);
  await mkdir(sidecar, { recursive: true });
  await writeFile(join(sidecar, "tool-result.txt"), "temporary");
  await writeFile(sessionPath, [
    JSON.stringify({ sessionId, cwd: "/tmp/claude-project", timestamp: "2026-08-11T10:00:00Z", type: "user", message: { role: "user", content: "Fix login" } }),
    JSON.stringify({ sessionId, timestamp: "2026-08-11T10:01:00Z", type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "Done" }] } }),
  ].join("\n") + "\n");

  const sessions = await listSessions("claude");
  expect(sessions[0]).toMatchObject({ sessionId, title: "Fix login", resumeCommand: `claude --resume ${sessionId}` });
  await deleteSession("claude", sessionId, sessionPath);
  expect(await pathExists(sessionPath)).toBe(false);
  expect(await pathExists(sidecar)).toBe(false);
});

test("rejects session paths outside the provider roots", async () => {
  const codexHome = await tempRoot("tm-codex-sessions-");
  const outside = await tempRoot("tm-outside-session-");
  process.env.CODEX_HOME = codexHome;
  await mkdir(join(codexHome, "sessions"), { recursive: true });
  const sourcePath = join(outside, "session.jsonl");
  await writeFile(sourcePath, "{}\n");

  await expect(getSession("codex", "019ff054-ef79-7250-a034-4eced14ac174", sourcePath)).rejects.toThrow("outside the configured session directories");
});
