import { homedir } from "node:os";
import { join } from "node:path";
import { pathExists } from "./fs";

export type ToolKey = "codex" | "claude_code" | "cursor" | "opencode";

export type ToolAdapter = {
  key: ToolKey;
  displayName: string;
  detectPath: string;
  skillsDir: string;
  additionalSkillsDirs?: string[];
  systemSkillsDirs?: string[];
  projectSkillsDir: string;
  mcpKind: "codex-toml" | "claude-json" | "cursor-json" | "opencode-json";
  mcpPath: string;
  hookKind: "codex-hooks" | "codex-notify" | "claude-json" | "cursor-json" | "opencode-plugin";
  hookPath: string;
  installCommands?: string[];
  installPaths?: string[];
};

export const toolAdapters: ToolAdapter[] = [
  {
    key: "codex",
    displayName: "Codex",
    detectPath: join(homedir(), ".codex"),
    skillsDir: join(homedir(), ".codex", "skills"),
    additionalSkillsDirs: [join(homedir(), ".agents", "skills")],
    systemSkillsDirs: [join(homedir(), ".codex", "skills", ".system")],
    projectSkillsDir: ".codex/skills",
    mcpKind: "codex-toml",
    mcpPath: join(homedir(), ".codex", "config.toml"),
    hookKind: "codex-hooks",
    hookPath: join(homedir(), ".codex", "hooks.json"),
    installCommands: ["codex"],
    installPaths: ["/Applications/Codex.app"],
  },
  {
    key: "claude_code",
    displayName: "Claude Code",
    detectPath: join(homedir(), ".claude"),
    skillsDir: join(homedir(), ".claude", "skills"),
    additionalSkillsDirs: [join(homedir(), ".agents", "skills")],
    projectSkillsDir: ".claude/skills",
    mcpKind: "claude-json",
    mcpPath: join(homedir(), ".claude", "mcp.json"),
    hookKind: "claude-json",
    hookPath: join(homedir(), ".claude", "settings.json"),
    installCommands: ["claude"],
  },
  {
    key: "cursor",
    displayName: "Cursor",
    detectPath: join(homedir(), ".cursor"),
    skillsDir: join(homedir(), ".cursor", "skills"),
    projectSkillsDir: ".cursor/skills",
    mcpKind: "cursor-json",
    mcpPath: join(homedir(), ".cursor", "mcp.json"),
    hookKind: "cursor-json",
    hookPath: join(homedir(), ".cursor", "hooks.json"),
    installCommands: ["cursor"],
    installPaths: ["/Applications/Cursor.app"],
  },
  {
    key: "opencode",
    displayName: "OpenCode",
    detectPath: join(homedir(), ".config", "opencode"),
    skillsDir: join(homedir(), ".config", "opencode", "skills"),
    projectSkillsDir: ".opencode/skills",
    mcpKind: "opencode-json",
    mcpPath: join(homedir(), ".config", "opencode", "opencode.json"),
    hookKind: "opencode-plugin",
    hookPath: join(homedir(), ".config", "opencode", "plugins"),
    installCommands: ["opencode"],
    installPaths: ["/Applications/OpenCode.app"],
  },
];

export function getToolSkillsDirs(tool: ToolAdapter): string[] {
  return [...new Set([tool.skillsDir, ...(tool.additionalSkillsDirs || [])])];
}

export function getToolSkillLocations(tool: ToolAdapter): Array<{ path: string; scope: "user" | "system"; editable: boolean }> {
  return [
    ...getToolSkillsDirs(tool).map((path) => ({ path, scope: "user" as const, editable: false })),
    ...(tool.systemSkillsDirs || []).map((path) => ({ path, scope: "system" as const, editable: false })),
  ];
}

export function getTool(key: string): ToolAdapter {
  const tool = toolAdapters.find((adapter) => adapter.key === key);
  if (!tool) throw new Error(`Unknown tool: ${key}. Expected one of: ${toolAdapters.map((t) => t.key).join(", ")}`);
  return tool;
}

export function resolveTools(input?: string): ToolAdapter[] {
  if (!input || input === "all") return toolAdapters;
  return [getTool(input)];
}

export async function detectTools(): Promise<Array<ToolAdapter & { installed: boolean }>> {
  return Promise.all(toolAdapters.map(async (tool) => ({ ...tool, installed: await isToolInstalled(tool) })));
}

export async function isToolInstalled(tool: ToolAdapter): Promise<boolean> {
  const commands = tool.installCommands || [];
  const installPaths = tool.installPaths || [];
  if (commands.length || installPaths.length) {
    if (commands.some((command) => Bun.which(command) !== null)) return true;
    return (await Promise.all(installPaths.map(pathExists))).some(Boolean);
  }
  return pathExists(tool.detectPath);
}
