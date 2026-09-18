import { resolve } from "node:path";

type Bump = "patch" | "minor" | "major";

const bump = process.argv[2] as Bump | undefined;
if (!bump || !(["patch", "minor", "major"] as const).includes(bump)) {
  throw new Error("Usage: bun run scripts/release.ts <patch|minor|major>");
}

const packagePath = resolve(import.meta.dir, "..", "package.json");
const original = await Bun.file(packagePath).text();
const packageJson = JSON.parse(original) as { name: string; version: string };
const nextVersion = bumpVersion(packageJson.version, bump);

if ((await capture(["git", "status", "--porcelain"])).trim()) {
  throw new Error("Release requires a clean working tree.");
}

if ((await capture(["npm", "view", `${packageJson.name}@${nextVersion}`, "version", "--json"], true)).trim()) {
  throw new Error(`${packageJson.name}@${nextVersion} is already published.`);
}

packageJson.version = nextVersion;
await Bun.write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

let published = false;
try {
  await run(["bun", "run", "check"]);
  await run(["npm", "publish", "--access", "public"]);
  published = true;

  let visible = false;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const result = await capture(["npm", "view", `${packageJson.name}@${nextVersion}`, "version", "--json"], true);
    if (result.includes(nextVersion)) {
      visible = true;
      break;
    }
    await Bun.sleep(5_000);
  }
  if (!visible) throw new Error(`Published ${nextVersion}, but npm registry verification timed out.`);

  await run(["git", "add", "package.json"]);
  await run(["git", "commit", "-m", `chore: release v${nextVersion}`]);
  await run(["git", "tag", "-a", `v${nextVersion}`, "-m", `v${nextVersion}`]);
  console.log(`Published and tagged ${packageJson.name}@${nextVersion}.`);
} catch (error) {
  if (!published) await Bun.write(packagePath, original);
  throw error;
}

function bumpVersion(version: string, kind: Bump): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`Unsupported version: ${version}`);
  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);
  if (kind === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (kind === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

async function run(command: string[]): Promise<void> {
  const process = Bun.spawn(command, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
  const exitCode = await process.exited;
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed with exit code ${exitCode}.`);
}

async function capture(command: string[], allowFailure = false): Promise<string> {
  const process = Bun.spawn(command, { stdout: "pipe", stderr: allowFailure ? "ignore" : "inherit" });
  const [exitCode, stdout] = await Promise.all([process.exited, new Response(process.stdout).text()]);
  if (exitCode !== 0 && !allowFailure) throw new Error(`${command.join(" ")} failed with exit code ${exitCode}.`);
  return exitCode === 0 ? stdout : "";
}
