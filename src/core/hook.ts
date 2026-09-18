import { readdir } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { backupFile, pathExists, readTextIfExists, writeText } from "./fs";
import { getTool, resolveTools, type ToolAdapter } from "./tools";

type JsonObject = Record<string, unknown>;

export type HookHandler = {
  id: string;
  source: string;
  sourcePath: string;
  scope: "user" | "plugin";
  matcher: string;
  type: string;
  command: string;
  enabled: boolean;
  trusted: boolean;
  editable: boolean;
};

export type HookEvent = {
  name: string;
  description: string;
  installed: number;
  active: number;
  handlers: HookHandler[];
};

export type AgentHookConfig = {
  tool: string;
  displayName: string;
  path: string;
  kind: ToolAdapter["hookKind"];
  editable: boolean;
  configured: boolean;
  eventCount: number;
  commandCount: number;
  events: Array<Omit<HookEvent, "handlers">>;
};

export type AgentHookDetail = AgentHookConfig & {
  event: HookEvent;
  content: string;
};

const EVENT_CATALOG: Record<string, Array<[string, string]>> = {
  codex: [
    ["PreToolUse", "Before a tool executes"],
    ["PermissionRequest", "When permission is requested"],
    ["PostToolUse", "After a tool executes"],
    ["PreCompact", "Before context compaction"],
    ["PostCompact", "After context compaction"],
    ["SessionStart", "When a new session starts"],
    ["SessionEnd", "Right before a session ends"],
    ["UserPromptSubmit", "When the user submits a prompt"],
    ["SubagentStart", "When a subagent is created"],
    ["SubagentStop", "Right before a subagent ends its turn"],
    ["Stop", "Right before Codex ends its turn"],
    ["Interrupt", "Right before an interrupted turn is aborted"],
  ],
  claude_code: [
    ["PreToolUse", "Before a tool executes"], ["PermissionRequest", "When permission is requested"],
    ["PostToolUse", "After a tool executes"], ["PostToolUseFailure", "After a tool execution fails"],
    ["Notification", "When Claude Code sends a notification"], ["UserPromptSubmit", "When the user submits a prompt"],
    ["SessionStart", "When a session starts or resumes"], ["SessionEnd", "When a session ends"],
    ["Stop", "When the main agent finishes responding"], ["SubagentStart", "When a subagent starts"],
    ["SubagentStop", "When a subagent finishes"], ["PreCompact", "Before context compaction"],
  ],
  cursor: [
    ["beforeShellExecution", "Before a shell command executes"], ["afterShellExecution", "After a shell command executes"],
    ["beforeMCPExecution", "Before an MCP tool executes"], ["afterMCPExecution", "After an MCP tool executes"],
    ["beforeReadFile", "Before a file is read"], ["afterFileEdit", "After a file is edited"],
    ["beforeSubmitPrompt", "Before a prompt is submitted"], ["stop", "When an agent turn stops"],
  ],
  opencode: [],
};

export async function listAgentHooks(toolInput = "all", tools?: ToolAdapter[]): Promise<AgentHookConfig[]> {
  return Promise.all(selectTools(toolInput, tools).map(async (tool) => summarize(tool, await readEvents(tool))));
}

export async function getAgentHooks(toolInput: string, eventName: string, tools?: ToolAdapter[]): Promise<AgentHookDetail> {
  const tool = oneTool(toolInput, tools);
  const events = await readEvents(tool);
  const event = events.find((item) => item.name === eventName);
  if (!event) throw new Error(`Unknown hook event: ${eventName}`);
  const root = await readUserHookRoot(tool);
  const hooks = hookMap(root);
  const content = JSON.stringify(Array.isArray(hooks[eventName]) ? hooks[eventName] : [], null, 2);
  return { ...summarize(tool, events), event, content };
}

export async function updateAgentHooks(toolInput: string, eventName: string, content: string, tools?: ToolAdapter[]): Promise<AgentHookDetail> {
  const tool = oneTool(toolInput, tools);
  if (tool.hookKind === "opencode-plugin") throw new Error("OpenCode hooks are implemented as plugin code and cannot be edited here.");
  let value: unknown;
  try { value = JSON.parse(content); } catch { throw new Error("Event handlers must be valid JSON."); }
  if (!Array.isArray(value)) throw new Error("Event handlers must be a JSON array.");
  const root = await readUserHookRoot(tool);
  const hooks = hookMap(root);
  if (value.length) hooks[eventName] = value;
  else delete hooks[eventName];
  root.hooks = hooks;
  if (tool.hookKind === "cursor-json" && root.version === undefined) root.version = 1;
  await backupFile(tool.hookPath);
  await writeText(tool.hookPath, JSON.stringify(root, null, 2) + "\n");
  return getAgentHooks(toolInput, eventName, tools);
}

export async function updateCodexHookState(stateId: string, enabled: boolean, tools?: ToolAdapter[]): Promise<HookHandler> {
  const tool = oneTool("codex", tools);
  const events = await readEvents(tool);
  const handler = events.flatMap((event) => event.handlers).find((item) => item.id === stateId);
  if (!handler || handler.scope !== "plugin") throw new Error("Hook handler was not found.");
  if (!handler.trusted) throw new Error("Review and trust this hook in Codex /hooks before enabling it here.");
  const source = await readTextIfExists(tool.mcpPath) || "";
  await backupFile(tool.mcpPath);
  const codexStateId = stateId.slice(stateId.indexOf("|") + 1);
  await writeText(tool.mcpPath, renderCodexHookEnabled(source, codexStateId, enabled));
  return { ...handler, enabled };
}

async function readEvents(tool: ToolAdapter): Promise<HookEvent[]> {
  const root = await readUserHookRoot(tool);
  const handlers = flattenHooks(tool, hookMap(root), "User configuration", tool.hookPath, "user", new Map());
  if (tool.key === "codex") handlers.push(...await readCodexPluginHandlers(tool));
  const descriptions = new Map(EVENT_CATALOG[tool.key] || []);
  for (const handler of handlers) if (!descriptions.has(handler.id.split("|")[0]!)) descriptions.set(handler.id.split("|")[0]!, "Custom lifecycle event");
  return [...descriptions].map(([name, description]) => {
    const matching = handlers.filter((handler) => handler.id.startsWith(name + "|"));
    return { name, description, installed: matching.length, active: matching.filter((handler) => handler.enabled).length, handlers: matching };
  });
}

async function readUserHookRoot(tool: ToolAdapter): Promise<JsonObject> {
  if (tool.hookKind === "opencode-plugin") return {};
  const source = await readTextIfExists(tool.hookPath);
  if (!source?.trim()) return {};
  return parseJsonObject(source, `${tool.displayName} hook configuration`);
}

async function readCodexPluginHandlers(tool: ToolAdapter): Promise<HookHandler[]> {
  const configSource = await readTextIfExists(tool.mcpPath) || "";
  let parsed: JsonObject = {};
  try { parsed = Bun.TOML.parse(configSource) as JsonObject; } catch { throw new Error("Codex config.toml is not valid TOML."); }
  const plugins = isObject(parsed.plugins) ? parsed.plugins : {};
  const stateRoot = isObject(parsed.hooks) && isObject(parsed.hooks.state) ? parsed.hooks.state : {};
  const states = new Map(Object.entries(stateRoot).map(([id, value]) => [id, isObject(value) ? value : {}]));
  const cacheRoot = join(dirname(tool.hookPath), "plugins", "cache");
  const handlers: HookHandler[] = [];
  for (const [pluginId, setting] of Object.entries(plugins)) {
    if (!isObject(setting) || setting.enabled !== true) continue;
    const [pluginName, marketplace] = pluginId.split("@");
    if (!pluginName || !marketplace) continue;
    const pluginRoot = join(cacheRoot, marketplace, pluginName);
    if (!(await pathExists(pluginRoot))) continue;
    const versions = (await readdir(pluginRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
    const versionRoot = versions[0] ? join(pluginRoot, versions[0]) : pluginRoot;
    let hookRelativePath = join("hooks", "hooks.json");
    const manifestSource = await readTextIfExists(join(versionRoot, ".codex-plugin", "plugin.json"));
    if (manifestSource) {
      const manifest = parseJsonObject(manifestSource, `${pluginId} plugin manifest`);
      if (typeof manifest.hooks === "string" && manifest.hooks.trim()) hookRelativePath = manifest.hooks.replace(/^\.\//, "");
    }
    const hookPath = join(versionRoot, hookRelativePath);
    const source = await readTextIfExists(hookPath);
    if (!source) continue;
    const root = parseJsonObject(source, `${pluginId} hook manifest`);
    handlers.push(...flattenHooks(tool, hookMap(root), pluginId, hookPath, "plugin", states, pluginId, relative(versionRoot, hookPath)));
  }
  return handlers;
}

function flattenHooks(tool: ToolAdapter, hooks: JsonObject, source: string, sourcePath: string, scope: "user" | "plugin", states: Map<string, JsonObject>, pluginId = "user", relativePath = basename(sourcePath)): HookHandler[] {
  const result: HookHandler[] = [];
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    groups.forEach((group, groupIndex) => {
      if (!isObject(group)) return;
      const nested = Array.isArray(group.hooks) ? group.hooks : [group];
      nested.forEach((raw, handlerIndex) => {
        if (!isObject(raw)) return;
        const stateId = `${pluginId}:${relativePath}:${snakeCase(event)}:${groupIndex}:${handlerIndex}`;
        const state = states.get(stateId);
        const trusted = scope === "user" ? tool.key !== "codex" : typeof state?.trusted_hash === "string";
        const enabled = scope === "user" ? tool.key !== "codex" : trusted && state?.enabled !== false;
        result.push({
          id: `${event}|${scope === "plugin" ? stateId : `${sourcePath}:${groupIndex}:${handlerIndex}`}`,
          source, sourcePath, scope, matcher: typeof group.matcher === "string" ? group.matcher : "All",
          type: typeof raw.type === "string" ? raw.type : "command",
          command: typeof raw.command === "string" ? raw.command : typeof raw.tool === "string" ? raw.tool : "",
          enabled, trusted, editable: scope === "user",
        });
      });
    });
  }
  return result;
}

function summarize(tool: ToolAdapter, events: HookEvent[]): AgentHookConfig {
  const installed = events.reduce((sum, event) => sum + event.installed, 0);
  return {
    tool: tool.key, displayName: tool.displayName, path: tool.hookPath, kind: tool.hookKind,
    editable: tool.hookKind !== "opencode-plugin", configured: installed > 0,
    eventCount: events.filter((event) => event.installed > 0).length, commandCount: installed,
    events: events.map(({ handlers: _handlers, ...event }) => event),
  };
}

function hookMap(root: JsonObject): JsonObject {
  if (isObject(root.hooks)) return root.hooks;
  return {};
}

function oneTool(toolInput: string, tools?: ToolAdapter[]): ToolAdapter {
  const selected = selectTools(toolInput, tools);
  if (selected.length !== 1) throw new Error("Select one Agent.");
  return selected[0]!;
}

function selectTools(toolInput: string, tools?: ToolAdapter[]): ToolAdapter[] {
  if (!tools) return resolveTools(toolInput);
  if (toolInput === "all") return tools;
  const tool = tools.find((item) => item.key === toolInput);
  return [tool || getTool(toolInput)];
}

function parseJsonObject(source: string, label: string): JsonObject {
  let parsed: unknown;
  try { parsed = JSON.parse(source); } catch { throw new Error(`${label} is not valid JSON.`); }
  if (!isObject(parsed)) throw new Error(`${label} must contain a JSON object.`);
  return parsed;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function snakeCase(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[-\s]+/g, "_").toLowerCase();
}

export function renderCodexHookEnabled(source: string, stateId: string, enabled: boolean): string {
  const escaped = stateId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const header = new RegExp(`^\\[hooks\\.state\\."${escaped}"\\]\\s*$`, "m");
  const match = header.exec(source);
  if (!match) throw new Error("Codex hook state was not found. Review it in Codex /hooks first.");
  const sectionStart = match.index + match[0].length;
  const nextHeader = /^\s*\[/m.exec(source.slice(sectionStart));
  const sectionEnd = nextHeader ? sectionStart + nextHeader.index : source.length;
  const section = source.slice(sectionStart, sectionEnd);
  const line = `enabled = ${enabled}`;
  const updated = /^[ \t]*enabled\s*=.*$/m.test(section)
    ? section.replace(/^[ \t]*enabled\s*=.*$/m, line)
    : section.replace(/^\s*/, `\n${line}\n`);
  return source.slice(0, sectionStart) + updated + source.slice(sectionEnd);
}
