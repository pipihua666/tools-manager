import { pathExists } from "./fs";
import { paths } from "./paths";
import { readConfig } from "./config";
import { runGit } from "./git";

export async function backup(): Promise<{ initialized: boolean; committed: boolean; pushed: boolean; message: string }> {
  const skillsDir = paths().skillsDir;
  if (!(await pathExists(`${skillsDir}/.git`))) {
    runGit(["-C", skillsDir, "init"], "Failed to initialize Git repository.");
  }
  const config = await readConfig();
  if (config.gitRemote) {
    const remotes = runGit(["-C", skillsDir, "remote"], "Failed to inspect Git remotes.", true);
    if (!remotes.split(/\r?\n/).includes("origin")) {
      runGit(["-C", skillsDir, "remote", "add", "origin", config.gitRemote], "Failed to add Git remote.");
    }
  }
  runGit(["-C", skillsDir, "add", "-A"], "Failed to stage skills.");
  const status = runGit(["-C", skillsDir, "status", "--porcelain"], "Failed to inspect Git status.", true);
  if (!status.trim()) {
    return { initialized: true, committed: false, pushed: false, message: "No changes to backup." };
  }
  const message = `chore: backup skills ${new Date().toISOString()}`;
  runGit(["-C", skillsDir, "commit", "-m", message], "Failed to commit skills.");
  let pushed = false;
  if (config.gitRemote) {
    runGit(["-C", skillsDir, "push", "-u", "origin", "HEAD"], "Failed to push skills.");
    pushed = true;
  }
  return { initialized: true, committed: true, pushed, message };
}
