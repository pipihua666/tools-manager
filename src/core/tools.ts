import { homedir } from "node:os";
import { join } from "node:path";
import { pathExists } from "./fs";

export type ToolKey = "codex" | "claude_code" | "cursor";

export type ToolAdapter = {
  key: ToolKey;
  displayName: string;
  detectPath: string;
  skillsDir: string;
  projectSkillsDir: string;
  mcpKind: "codex-toml" | "claude-json" | "cursor-json";
  mcpPath: string;
};

export const toolAdapters: ToolAdapter[] = [
  {
    key: "codex",
    displayName: "Codex",
    detectPath: join(homedir(), ".codex"),
    skillsDir: join(homedir(), ".codex", "skills"),
    projectSkillsDir: ".codex/skills",
    mcpKind: "codex-toml",
    mcpPath: join(homedir(), ".codex", "config.toml"),
  },
  {
    key: "claude_code",
    displayName: "Claude Code",
    detectPath: join(homedir(), ".claude"),
    skillsDir: join(homedir(), ".claude", "skills"),
    projectSkillsDir: ".claude/skills",
    mcpKind: "claude-json",
    mcpPath: join(homedir(), ".claude", "mcp.json"),
  },
  {
    key: "cursor",
    displayName: "Cursor",
    detectPath: join(homedir(), ".cursor"),
    skillsDir: join(homedir(), ".cursor", "skills"),
    projectSkillsDir: ".cursor/skills",
    mcpKind: "cursor-json",
    mcpPath: join(homedir(), ".cursor", "mcp.json"),
  },
];

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
  return Promise.all(toolAdapters.map(async (tool) => ({ ...tool, installed: await pathExists(tool.detectPath) })));
}
