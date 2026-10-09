import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";

const exec = promisify(execFile);

export type PortProcess = {
  id: string;
  pid: number;
  uid: number;
  command: string;
  executable: string;
  startedAt: string;
  protocol: "TCP" | "UDP";
  address: string;
  port: number;
  canStop: boolean;
  protectedReason: "dashboard" | "other-user" | "system" | null;
};

type Socket = Pick<PortProcess, "pid" | "uid" | "command" | "protocol" | "address" | "port">;

export function parsePortSockets(output: string): Socket[] {
  const sockets: Socket[] = [];
  let pid = 0;
  let uid = -1;
  let command = "";
  let protocol = "";
  for (const line of output.split("\n")) {
    const field = line.slice(1);
    if (line[0] === "p") { pid = Number(field); uid = -1; command = ""; protocol = ""; }
    if (line[0] === "c") command = field;
    if (line[0] === "u") uid = Number(field);
    if (line[0] === "f") protocol = "";
    if (line[0] === "P") protocol = field;
    if (line[0] !== "n" || (protocol !== "TCP" && protocol !== "UDP")) continue;
    const endpoint = field.split("->")[0]!;
    const match = endpoint.match(/^(.*):(\d+)$/);
    const port = Number(match?.[2]);
    if (!match || !Number.isInteger(pid) || pid <= 0 || port < 1 || port > 65535) continue;
    sockets.push({ pid, uid, command, protocol, address: match[1]!, port });
  }
  return sockets;
}

async function socketOutput(args: string[]): Promise<string> {
  try {
    return (await exec("lsof", ["-nP", ...args, "-FpcuPnf"], { timeout: 10000, maxBuffer: 8 * 1024 * 1024 })).stdout;
  } catch (error) {
    const failure = error as { code?: number | string; stdout?: string; stderr?: string };
    if (failure.code === 1 && !failure.stderr?.trim()) return failure.stdout || "";
    if (failure.code === "ENOENT") throw new Error("Port management requires lsof. Install lsof and refresh the list.");
    throw new Error("Unable to read local ports. Check lsof permissions and try again.");
  }
}

export async function listPortProcesses(): Promise<PortProcess[]> {
  if (process.platform === "win32") throw new Error("Port management currently supports macOS and Linux.");
  const outputs = await Promise.all([
    socketOutput(["-iTCP", "-sTCP:LISTEN"]),
    socketOutput(["-iUDP"]),
  ]);
  const sockets = outputs.flatMap(parsePortSockets);
  const pids = [...new Set(sockets.map((socket) => socket.pid))];
  if (!pids.length) return [];
  let processOutput: string;
  try {
    processOutput = (await exec("ps", ["-p", pids.join(","), "-o", "pid=,uid=,lstart=,comm="], {
      env: { ...process.env, LC_ALL: "C" }, timeout: 10000, maxBuffer: 8 * 1024 * 1024,
    })).stdout;
  } catch (error) {
    if ((error as { code?: number }).code === 1) return [];
    throw new Error("Unable to identify the processes using these ports.");
  }
  const identities = new Map<number, { uid: number; startedAt: string; executable: string }>();
  for (const line of processOutput.split("\n")) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.{24})\s+(.+)$/);
    if (match) identities.set(Number(match[1]), { uid: Number(match[2]), startedAt: match[3]!, executable: match[4]! });
  }
  const entries = new Map<string, PortProcess>();
  for (const socket of sockets) {
    const identity = identities.get(socket.pid);
    if (!identity || identity.uid !== socket.uid) continue;
    const protectedReason = socket.pid === process.pid ? "dashboard" : socket.pid <= 1 ? "system" : identity.uid !== process.getuid?.() ? "other-user" : null;
    const id = createHash("sha256").update(JSON.stringify([socket.pid, identity, socket.protocol, socket.address, socket.port])).digest("hex");
    entries.set(id, { ...socket, ...identity, id, protectedReason, canStop: protectedReason === null });
  }
  return [...entries.values()].sort((a, b) => a.port - b.port || a.pid - b.pid || a.protocol.localeCompare(b.protocol) || a.address.localeCompare(b.address));
}

export async function previewPortStop(id: string) {
  const entries = await listPortProcesses();
  const target = entries.find((entry) => entry.id === id);
  if (!target) throw new Error("Port or process changed. Refresh the list and confirm again.");
  if (!target.canStop) throw new Error("This process is protected or belongs to another user.");
  return { target, affected: entries.filter((entry) => entry.pid === target.pid) };
}

export async function stopPortProcess(id: string) {
  // Recheck both the listener and process identity immediately before signaling.
  const { target, affected } = await previewPortStop(id);
  process.kill(target.pid, "SIGTERM");
  let remaining = await listPortProcesses();
  for (let attempt = 0; attempt < 8 && remaining.some((entry) => entry.id === id); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    remaining = await listPortProcesses();
  }
  return {
    pid: target.pid,
    stopped: !remaining.some((entry) => entry.id === id),
    portsReleased: affected.every((previous) => !remaining.some((entry) => entry.port === previous.port && entry.protocol === previous.protocol)),
  };
}
