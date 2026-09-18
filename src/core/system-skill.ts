import { readdir } from "node:fs/promises";
import type { ToolAdapter } from "./tools";

export async function findSystemSkillNames(tools: ToolAdapter[]): Promise<Set<string>> {
  const names = new Set<string>();
  for (const tool of tools) {
    for (const skillsDir of tool.systemSkillsDirs || []) {
      let entries;
      try {
        entries = await readdir(skillsDir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if ((entry.isDirectory() || entry.isSymbolicLink()) && !entry.name.startsWith(".")) names.add(entry.name);
      }
    }
  }
  return names;
}
