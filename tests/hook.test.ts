import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { getAgentHooks, listAgentHooks, renderCodexHookEnabled, updateAgentHooks, updateCodexHookState } from "../src/core/hook";
import type { ToolAdapter } from "../src/core/tools";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

async function fakeTool(key: ToolAdapter["key"], kind: ToolAdapter["hookKind"]): Promise<ToolAdapter> {
  const root = await mkdtemp(join(tmpdir(), "tm-hook-"));
  roots.push(root);
  const hookPath = join(root, key === "codex" ? "hooks.json" : "settings.json");
  return { key, displayName: key, detectPath: root, skillsDir: join(root, "skills"), projectSkillsDir: ".skills", mcpKind: "cursor-json", mcpPath: join(root, "config.toml"), hookKind: kind, hookPath };
}

test("updates one Claude event without replacing settings or other events", async () => {
  const tool = await fakeTool("claude_code", "claude-json");
  await writeFile(tool.hookPath, JSON.stringify({ theme: "dark", hooks: { Stop: [{ hooks: [{ type: "command", command: "stop.sh" }] }] } }));

  const updated = await updateAgentHooks("claude_code", "PreToolUse", JSON.stringify([{ matcher: "Bash", hooks: [{ type: "command", command: "check.sh" }] }]), [tool]);
  const saved = JSON.parse(await readFile(tool.hookPath, "utf8"));

  expect(saved.theme).toBe("dark");
  expect(saved.hooks.Stop[0].hooks[0].command).toBe("stop.sh");
  expect(saved.hooks.PreToolUse[0].matcher).toBe("Bash");
  expect(updated.event).toMatchObject({ name: "PreToolUse", installed: 1, active: 1 });
  expect((await readdir(dirname(tool.hookPath))).some((name) => name.startsWith("settings.json.bak."))).toBe(true);
});

test("creates a versioned Cursor hook file and lists its events", async () => {
  const tool = await fakeTool("cursor", "cursor-json");
  await updateAgentHooks("cursor", "beforeShellExecution", JSON.stringify([{ command: "check.sh" }]), [tool]);
  expect(JSON.parse(await readFile(tool.hookPath, "utf8"))).toEqual({ hooks: { beforeShellExecution: [{ command: "check.sh" }] }, version: 1 });
  expect(await listAgentHooks("cursor", [tool])).toEqual([expect.objectContaining({ eventCount: 1, commandCount: 1 })]);
});

test("discovers enabled Codex plugin hooks and applies trusted active state", async () => {
  const tool = await fakeTool("codex", "codex-hooks");
  const pluginDir = join(dirname(tool.hookPath), "plugins", "cache", "market", "guard", "1.0.0", "hooks");
  await mkdir(pluginDir, { recursive: true });
  await writeFile(join(pluginDir, "hooks.json"), JSON.stringify({ hooks: {
    PreToolUse: [{ matcher: ".*", hooks: [{ type: "command", command: "check.sh" }] }],
    PostToolUse: [{ hooks: [{ type: "command", command: "after.sh" }] }],
  } }));
  const preId = "guard@market:hooks/hooks.json:pre_tool_use:0:0";
  const postId = "guard@market:hooks/hooks.json:post_tool_use:0:0";
  await writeFile(tool.mcpPath, `[plugins."guard@market"]\nenabled = true\n\n[hooks.state."${preId}"]\ntrusted_hash = "sha256:one"\nenabled = true\n\n[hooks.state."${postId}"]\ntrusted_hash = "sha256:two"\nenabled = false\n`);

  const config = (await listAgentHooks("codex", [tool]))[0]!;
  expect(config.events.find((event) => event.name === "PreToolUse")).toMatchObject({ installed: 1, active: 1 });
  expect(config.events.find((event) => event.name === "PostToolUse")).toMatchObject({ installed: 1, active: 0 });
  const detail = await getAgentHooks("codex", "PostToolUse", [tool]);
  expect(detail.event.handlers[0]).toMatchObject({ source: "guard@market", trusted: true, enabled: false, editable: false });

  await updateCodexHookState(detail.event.handlers[0]!.id, true, [tool]);
  const saved = await readFile(tool.mcpPath, "utf8");
  expect(saved).toContain('trusted_hash = "sha256:two"\nenabled = true');
  expect(saved).toContain(`[hooks.state."${preId}"]`);
  expect((await readdir(dirname(tool.mcpPath))).some((name) => name.startsWith("config.toml.bak."))).toBe(true);
});

test("refuses to enable an unreviewed Codex plugin hook", async () => {
  const tool = await fakeTool("codex", "codex-hooks");
  const pluginDir = join(dirname(tool.hookPath), "plugins", "cache", "market", "guard", "1.0.0", "hooks");
  await mkdir(pluginDir, { recursive: true });
  await writeFile(join(pluginDir, "hooks.json"), JSON.stringify({ hooks: { Stop: [{ hooks: [{ command: "stop.sh" }] }] } }));
  await writeFile(tool.mcpPath, '[plugins."guard@market"]\nenabled = true\n');
  const detail = await getAgentHooks("codex", "Stop", [tool]);
  expect(detail.event.handlers[0]).toMatchObject({ trusted: false, enabled: false });
  await expect(updateCodexHookState(detail.event.handlers[0]!.id, true, [tool])).rejects.toThrow("Review and trust");
});

test("updates only the enabled line in a Codex hook state section", () => {
  const id = "guard@market:hooks/hooks.json:stop:0:0";
  const source = `model = "gpt"\n\n[hooks.state."${id}"]\ntrusted_hash = "sha256:x"\nenabled = false\n\n[projects.test]\ntrusted = true\n`;
  const rendered = renderCodexHookEnabled(source, id, true);
  expect(rendered).toContain('model = "gpt"');
  expect(rendered).toContain('trusted_hash = "sha256:x"\nenabled = true');
  expect(rendered).toContain("[projects.test]");
});
