import { mkdir, readdir, readFile, rm, stat, symlink, copyFile, lstat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export async function writeText(path: string, contents: string): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, contents, "utf8");
}

export async function backupFile(path: string): Promise<string | null> {
  if (!(await pathExists(path))) return null;
  const backup = `${path}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await copyFile(path, backup);
  return backup;
}

export async function copyDir(src: string, dst: string): Promise<void> {
  await rm(dst, { recursive: true, force: true });
  await ensureDir(dst);
  for (const entry of await readdir(src, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const source = join(src, entry.name);
    const target = join(dst, entry.name);
    if (entry.isDirectory()) {
      await copyDir(source, target);
    } else if (entry.isSymbolicLink()) {
      const real = await Bun.file(source).arrayBuffer();
      await Bun.write(target, real);
    } else {
      await copyFile(source, target);
    }
  }
}

export async function removePath(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true });
}

export async function syncDir(src: string, dst: string, mode: "symlink" | "copy"): Promise<"symlink" | "copy"> {
  await ensureDir(dirname(dst));
  await rm(dst, { recursive: true, force: true });
  if (mode === "symlink") {
    try {
      await symlink(src, dst, "dir");
      return "symlink";
    } catch {
      await copyDir(src, dst);
      return "copy";
    }
  }
  await copyDir(src, dst);
  return "copy";
}

export async function replaceWithSymlink(src: string, dst: string): Promise<void> {
  await rm(dst, { recursive: true, force: true });
  await ensureDir(dirname(dst));
  await symlink(src, dst, "dir");
}

export async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await lstat(path)).isDirectory();
  } catch {
    return false;
  }
}
