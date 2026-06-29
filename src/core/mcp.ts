import { dirname } from "node:path";
import { openDb, type McpServerRow } from "./db";
import { parseJsonArray, parseJsonRecord, stableJson } from "./json";
import { backupFile, ensureDir, readTextIfExists, writeText } from "./fs";
import { resolveTools, type ToolAdapter } from "./tools";

export type McpServer = {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  targetTools: string[];
  enabled: boolean;
};

export async function addMcpServer(input: McpServer): Promise<void> {
  const db = await openDb();
  db.query(`
    INSERT INTO mcp_servers (name, command, args_json, env_json, target_tools_json, enabled, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(name) DO UPDATE SET
      command = excluded.command,
      args_json = excluded.args_json,
      env_json = excluded.env_json,
      target_tools_json = excluded.target_tools_json,
      enabled = excluded.enabled,
      updated_at = CURRENT_TIMESTAMP
  `).run(
    input.name,
    input.command,
    stableJson(input.args),
    stableJson(input.env),
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

function parseToolMcp(tool: ToolAdapter, text: string | null): McpServer[] {
  if (!text?.trim()) return [];
  return tool.mcpKind === "codex-toml" ? parseCodexToml(text, tool.key) : parseMcpJson(text, tool.key);
}

function rowToServer(row: McpServerRow): McpServer {
  return {
    name: row.name,
    command: row.command,
    args: parseJsonArray(row.args_json),
    env: parseJsonRecord(row.env_json),
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
  await writeText(tool.mcpPath, renderMcpJson(await readTextIfExists(tool.mcpPath), servers));
  return backup;
}

export function renderMcpJson(existing: string | null, servers: McpServer[]): string {
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
    mcpServers[server.name] = serverToJson(server);
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
      const command = typeof server.command === "string" ? server.command : "";
      if (!command) return [];
      return [{
        name,
        command,
        args: Array.isArray(server.args) ? server.args.map(String) : [],
        env: parseStringRecord(server.env),
        targetTools: [tool],
        enabled: true,
      }];
    });
  } catch {
    return [];
  }
}

export function renderCodexToml(existing: string | null, servers: McpServer[]): string {
  const retained = stripManagedCodexServers(existing || "", servers.map((server) => server.name)).trimEnd();
  const blocks = servers.map((server) => {
    const lines = [
      `[mcp_servers.${tomlQuotedKey(server.name)}]`,
      `command = ${tomlString(server.command)}`,
      `args = [${server.args.map(tomlString).join(", ")}]`,
    ];
    const envEntries = Object.entries(server.env);
    if (envEntries.length > 0) {
      lines.push("");
      lines.push(`[mcp_servers.${tomlQuotedKey(server.name)}.env]`);
      for (const [key, value] of envEntries) {
        lines.push(`${key} = ${tomlString(value)}`);
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
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const header = line.match(/^\[mcp_servers\.(?:"([^"]+)"|([^\].]+))(?:\.env)?\]$/);
    if (header) {
      const name = header[1] || header[2] || "";
      currentName = name;
      currentEnvName = line.endsWith(".env]") ? name : null;
      if (!servers.has(name)) {
        servers.set(name, { name, command: "", args: [], env: {}, targetTools: [tool], enabled: true });
      }
      continue;
    }
    if (!currentName) continue;
    const server = servers.get(currentName);
    if (!server) continue;
    const assignment = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (!assignment) continue;
    const key = assignment[1]!;
    const value = assignment[2]!;
    if (currentEnvName) {
      server.env[key] = parseTomlString(value);
    } else if (key === "command") {
      server.command = parseTomlString(value);
    } else if (key === "args") {
      server.args = parseTomlStringArray(value);
    }
  }
  return Array.from(servers.values()).filter((server) => server.command);
}

function stripManagedCodexServers(existing: string, names: string[]): string {
  if (names.length === 0) return existing;
  const lines = existing.split(/\r?\n/);
  const output: string[] = [];
  let skipping = false;
  for (const line of lines) {
    const anyHeader = line.match(/^\[([^\]]+)\]$/);
    if (anyHeader) {
      const header = line.match(/^\[mcp_servers\.(?:"([^"]+)"|([^\].]+))(?:\.env)?\]$/);
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

function serverToJson(server: McpServer): Record<string, unknown> {
  return {
    command: server.command,
    args: server.args,
    ...(Object.keys(server.env).length > 0 ? { env: server.env } : {}),
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
