import { dirname } from "node:path";
import { openDb, type McpServerRow } from "./db";
import { parseJsonArray, parseJsonRecord, stableJson } from "./json";
import { backupFile, ensureDir, readTextIfExists, writeText } from "./fs";
import { resolveTools, type ToolAdapter } from "./tools";

export type McpServer = {
  name: string;
  transport: "stdio" | "http";
  command: string;
  url: string;
  args: string[];
  env: Record<string, string>;
  headers: Record<string, string>;
  targetTools: string[];
  enabled: boolean;
};

export async function addMcpServer(input: McpServer): Promise<void> {
  const db = await openDb();
  db.query(`
    INSERT INTO mcp_servers (name, transport, command, url, args_json, env_json, headers_json, target_tools_json, enabled, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(name) DO UPDATE SET
      transport = excluded.transport,
      command = excluded.command,
      url = excluded.url,
      args_json = excluded.args_json,
      env_json = excluded.env_json,
      headers_json = excluded.headers_json,
      target_tools_json = excluded.target_tools_json,
      enabled = excluded.enabled,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    input.name,
    input.transport,
    input.command,
    input.url,
    stableJson(input.args),
    stableJson(input.env),
    stableJson(input.headers),
    stableJson(input.targetTools),
    input.enabled ? 1 : 0,
  );
}

export async function listMcpServers(): Promise<McpServer[]> {
  const db = await openDb();
  const rows = db.query("SELECT * FROM mcp_servers ORDER BY name").all() as McpServerRow[];
  return rows.map(rowToServer);
}

export async function getMcpServer(name: string): Promise<McpServer | null> {
  const db = await openDb();
  const row = db.query("SELECT * FROM mcp_servers WHERE name = ?").get(name) as McpServerRow | null;
  return row ? rowToServer(row) : null;
}

export async function updateMcpServer(originalName: string, input: McpServer): Promise<McpServer> {
  const db = await openDb();
  const existing = db.query("SELECT id FROM mcp_servers WHERE name = ?").get(originalName) as { id: number } | null;
  if (!existing) throw new Error(`MCP server not found: ${originalName}`);
  if (input.name !== originalName) {
    const conflict = db.query("SELECT id FROM mcp_servers WHERE name = ?").get(input.name);
    if (conflict) throw new Error(`MCP server already exists: ${input.name}`);
  }
  db.query(`
    UPDATE mcp_servers SET
      name = ?, transport = ?, command = ?, url = ?, args_json = ?, env_json = ?, headers_json = ?, target_tools_json = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    input.name,
    input.transport,
    input.command,
    input.url,
    stableJson(input.args),
    stableJson(input.env),
    stableJson(input.headers),
    stableJson(input.targetTools),
    input.enabled ? 1 : 0,
    existing.id,
  );
  return input;
}

export async function removeMcpServer(name: string): Promise<McpServer> {
  const db = await openDb();
  const row = db.query("SELECT * FROM mcp_servers WHERE name = ?").get(name) as McpServerRow | null;
  if (!row) throw new Error(`MCP server not found: ${name}`);
  db.query("DELETE FROM mcp_servers WHERE name = ?").run(name);
  return rowToServer(row);
}

export async function importMcpFromTools(toolInput?: string): Promise<Array<{ tool: string; path: string; count: number; servers: string[] }>> {
  const tools = resolveTools(toolInput);
  const results: Array<{ tool: string; path: string; count: number; servers: string[] }> = [];
  for (const tool of tools) {
    const text = await readTextIfExists(tool.mcpPath);
    const servers = parseToolMcp(tool, text);
    for (const server of servers) await addMcpServer(server);
    results.push({ tool: tool.key, path: tool.mcpPath, count: servers.length, servers: servers.map((server) => server.name) });
  }
  return results;
}

export async function listToolMcpServers(toolInput = "all", adapters?: ToolAdapter[]): Promise<Array<{ tool: string; path: string; servers: McpServer[] }>> {
  const tools = adapters || resolveTools(toolInput);
  const results: Array<{ tool: string; path: string; servers: McpServer[] }> = [];
  for (const tool of tools) {
    const text = await readTextIfExists(tool.mcpPath);
    const servers = parseToolMcp(tool, text).sort((a, b) => a.name.localeCompare(b.name));
    results.push({ tool: tool.key, path: tool.mcpPath, servers });
  }
  return results;
}

export async function syncMcp(toolInput?: string): Promise<Array<{ tool: string; path: string; count: number; backup: string | null }>> {
  const servers = (await listMcpServers()).filter((server) => server.enabled);
  const tools = resolveTools(toolInput);
  const results: Array<{ tool: string; path: string; count: number; backup: string | null }> = [];
  for (const tool of tools) {
    const selected = servers.filter((server) => server.targetTools.includes("all") || server.targetTools.includes(tool.key));
    const backup = await renderToolMcp(tool, selected);
    results.push({ tool: tool.key, path: tool.mcpPath, count: selected.length, backup });
  }
  return results;
}

export async function syncMcpServer(name: string, toolInput?: string, adapters?: ToolAdapter[]): Promise<Array<{ tool: string; path: string; count: number; backup: string | null }>> {
  const server = await getMcpServer(name);
  if (!server) throw new Error(`MCP server not found: ${name}`);
  if (!server.enabled) throw new Error(`MCP server is disabled: ${name}`);
  const tools = adapters ? resolveSelectedTools(toolInput, adapters) : resolveTools(toolInput);
  const selected = tools.filter((tool) => server.targetTools.includes("all") || server.targetTools.includes(tool.key));
  if (selected.length === 0) throw new Error(`MCP server ${name} is not targeted to the selected Agent.`);
  const results: Array<{ tool: string; path: string; count: number; backup: string | null }> = [];
  for (const tool of selected) {
    const backup = await renderToolMcp(tool, [server]);
    results.push({ tool: tool.key, path: tool.mcpPath, count: 1, backup });
  }
  return results;
}

function resolveSelectedTools(toolInput: string | undefined, adapters: ToolAdapter[]): ToolAdapter[] {
  if (!toolInput || toolInput === "all") return adapters;
  const tool = adapters.find((adapter) => adapter.key === toolInput);
  if (!tool) throw new Error(`Unknown tool: ${toolInput}. Expected one of: ${adapters.map((adapter) => adapter.key).join(", ")}`);
  return [tool];
}

function parseToolMcp(tool: ToolAdapter, text: string | null): McpServer[] {
  if (!text?.trim()) return [];
  if (tool.mcpKind === "codex-toml") return parseCodexToml(text, tool.key);
  if (tool.mcpKind === "opencode-json") return parseOpenCodeJson(text, tool.key);
  return parseMcpJson(text, tool.key);
}

function rowToServer(row: McpServerRow): McpServer {
  return {
    name: row.name,
    transport: row.transport === "http" ? "http" : "stdio",
    command: row.command,
    url: row.url,
    args: parseJsonArray(row.args_json),
    env: parseJsonRecord(row.env_json),
    headers: parseJsonRecord(row.headers_json),
    targetTools: parseJsonArray(row.target_tools_json),
    enabled: row.enabled === 1,
  };
}

async function renderToolMcp(tool: ToolAdapter, servers: McpServer[]): Promise<string | null> {
  await ensureDir(dirname(tool.mcpPath));
  const backup = await backupFile(tool.mcpPath);
  if (tool.mcpKind === "codex-toml") {
    await writeText(tool.mcpPath, renderCodexToml(await readTextIfExists(tool.mcpPath), servers));
    return backup;
  }
  if (tool.mcpKind === "opencode-json") {
    await writeText(tool.mcpPath, renderOpenCodeJson(await readTextIfExists(tool.mcpPath), servers));
    return backup;
  }
  await writeText(tool.mcpPath, renderMcpJson(await readTextIfExists(tool.mcpPath), servers, tool.mcpKind));
  return backup;
}

export function renderMcpJson(existing: string | null, servers: McpServer[], kind: "claude-json" | "cursor-json" = "cursor-json"): string {
  let root: Record<string, unknown> = {};
  if (existing?.trim()) {
    try {
      const parsed = JSON.parse(existing) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) root = parsed as Record<string, unknown>;
    } catch {
      root = {};
    }
  }
  const mcpServers = normalizeObject(root.mcpServers);
  for (const server of servers) {
    mcpServers[server.name] = serverToJson(server, kind);
  }
  root.mcpServers = mcpServers;
  return `${JSON.stringify(root, null, 2)}\n`;
}

export function parseMcpJson(text: string, tool: string): McpServer[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    const root = normalizeObject(parsed);
    const mcpServers = normalizeObject(root.mcpServers);
    return Object.entries(mcpServers).flatMap(([name, value]) => {
      const server = normalizeObject(value);
      const url = typeof server.url === "string" ? server.url : "";
      const command = typeof server.command === "string" ? server.command : "";
      if (!command && !url) return [];
      return [{
        name,
        transport: url ? "http" : "stdio",
        command,
        url,
        args: Array.isArray(server.args) ? server.args.map(String) : [],
        env: parseStringRecord(server.env),
        headers: parseStringRecord(server.headers),
        targetTools: [tool],
        enabled: true,
      }];
    });
  } catch {
    return [];
  }
}

export function renderOpenCodeJson(existing: string | null, servers: McpServer[]): string {
  let root: Record<string, unknown> = {};
  if (existing?.trim()) {
    try {
      const parsed = JSON.parse(existing) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) root = parsed as Record<string, unknown>;
    } catch {
      root = {};
    }
  }
  const mcp = normalizeObject(root.mcp);
  for (const server of servers) {
    mcp[server.name] = serverToOpenCodeJson(server);
  }
  root.mcp = mcp;
  return `${JSON.stringify(root, null, 2)}\n`;
}

export function parseOpenCodeJson(text: string, tool: string): McpServer[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    const root = normalizeObject(parsed);
    const mcp = normalizeObject(root.mcp);
    return Object.entries(mcp).flatMap<McpServer>(([name, value]) => {
      const server = normalizeObject(value);
      const type = typeof server.type === "string" ? server.type : "local";
      if (type === "remote") {
        const url = typeof server.url === "string" ? server.url : "";
        if (!url) return [];
        return [{
          name,
          transport: "http",
          command: "",
          url,
          args: [],
          env: {},
          headers: parseStringRecord(server.headers),
          targetTools: [tool],
          enabled: typeof server.enabled === "boolean" ? server.enabled : true,
        }];
      }
      if (type !== "local") return [];
      const commandParts = Array.isArray(server.command) ? server.command.map(String) : [];
      if (commandParts.length === 0) return [];
      return [{
        name,
        transport: "stdio",
        command: commandParts[0]!,
        url: "",
        args: commandParts.slice(1),
        env: parseStringRecord(server.environment),
        headers: {},
        targetTools: [tool],
        enabled: typeof server.enabled === "boolean" ? server.enabled : true,
      }];
    });
  } catch {
    return [];
  }
}

export function renderCodexToml(existing: string | null, servers: McpServer[]): string {
  const retained = stripManagedCodexServers(existing || "", servers.map((server) => server.name)).trimEnd();
  const blocks = servers.map((server) => {
    const prefix = `mcp_servers.${tomlQuotedKey(server.name)}`;
    const lines = [`[${prefix}]`];
    if (server.transport === "http") {
      lines.push(`url = ${tomlString(server.url)}`);
    } else {
      lines.push(`command = ${tomlString(server.command)}`);
      lines.push(`args = [${server.args.map(tomlString).join(", ")}]`);
    }
    const record = server.transport === "http" ? server.headers : server.env;
    const recordEntries = Object.entries(record);
    if (recordEntries.length > 0) {
      lines.push("");
      lines.push(`[${prefix}.${server.transport === "http" ? "http_headers" : "env"}]`);
      for (const [key, value] of recordEntries) {
        lines.push(`${tomlQuotedKey(key)} = ${tomlString(value)}`);
      }
    }
    return lines.join("\n");
  });
  return [retained, ...blocks].filter(Boolean).join("\n\n") + "\n";
}

export function parseCodexToml(text: string, tool: string): McpServer[] {
  const servers = new Map<string, McpServer>();
  let currentName: string | null = null;
  let currentEnvName: string | null = null;
  let currentHeadersName: string | null = null;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const header = line.match(/^\[mcp_servers\.(?:"([^"]+)"|([A-Za-z0-9_-]+))(?:\.(env|http_headers))?\]$/);
    if (header) {
      const name = header[1] || header[2] || "";
      currentName = name;
      currentEnvName = line.endsWith(".env]") ? name : null;
      currentHeadersName = line.endsWith(".http_headers]") ? name : null;
      if (!servers.has(name)) {
        servers.set(name, { name, transport: "stdio", command: "", url: "", args: [], env: {}, headers: {}, targetTools: [tool], enabled: true });
      }
      continue;
    }
    if (!currentName) continue;
    const server = servers.get(currentName);
    if (!server) continue;
    const assignment = line.match(/^(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_-]*))\s*=\s*(.+)$/);
    if (!assignment) continue;
    const key = assignment[1] || assignment[2] || "";
    const value = assignment[3]!;
    if (currentEnvName) {
      server.env[key] = parseTomlString(value);
    } else if (currentHeadersName) {
      server.headers[key] = parseTomlString(value);
    } else if (key === "command") {
      server.command = parseTomlString(value);
    } else if (key === "args") {
      server.args = parseTomlStringArray(value);
    } else if (key === "url") {
      server.transport = "http";
      server.url = parseTomlString(value);
    }
  }
  return Array.from(servers.values()).filter((server) => server.command || server.url);
}

function stripManagedCodexServers(existing: string, names: string[]): string {
  if (names.length === 0) return existing;
  const lines = existing.split(/\r?\n/);
  const output: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const anyHeader = line.match(/^\[([^\]]+)\]$/);
    if (anyHeader) {
      const header = line.match(/^\[mcp_servers\.(?:"([^"]+)"|([A-Za-z0-9_-]+))(?:\.(?:env|http_headers))?\]$/);
      if (header) {
        const name = header[1] || header[2] || "";
        skipping = names.includes(name);
      } else {
        skipping = false;
      }
    }
    if (!skipping) output.push(line);
  }
  return output.join("\n");
}

function serverToJson(server: McpServer, kind: "claude-json" | "cursor-json"): Record<string, unknown> {
  if (server.transport === "http") {
    return {
      ...(kind === "claude-json" ? { type: "http" } : {}),
      url: server.url,
      ...(Object.keys(server.headers).length > 0 ? { headers: server.headers } : {}),
    };
  }
  return {
    command: server.command,
    args: server.args,
    ...(Object.keys(server.env).length > 0 ? { env: server.env } : {}),
  };
}

function serverToOpenCodeJson(server: McpServer): Record<string, unknown> {
  if (server.transport === "http") {
    return {
      type: "remote",
      url: server.url,
      enabled: server.enabled,
      ...(Object.keys(server.headers).length > 0 ? { headers: server.headers } : {}),
    };
  }
  return {
    type: "local",
    command: [server.command, ...server.args],
    enabled: server.enabled,
    ...(Object.keys(server.env).length > 0 ? { environment: server.env } : {}),
  };
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function parseStringRecord(value: unknown): Record<string, string> {
  const record = normalizeObject(value);
  return Object.fromEntries(Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

function parseTomlString(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.replace(/^"|"$/g, "");
    }
  }
  return trimmed;
}

function parseTomlStringArray(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return [];
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return trimmed.slice(1, -1).split(",").map((item) => parseTomlString(item)).filter(Boolean);
  }
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlQuotedKey(value: string): string {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : JSON.stringify(value);
}
