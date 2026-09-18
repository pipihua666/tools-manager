import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { deleteSession, getAgentUsage, getSession, listSessions, loadSessionMessages } from "../src/core/session";
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
    JSON.stringify({ timestamp: "2026-08-11T10:20:01Z", type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 1200, cached_input_tokens: 800, output_tokens: 300, total_tokens: 1500 } } } }),
  ].join("\n") + "\n");
  await writeFile(join(codexHome, "session_index.jsonl"), JSON.stringify({ id: sessionId, thread_name: "Review code changes" }) + "\n");
  await writeFile(join(sessionDir, "rollout-subagent.jsonl"), JSON.stringify({ type: "session_meta", payload: { id: "019ff054-ef79-7250-a034-4eced14ac172", source: { subagent: "review" } } }) + "\n");

  const sessions = await listSessions("codex");
  const transcript = await loadSessionMessages("codex", sessionId, sessionPath);
  const usage = await getAgentUsage("codex");

  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({ sessionId, title: "Review code changes", projectDir: "/tmp/project", resumeCommand: `codex resume ${sessionId}` });
  expect(transcript.messages.map((message) => [message.role, message.content])).toEqual([
    ["user", "Review this change"],
    ["assistant", "No findings."],
  ]);
  expect(transcript.truncated).toBe(false);
  expect(usage).toMatchObject({ totalTokens: 1500, inputTokens: 1200, cachedInputTokens: 800, outputTokens: 300, sessionCount: 1 });
  expect(usage.cacheHitRate).toBeCloseTo(2 / 3);
  expect(usage.estimatedCostUsd).toBeCloseTo(0.0036);
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
  const timestamp = new Date().toISOString();
  await writeFile(sessionPath, [
    JSON.stringify({ sessionId, cwd: "/tmp/claude-project", timestamp, type: "user", message: { role: "user", content: "Fix login" } }),
    JSON.stringify({ sessionId, timestamp: new Date(Date.parse(timestamp) + 1200).toISOString(), type: "assistant", message: { role: "assistant", model: "claude-test", stop_reason: "end_turn", content: [{ type: "text", text: "Usage" }], usage: { input_tokens: 200, cache_read_input_tokens: 600, cache_creation_input_tokens: 100, output_tokens: 100 } } }),
  ].join("\n") + "\n");

  const sessions = await listSessions("claude");
  const usage = await getAgentUsage("claude");
  expect(sessions[0]).toMatchObject({ sessionId, title: "Fix login", resumeCommand: `claude --resume ${sessionId}` });
  expect(usage).toMatchObject({ totalTokens: 1000, inputTokens: 900, cachedInputTokens: 600, outputTokens: 100, sessionCount: 1 });
  expect(usage.cacheHitRate).toBeCloseTo(2 / 3);
  expect(usage.dailyUsage.at(-1)?.totalTokens).toBe(1000);
  expect(usage.todayModels[0]).toMatchObject({ model: "claude-test", effort: null, totalTokens: 1000, requestCount: 1, completedCount: 1, completionRate: 1, tokensPerCompletedTask: 1000, averageResponseMs: 1200, latestResponseMs: 1200 });
  expect(usage.dailyUsage.at(-1)).toMatchObject({ inputTokens: 900, cachedInputTokens: 600, cacheWriteTokens: 100, outputTokens: 100 });
  expect(usage.recommendedModel).toBe("claude-test");
  expect(usage.recommendedEffort).toBeNull();
  await deleteSession("claude", sessionId, sessionPath);
  expect(await pathExists(sessionPath)).toBe(false);
  expect(await pathExists(sidecar)).toBe(false);
});

test("builds recent usage and today's model ladder from Codex token deltas", async () => {
  const codexHome = await tempRoot("tm-codex-analytics-");
  process.env.CODEX_HOME = codexHome;
  await writeFile(join(codexHome, "models_cache.json"), JSON.stringify({ models: [
    {
      slug: "gpt-premium",
      description: "Our most capable model for complex, demanding work.",
      default_reasoning_level: "high",
      supported_reasoning_levels: [{ effort: "low" }, { effort: "high" }],
      visibility: "list",
      priority: 1,
    },
    {
      slug: "gpt-economy",
      description: "Fast and affordable agentic coding model.",
      default_reasoning_level: "medium",
      supported_reasoning_levels: [{ effort: "low" }, { effort: "medium" }, { effort: "high" }],
      visibility: "list",
      priority: 2,
    },
    { slug: "hidden-model", visibility: "hide", priority: 3 },
  ] }));
  const now = new Date();
  const sessionDir = join(codexHome, "sessions", String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0"));
  await mkdir(sessionDir, { recursive: true });
  const sessionId = "019ff054-ef79-7250-a034-4eced14ac175";
  const sessionPath = join(sessionDir, `rollout-${sessionId}.jsonl`);
  const timestamp = now.toISOString();
  await writeFile(sessionPath, [
    JSON.stringify({ timestamp, type: "session_meta", payload: { id: sessionId, timestamp, cwd: "/tmp/project" } }),
    JSON.stringify({ timestamp, type: "event_msg", payload: { type: "task_started" } }),
    JSON.stringify({ timestamp, type: "turn_context", payload: { model: "gpt-fast", effort: "low" } }),
    JSON.stringify({ timestamp, type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Fast task" }] } }),
    JSON.stringify({ timestamp: new Date(now.getTime() + 800).toISOString(), type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "Working" }] } }),
    JSON.stringify({ timestamp, type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 100, cached_input_tokens: 80, output_tokens: 10, total_tokens: 110 } } } }),
    JSON.stringify({ timestamp, type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 200, cached_input_tokens: 160, output_tokens: 20, total_tokens: 220 } } } }),
    JSON.stringify({ timestamp: new Date(now.getTime() + 900).toISOString(), type: "event_msg", payload: { type: "task_complete" } }),
    JSON.stringify({ timestamp: new Date(now.getTime() + 1000).toISOString(), type: "event_msg", payload: { type: "task_started" } }),
    JSON.stringify({ timestamp, type: "turn_context", payload: { model: "gpt-fast", effort: "high" } }),
    JSON.stringify({ timestamp: new Date(now.getTime() + 1000).toISOString(), type: "response_item", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Smart task" }] } }),
    JSON.stringify({ timestamp: new Date(now.getTime() + 3000).toISOString(), type: "response_item", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "Working" }] } }),
    JSON.stringify({ timestamp, type: "event_msg", payload: { type: "token_count", info: { total_token_usage: { input_tokens: 300, cached_input_tokens: 160, output_tokens: 30, total_tokens: 330 } } } }),
    JSON.stringify({ timestamp: new Date(now.getTime() + 3100).toISOString(), type: "event_msg", payload: { type: "task_complete" } }),
  ].join("\n") + "\n");

  const usage = await getAgentUsage("codex");
  expect(usage.dailyUsage).toHaveLength(7);
  expect(usage.dailyUsage.at(-1)?.totalTokens).toBe(330);
  expect(usage.todayModels.map((item) => [item.model, item.totalTokens])).toEqual([
    ["gpt-fast", 220],
    ["gpt-fast", 110],
  ]);
  expect(usage.recommendedModel).toBe("gpt-economy");
  expect(usage.recommendedEffort).toBe("medium");
  expect(usage.recommendation).toMatchObject({
    model: "gpt-economy",
    effort: "medium",
    observed: false,
    source: "model-catalog",
    confidence: "low",
    candidateCount: 2,
  });
  expect(usage.recommendation?.rationale).toContain("2 available models");
  expect(usage.todayModels[0]).toMatchObject({ effort: "low", requestCount: 1, completedCount: 1, completionRate: 1, tokensPerCompletedTask: 220, averageResponseMs: 800, latestResponseMs: 800 });
  expect(usage.todayModels[1]).toMatchObject({ effort: "high", requestCount: 1, completedCount: 1, completionRate: 1, tokensPerCompletedTask: 110, averageResponseMs: 2000, latestResponseMs: 2000 });
  expect(usage.todayModels[0]?.costPerMillionTokens).toBeLessThan(usage.todayModels[1]?.costPerMillionTokens || 0);
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
