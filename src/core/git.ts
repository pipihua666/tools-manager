import { createHash } from "node:crypto";
import { join } from "node:path";
import { paths } from "./paths";
import { ensureDir, removePath } from "./fs";
import { assertUsage } from "./errors";

export type GitSource = {
  url: string;
  ref?: string;
  subpath?: string;
};

export function isGitSource(source: string): boolean {
  return (
    /^https?:\/\/.+/.test(source) ||
    /^file:\/\/.+/.test(source) ||
    /^ssh:\/\/.+/.test(source) ||
    /^[^@\s]+@[^:\s]+:.+/.test(source) ||
    source.endsWith(".git")
  );
}

export function parseGitSource(source: string): GitSource {
  const hashIndex = source.indexOf("#");
  if (hashIndex === -1) return { url: source };
  const url = source.slice(0, hashIndex);
  const spec = source.slice(hashIndex + 1);
  assertUsage(url.length > 0, "Git URL is empty.");
  assertUsage(spec.length > 0, "Git ref after # is empty.");
  const colonIndex = spec.indexOf(":");
  if (colonIndex === -1) return { url, ref: spec };
  const ref = spec.slice(0, colonIndex);
  const subpath = spec.slice(colonIndex + 1);
  assertUsage(ref.length > 0, "Git ref before : is empty.");
  assertUsage(subpath.length > 0, "Git subpath after : is empty.");
  return { url, ref, subpath };
}

export async function cloneGitSource(source: GitSource): Promise<{ checkoutDir: string; commitSha: string | null }> {
  const p = paths();
  await ensureDir(p.cacheGitDir);
  const key = createHash("sha1").update(`${source.url}#${source.ref || ""}`).digest("hex");
  const checkoutDir = join(p.cacheGitDir, key);
  await removePath(checkoutDir);
  const args = ["clone", "--depth", "1"];
  if (source.ref) args.push("--branch", source.ref);
  args.push(source.url, checkoutDir);
  runGit(args, "Failed to clone Git source.");
  const commitSha = runGit(["-C", checkoutDir, "rev-parse", "HEAD"], "Failed to read Git commit.", true).trim() || null;
  return { checkoutDir, commitSha };
}

export function runGit(args: string[], message: string, capture = false): string {
  const proc = Bun.spawnSync(["git", ...args], {
    stdout: capture ? "pipe" : "inherit",
    stderr: "pipe",
  });
  if (!proc.success) {
    const stderr = new TextDecoder().decode(proc.stderr).trim();
    throw new Error(`${message}${stderr ? `\n${stderr}` : ""}${gitFailureHint(args, stderr)}`);
  }
  return capture ? new TextDecoder().decode(proc.stdout) : "";
}

export function gitFailureHint(args: string[], stderr: string): string {
  if (args[0] !== "clone") return "";
  if (!/authentication failed|HTTP Basic: Access denied|Permission denied \(publickey\)/i.test(stderr)) return "";
  return [
    "",
    "Git authentication failed. Tools Manager uses your local git command and does not store credentials.",
    "For private repositories, make sure git can clone this URL first:",
    "  git clone <repo-url>",
    "Use a personal access token for HTTPS repositories with 2FA, or use an SSH URL after configuring your SSH key.",
  ].join("\n");
}
