import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addMcpServer, getMcpServer, listMcpServers, parseCodexToml, parseMcpJson, parseOpenCodeJson, removeMcpServer, renderCodexToml, renderMcpJson, renderOpenCodeJson, syncMcpServer, type McpServer } from "../src/core/mcp";
import type { ToolAdapter } from "../src/core/tools";
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
  transport: "stdio",
  command: "npx",
  url: "",
  args: ["@playwright/mcp@latest"],
  env: { TOKEN: "$TOKEN" },
  headers: {},
  targetTools: ["codex"],
  enabled: true,
};

const remoteServer: McpServer = {
  name: "remote-api",
  transport: "http",
  command: "",
  url: "https://example.com/mcp",
  args: [],
  env: {},
  headers: { Authorization: "Bearer $TOKEN", "X-API-Key": "$API_KEY" },
  targetTools: ["all"],
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
    transport: "stdio",
    command: "npx",
    url: "",
    args: ["@playwright/mcp@latest"],
    env: { TOKEN: "x" },
    headers: {},
    targetTools: ["cursor"],
    enabled: true,
  }]);
});

test("parses Codex TOML servers", () => {
  const servers = parseCodexToml('[mcp_servers.playwright]\ncommand = "npx"\nargs = ["@playwright/mcp@latest"]\n\n[mcp_servers.playwright.env]\nTOKEN = "x"\n', "codex");
  expect(servers).toEqual([{
    name: "playwright",
    transport: "stdio",
    command: "npx",
    url: "",
    args: ["@playwright/mcp@latest"],
    env: { TOKEN: "x" },
    headers: {},
    targetTools: ["codex"],
    enabled: true,
  }]);
});

test("renders OpenCode JSON without removing unrelated config", () => {
  const rendered = renderOpenCodeJson('{"theme":"system","mcp":{"old":{"type":"local","command":["node","server.js"]}}}', [server]);
  const parsed = JSON.parse(rendered);
  expect(parsed.theme).toBe("system");
  expect(parsed.mcp.old.command).toEqual(["node", "server.js"]);
  expect(parsed.mcp.playwright).toEqual({
    type: "local",
    command: ["npx", "@playwright/mcp@latest"],
    enabled: true,
    environment: { TOKEN: "$TOKEN" },
  });
});

test("parses OpenCode local MCP servers", () => {
  const servers = parseOpenCodeJson('{"mcp":{"playwright":{"type":"local","command":["npx","@playwright/mcp@latest"],"environment":{"TOKEN":"x"},"enabled":false}}}', "opencode");
  expect(servers).toEqual([{
    name: "playwright",
    transport: "stdio",
    command: "npx",
    url: "",
    args: ["@playwright/mcp@latest"],
    env: { TOKEN: "x" },
    headers: {},
    targetTools: ["opencode"],
    enabled: false,
  }]);
});

test("renders and parses remote MCP JSON servers", () => {
  const cursor = JSON.parse(renderMcpJson(null, [remoteServer], "cursor-json"));
  const claude = JSON.parse(renderMcpJson(null, [remoteServer], "claude-json"));

  expect(cursor.mcpServers["remote-api"]).toEqual({ url: "https://example.com/mcp", headers: remoteServer.headers });
  expect(claude.mcpServers["remote-api"]).toEqual({ type: "http", url: "https://example.com/mcp", headers: remoteServer.headers });
  expect(parseMcpJson(JSON.stringify(cursor), "cursor")).toEqual([{ ...remoteServer, targetTools: ["cursor"] }]);
});

test("renders and parses remote Codex TOML servers", () => {
  const rendered = renderCodexToml(null, [remoteServer]);

  expect(rendered).toContain('url = "https://example.com/mcp"');
  expect(rendered).toContain("[mcp_servers.remote-api.http_headers]");
  expect(rendered).toContain('X-API-Key = "$API_KEY"');
  expect(parseCodexToml(rendered, "codex")).toEqual([{ ...remoteServer, targetTools: ["codex"] }]);
});

test("renders and parses remote OpenCode servers", () => {
  const rendered = renderOpenCodeJson(null, [remoteServer]);
  const parsed = JSON.parse(rendered);

  expect(parsed.mcp["remote-api"]).toEqual({ type: "remote", url: "https://example.com/mcp", enabled: true, headers: remoteServer.headers });
  expect(parseOpenCodeJson(rendered, "opencode")).toEqual([{ ...remoteServer, targetTools: ["opencode"] }]);
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

test("persists remote MCP server URL and headers", async () => {
  process.env.TOOLS_MANAGER_HOME = await tempRoot("tm-home-");
  await addMcpServer(remoteServer);

  expect(await getMcpServer("remote-api")).toEqual(remoteServer);
});

test("migrates the command-only MCP database schema", async () => {
  const root = await tempRoot("tm-old-db-");
  process.env.TOOLS_MANAGER_HOME = root;
  await mkdir(root, { recursive: true });
  const db = new Database(join(root, "tools-manager.db"));
  db.exec(`
    CREATE TABLE mcp_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      command TEXT NOT NULL,
      args_json TEXT NOT NULL,
      env_json TEXT NOT NULL,
      target_tools_json TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO mcp_servers (name, command, args_json, env_json, target_tools_json)
    VALUES ('legacy', 'node', '[]', '{}', '["codex"]');
  `);
  db.close();

  expect(await getMcpServer("legacy")).toEqual({
    name: "legacy",
    transport: "stdio",
    command: "node",
    url: "",
    args: [],
    env: {},
    headers: {},
    targetTools: ["codex"],
    enabled: true,
  });
  await addMcpServer(remoteServer);
  expect((await getMcpServer("remote-api"))?.headers).toEqual(remoteServer.headers);
});

test("syncs one MCP server without writing other managed servers", async () => {
  process.env.TOOLS_MANAGER_HOME = await tempRoot("tm-home-");
  const agentRoot = await tempRoot("tm-agent-");
  const mcpPath = join(agentRoot, "mcp.json");
  const tool: ToolAdapter = {
    key: "cursor",
    displayName: "Cursor",
    detectPath: agentRoot,
    skillsDir: join(agentRoot, "skills"),
    projectSkillsDir: ".cursor/skills",
    mcpKind: "cursor-json",
    mcpPath,
  };
  await writeFile(mcpPath, '{"mcpServers":{"existing":{"command":"node","args":["existing.js"]}}}');
  await addMcpServer({ ...server, targetTools: ["cursor"] });
  await addMcpServer({ name: "other-managed", transport: "stdio", command: "node", url: "", args: ["other.js"], env: {}, headers: {}, targetTools: ["cursor"], enabled: true });

  const result = await syncMcpServer("playwright", "cursor", [tool]);
  const rendered = JSON.parse(await readFile(mcpPath, "utf8"));

  expect(result).toHaveLength(1);
  expect(rendered.mcpServers.existing.command).toBe("node");
  expect(rendered.mcpServers.playwright.command).toBe("npx");
  expect(rendered.mcpServers["other-managed"]).toBeUndefined();
});
