import { homedir } from "node:os";
import { join } from "node:path";

export type ManagerPaths = {
  root: string;
  skillsDir: string;
  cacheGitDir: string;
  logsDir: string;
  dbPath: string;
  configPath: string;
};

export function managerRoot(): string {
  return process.env.TOOLS_MANAGER_HOME || join(homedir(), ".tools-manager");
}

export function paths(): ManagerPaths {
  const root = managerRoot();
  return {
    root,
    skillsDir: join(root, "skills"),
    cacheGitDir: join(root, "cache", "git"),
    logsDir: join(root, "logs"),
    dbPath: join(root, "tools-manager.db"),
    configPath: join(root, "config.toml"),
  };
}

export function expandHome(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return join(homedir(), input.slice(2));
  return input;
}
