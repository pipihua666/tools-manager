import { randomUUID } from "node:crypto";
import { initManager } from "../core/init";
import { status } from "../core/status";
import { listAgentOverview } from "../core/agent";
import {
  addLocalAgentSkills,
  addSkills,
  findSkillAgentLinks,
  listAgentSkills,
  getSkill,
  listSkills,
  readSkillMarkdown,
  readAgentSkillMarkdown,
  removeSkill,
  removeSkillAgentLink,
  updateSkillMarkdown,
} from "../core/skill";
import { applyPreset, createPreset, getPresetSkills, listPresets, moveSkillsPreset, removeSkillsFromPreset, syncSkill, type SyncMode } from "../core/preset";
import {
  addMcpServer,
  getMcpServer,
  importMcpFromTools,
  listMcpServers,
  removeMcpServer,
  syncMcp,
  syncMcpServer,
  updateMcpServer,
  type McpServer,
} from "../core/mcp";
import { backup } from "../core/backup";
import { toolAdapters } from "../core/tools";
import { webAppHtml } from "./app";

export type WebServerOptions = {
  port?: number;
  open?: boolean;
  hostname?: string;
  dev?: boolean;
};

type WebHandlerOptions = {
  dev?: boolean;
  bootId?: string;
};

type JsonRecord = Record<string, unknown>;

const MAX_BODY_BYTES = 1024 * 1024;

export async function startWebDashboard(options: WebServerOptions = {}): Promise<void> {
  await initManager();
  const hostname = options.hostname || "127.0.0.1";
  const token = randomUUID();
  const bootId = randomUUID();
  const server = listen(hostname, options.port, token, { dev: Boolean(options.dev), bootId });
  const url = `http://${hostname}:${server.port}`;

  console.log(`Tools Manager Web: ${url}`);
  if (options.dev) console.log("Development reload enabled.");
  console.log("Press Ctrl+C to stop.");
  if (options.open !== false) openBrowser(url);

  await new Promise<void>((resolve) => {
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      server.stop(true);
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      resolve();
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  });
}

function listen(hostname: string, requestedPort: number | undefined, token: string, options: WebHandlerOptions): ReturnType<typeof Bun.serve> {
  const ports = requestedPort === undefined
    ? Array.from({ length: 10 }, (_, index) => 4343 + index)
    : [requestedPort];
  let lastError: unknown;
  for (const port of ports) {
    try {
      return Bun.serve({
        hostname,
        port,
        fetch: (request) => handleRequest(request, token, hostname, port, options),
        error: (error) => json({ error: error.message || "Internal server error." }, 500),
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to start the web dashboard.");
}

export function createWebHandler(token: string, hostname = "127.0.0.1", port = 4343, options: WebHandlerOptions = {}) {
  return (request: Request) => handleRequest(request, token, hostname, port, options);
}

async function handleRequest(request: Request, token: string, hostname: string, port: number, options: WebHandlerOptions): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/" && request.method === "GET") {
    return new Response(
      webAppHtml
        .replaceAll("__TM_TOKEN__", token)
        .replaceAll("__TM_DEV__", options.dev ? "true" : "false"),
      {
        headers: pageHeaders(),
      },
    );
  }
  if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 });
  if (!url.pathname.startsWith("/api/")) return json({ error: "Not found." }, 404);
  if (isCrossSite(request, hostname, port)) return json({ error: "Cross-site requests are not allowed." }, 403);
  if (request.method === "GET" && url.pathname === "/api/dev-events") {
    return options.dev ? devEvents(options.bootId || "dev") : json({ error: "Not found." }, 404);
  }
  if (request.method !== "GET" && request.headers.get("x-tm-token") !== token) {
    return json({ error: "Invalid web session token." }, 403);
  }

  try {
    if (request.method === "GET" && url.pathname === "/api/snapshot") return json(await snapshot());
    if (request.method === "GET" && url.pathname.startsWith("/api/agent-skills/")) {
      const [tool, name] = pathParts(url.pathname, "/api/agent-skills/", 2);
      const selectedTool = optionalTool(tool);
      if (selectedTool === "all") throw new Error("Select one Agent.");
      const result = await listAgentSkills(selectedTool);
      const skill = result[0]?.skills.find((item) => item.name === name);
      if (!skill) return json({ error: `Agent skill not found: ${name}` }, 404);
      return json({ skill, markdown: await readAgentSkillMarkdown(skill) });
    }
    if (request.method === "GET" && url.pathname.startsWith("/api/skills/")) {
      const name = pathTail(url.pathname, "/api/skills/");
      const skill = await getSkill(name);
      if (!skill) return json({ error: `Skill not found: ${name}` }, 404);
      return json({ skill, markdown: await readSkillMarkdown(skill), agentLinks: await findSkillAgentLinks(skill) });
    }
    if (request.method === "POST" && url.pathname === "/api/skills/import") {
      const body = await readBody(request);
      return json({ skills: await addSkills(requiredString(body, "source"), optionalPreset(body.preset)) }, 201);
    }
    if (request.method === "POST" && url.pathname === "/api/skills/import-agent") {
      const body = await readBody(request);
      return json({ results: await addLocalAgentSkills(optionalTool(body.tool), toolAdapters, optionalPreset(body.preset)) }, 201);
    }
    if (request.method === "POST" && url.pathname === "/api/skills/sync-selected") {
      const body = await readBody(request);
      const results = [];
      for (const name of requiredNames(body)) results.push(...await syncSkill(name, optionalTool(body.tool), optionalSyncMode(body.mode)));
      return json({ results });
    }
    if (request.method === "PUT" && url.pathname.startsWith("/api/skills/")) {
      const name = pathTail(url.pathname, "/api/skills/");
      const body = await readBody(request);
      return json({ skill: await updateSkillMarkdown(name, requiredString(body, "markdown")) });
    }
    if (request.method === "DELETE" && url.pathname.startsWith("/api/skills/")) {
      const name = pathTail(url.pathname, "/api/skills/");
      const tool = optionalTool(url.searchParams.get("tool"));
      if (tool !== "all") return json(await removeSkillAgentLink(name, tool));
      return json(await removeSkill(name, { removeAgentLinks: true }));
    }
    if (request.method === "POST" && url.pathname === "/api/presets") {
      const body = await readBody(request);
      return json({ preset: await createPreset(requiredString(body, "name")) }, 201);
    }
    if (request.method === "POST" && url.pathname === "/api/presets/apply") {
      const body = await readBody(request);
      const mode = optionalSyncMode(body.mode);
      return json({ results: await applyPreset(requiredString(body, "preset"), optionalTool(body.tool), mode) });
    }
    if (request.method === "POST" && url.pathname === "/api/presets/move-skill") {
      const body = await readBody(request);
      return json(await moveSkillsPreset(requiredSkillNames(body), requiredString(body, "from"), requiredString(body, "to")));
    }
    if (request.method === "POST" && url.pathname === "/api/presets/remove-skill") {
      const body = await readBody(request);
      return json(await removeSkillsFromPreset(requiredSkillNames(body), requiredString(body, "preset")));
    }
    if (request.method === "POST" && url.pathname === "/api/mcp") {
      const server = parseMcpServer(await readBody(request));
      await addMcpServer(server);
      return json({ server }, 201);
    }
    if (request.method === "GET" && url.pathname.startsWith("/api/mcp/")) {
      const name = pathTail(url.pathname, "/api/mcp/");
      const server = await getMcpServer(name);
      return server ? json({ server }) : json({ error: `MCP server not found: ${name}` }, 404);
    }
    if (request.method === "PUT" && url.pathname.startsWith("/api/mcp/")) {
      const name = pathTail(url.pathname, "/api/mcp/");
      const server = parseMcpServer(await readBody(request));
      return json({ server: await updateMcpServer(name, server) });
    }
    if (request.method === "DELETE" && url.pathname.startsWith("/api/mcp/")) {
      return json({ server: await removeMcpServer(pathTail(url.pathname, "/api/mcp/")) });
    }
    if (request.method === "POST" && url.pathname === "/api/mcp/import") {
      const body = await readBody(request);
      return json({ results: await importMcpFromTools(optionalTool(body.tool)) });
    }
    if (request.method === "POST" && url.pathname === "/api/mcp/sync") {
      const body = await readBody(request);
      return json({ results: await syncMcp(optionalTool(body.tool)) });
    }
    if (request.method === "POST" && url.pathname === "/api/mcp/sync-selected") {
      const body = await readBody(request);
      const results = [];
      for (const name of requiredNames(body)) results.push(...await syncMcpServer(name, optionalTool(body.tool)));
      return json({ results });
    }
    if (request.method === "POST" && url.pathname === "/api/backup") return json(await backup());
    return json({ error: "Not found." }, 404);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
}

function devEvents(bootId: string): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${bootId}\n\n`));
    },
  }), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

async function snapshot() {
  const [managerStatus, skills, presets, mcpServers, agents] = await Promise.all([
    status(),
    listSkills(),
    listPresets(),
    listMcpServers(),
    listAgentOverview("all"),
  ]);
  const presetDetails = await Promise.all(presets.map(async (preset) => ({
    ...preset,
    skills: (await getPresetSkills(preset.name)).map((skill) => skill.name),
  })));
  const skillDetails = await Promise.all(skills.map(async (skill) => ({
    ...skill,
    scope: "user" as const,
    editable: true,
    agentLinks: await findSkillAgentLinks(skill),
  })));
  return {
    status: managerStatus,
    skills: skillDetails,
    presets: presetDetails,
    mcpServers: mcpServers.map(({ env, headers, ...server }) => ({
      ...server,
      envKeys: Object.keys(env),
      headerKeys: Object.keys(headers),
    })),
    agents: agents.map((agent) => ({
      ...agent,
      skills: agent.skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        path: skill.path,
        scope: skill.scope,
        editable: skill.editable,
      })),
      mcpServers: agent.mcpServers.map(({ env, headers, ...server }) => ({
        ...server,
        envKeys: Object.keys(env),
        headerKeys: Object.keys(headers),
      })),
    })),
  };
}

async function readBody(request: Request): Promise<JsonRecord> {
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_BODY_BYTES) throw new Error("Request body is too large.");
  const body = await request.json().catch(() => null) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Expected a JSON object.");
  return body as JsonRecord;
}

function requiredString(body: JsonRecord, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing required field: ${key}`);
  return value.trim();
}

function optionalTool(value: unknown): string {
  if (value === undefined || value === null || value === "") return "all";
  if (typeof value !== "string") throw new Error("Tool must be a string.");
  const allowed = ["all", ...toolAdapters.map((tool) => tool.key)];
  if (!allowed.includes(value)) throw new Error(`Unknown tool: ${value}`);
  return value;
}

function optionalPreset(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Default";
  if (typeof value !== "string" || !value.trim()) throw new Error("Preset must be a non-empty string.");
  return value.trim();
}

function requiredNames(body: JsonRecord): string[] {
  const value = body.names;
  if (!Array.isArray(value) || value.length === 0 || !value.every((name) => typeof name === "string" && name.trim())) {
    throw new Error("Select at least one resource.");
  }
  return [...new Set(value.map((name) => name.trim()))];
}

function requiredSkillNames(body: JsonRecord): string[] {
  if (Array.isArray(body.names)) return requiredNames(body);
  return [requiredString(body, "skill")];
}

function optionalSyncMode(value: unknown): SyncMode | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value !== "symlink" && value !== "copy") throw new Error("Mode must be symlink or copy.");
  return value;
}

function parseMcpServer(body: JsonRecord): McpServer {
  const transport = body.transport;
  const args = body.args;
  const env = body.env;
  const headers = body.headers;
  const targetTools = body.targetTools;
  if (transport !== "stdio" && transport !== "http") throw new Error("Transport must be stdio or http.");
  if (!Array.isArray(args) || !args.every((item) => typeof item === "string")) throw new Error("Args must be a string array.");
  if (!env || typeof env !== "object" || Array.isArray(env) || !Object.values(env).every((item) => typeof item === "string")) {
    throw new Error("Env must be a string record.");
  }
  if (!headers || typeof headers !== "object" || Array.isArray(headers) || !Object.values(headers).every((item) => typeof item === "string")) {
    throw new Error("Headers must be a string record.");
  }
  if (!Array.isArray(targetTools) || targetTools.length === 0 || !targetTools.every((item) => typeof item === "string")) {
    throw new Error("Select at least one target tool.");
  }
  for (const tool of targetTools) optionalTool(tool);
  const command = optionalString(body.command);
  const url = optionalString(body.url);
  if (transport === "stdio" && !command) throw new Error("Missing required field: command");
  if (transport === "http") validateMcpUrl(url);
  return {
    name: requiredString(body, "name"),
    transport,
    command: transport === "stdio" ? command : "",
    url: transport === "http" ? url : "",
    args: transport === "stdio" ? args : [],
    env: transport === "stdio" ? env as Record<string, string> : {},
    headers: transport === "http" ? headers as Record<string, string> : {},
    targetTools: [...new Set(targetTools)],
    enabled: body.enabled !== false,
  };
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateMcpUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("MCP URL must be a valid http:// or https:// URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("MCP URL must use http:// or https://.");
}

function pathTail(pathname: string, prefix: string): string {
  const value = decodeURIComponent(pathname.slice(prefix.length));
  if (!value || value.includes("/")) throw new Error("Invalid resource name.");
  return value;
}

function pathParts(pathname: string, prefix: string, count: number): string[] {
  const parts = pathname.slice(prefix.length).split("/").map(decodeURIComponent);
  if (parts.length !== count || parts.some((part) => !part)) throw new Error("Invalid resource path.");
  return parts;
}

function isCrossSite(request: Request, hostname: string, port: number): boolean {
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  const origin = request.headers.get("origin");
  return Boolean(origin && origin !== `http://${hostname}:${port}`);
}

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function pageHeaders(): HeadersInit {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

function openBrowser(url: string): void {
  const command = process.platform === "darwin"
    ? ["open", url]
    : process.platform === "win32"
      ? ["cmd", "/c", "start", "", url]
      : ["xdg-open", url];
  try {
    Bun.spawn(command, { stdout: "ignore", stderr: "ignore" });
  } catch {
    // The URL is still printed when no browser opener is available.
  }
}
