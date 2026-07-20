import { paths } from "./paths";
import { ensureDir, pathExists, readTextIfExists, writeText } from "./fs";

export type AppConfig = {
  syncMode: "symlink" | "copy";
  gitRemote?: string;
};

export const defaultConfig: AppConfig = {
  syncMode: "symlink",
};

export async function ensureConfig(): Promise<void> {
  const p = paths();
  await ensureDir(p.root);
  if (!(await pathExists(p.configPath))) {
    await writeText(
      p.configPath,
      [
        '# Tools Manager configuration',
        'sync_mode = "symlink"',
        "",
        "# Optional remote used by `tm backup`.",
        "# git_remote = \"git@github.com:you/tools-manager-skills.git\"",
        "",
      ].join("\n"),
    );
  }
}

export async function readConfig(): Promise<AppConfig> {
  await ensureConfig();
  const text = (await readTextIfExists(paths().configPath)) || "";
  const syncMode = /sync_mode\s*=\s*"copy"/.test(text) ? "copy" : "symlink";
  const remoteMatch = text.match(/git_remote\s*=\s*"([^"]+)"/);
  return {
    syncMode,
    ...(remoteMatch?.[1] ? { gitRemote: remoteMatch[1] } : {}),
  };
}
