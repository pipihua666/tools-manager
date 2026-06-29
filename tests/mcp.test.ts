import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addMcpServer, getMcpServer, listMcpServers, parseCodexToml, parseMcpJson, removeMcpServer, renderCodexToml, renderMcpJson, type McpServer } from "../src/core/mcp";
import { closeDb } from "../src/core/db";

let roots: string[] = [];

afterEach(async () => {
  closeDb();
  delete process.env.TOOLS_MANAGER_HOME;
  await Promise.all(roots.map((dir) => rm(dir, { recursive: true, force: true })));
  roots = [];
});

async function tempRoot(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  roots.push(dir);
  return dir;
}

const server: McpServer = {
  name: "playwright",
  command: "npx",
  args: ["@playwright/mcp@latest"],
  env: { TOKEN: "$TOKEN" },
  targetTools: ["codex"],
  enabled: true,
};

test("renders MCP JSON without removing unrelated servers", () => {
  const rendered = renderMcpJson('{"mcpServers":{"old":{"command":"node","args":[]}}}', [server]);
  const parsed = JSON.parse(rendered);
  expect(parsed.mcpServers.old.command).toBe("node");
  expect(parsed.mcpServers.playwright.command).toBe("npx");
});

test("renders Codex TOML and replaces managed block", () => {
  const rendered = renderCodexToml('[mcp_servers.playwright]\ncommand = "old"\n\n[projects."/tmp"]\ntrust_level = "trusted"\n', [server]);
  expect(rendered).toContain('[projects."/tmp"]');
  expect(rendered).toContain("[mcp_servers.playwright]");
  expect(rendered).toContain('command = "npx"');
  expect(rendered).not.toContain('command = "old"');
});

test("parses MCP JSON servers", () => {
  const servers = parseMcpJson('{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"],"env":{"TOKEN":"x"}}}}', "cursor");
  expect(servers).toEqual([{
    name: "playwright",
    command: "npx",
    args: ["@playwright/mcp@latest"],
    env: { TOKEN: "x" },
    targetTools: ["cursor"],
    enabled: true,
  }]);
});

test("parses Codex TOML servers", () => {
  const servers = parseCodexToml('[mcp_servers.playwright]\ncommand = "npx"\nargs = ["@playwright/mcp@latest"]\n\n[mcp_servers.playwright.env]\nTOKEN = "x"\n', "codex");
  expect(servers).toEqual([{
    name: "playwright",
    command: "npx",
    args: ["@playwright/mcp@latest"],
    env: { TOKEN: "x" },
    targetTools: ["codex"],
    enabled: true,
  }]);
});

test("removes MCP server", async () => {
  process.env.TOOLS_MANAGER_HOME = await tempRoot("tm-home-");
  await addMcpServer(server);

  const removed = await removeMcpServer("playwright");

  expect(removed.name).toBe("playwright");
  expect(await listMcpServers()).toEqual([]);
});

test("gets MCP server", async () => {
  process.env.TOOLS_MANAGER_HOME = await tempRoot("tm-home-");
  await addMcpServer(server);

  expect(await getMcpServer("playwright")).toEqual(server);
  expect(await getMcpServer("missing")).toBeNull();
});
