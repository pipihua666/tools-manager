import { createReadStream } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { open, readdir, readFile, realpath, rm, stat } from "node:fs/promises";

export type SessionProvider = "codex" | "claude";

export type SessionMeta = {
  providerId: SessionProvider;
  sessionId: string;
  title: string;
  summary: string;
  projectDir: string | null;
  createdAt: number | null;
  lastActiveAt: number | null;
  sourcePath: string;
  resumeCommand: string;
  archived: boolean;
};

export type SessionMessage = {
  role: string;
  content: string;
  ts: number | null;
};

export type SessionTranscript = {
  messages: SessionMessage[];
  total: number;
  truncated: boolean;
};

const SCAN_HEAD_BYTES = 256 * 1024;
const SCAN_TAIL_BYTES = 256 * 1024;
const DETAIL_TAIL_BYTES = 12 * 1024 * 1024;
const MAX_MESSAGES = 400;
const MAX_MESSAGE_CHARS = 80_000;
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

export function sessionRoots(provider?: SessionProvider): Array<{ provider: SessionProvider; path: string; archived: boolean }> {
  const codexRoot = process.env.CODEX_HOME || join(homedir(), ".codex");
  const claudeRoot = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
  const roots = [
    { provider: "codex" as const, path: join(codexRoot, "sessions"), archived: false },
    { provider: "codex" as const, path: join(codexRoot, "archived_sessions"), archived: true },
    { provider: "claude" as const, path: join(claudeRoot, "projects"), archived: false },
  ];
  return provider ? roots.filter((root) => root.provider === provider) : roots;
}

export async function listSessions(provider?: SessionProvider): Promise<SessionMeta[]> {
  const files: Array<{ provider: SessionProvider; path: string; archived: boolean }> = [];
  for (const root of sessionRoots(provider)) {
    for (const path of await collectJsonlFiles(root.path)) files.push({ provider: root.provider, path, archived: root.archived });
  }
  const [sessions, codexTitles] = await Promise.all([
    mapConcurrent(files, 16, async (file) => parseSessionFile(file.provider, file.path, file.archived)),
    provider === "claude" ? Promise.resolve(new Map<string, string>()) : loadCodexTitles(),
  ]);
  return sessions
    .filter((session): session is SessionMeta => Boolean(session))
    .map((session) => session.providerId === "codex" && codexTitles.has(session.sessionId)
      ? { ...session, title: truncate(codexTitles.get(session.sessionId)!, 100) }
      : session)
    .sort((a, b) => (b.lastActiveAt || b.createdAt || 0) - (a.lastActiveAt || a.createdAt || 0));
}

export async function getSession(provider: SessionProvider, sessionId: string, sourcePath: string): Promise<SessionMeta> {
  assertSessionId(sessionId);
  const path = await validateSessionPath(provider, sourcePath);
  const root = sessionRoots(provider).find((candidate) => isWithin(path, resolve(candidate.path)));
  const session = await parseSessionFile(provider, path, Boolean(root?.archived));
  if (!session || session.sessionId !== sessionId) throw new Error("Session metadata does not match the requested session.");
  return session;
}

export async function loadSessionMessages(provider: SessionProvider, sessionId: string, sourcePath: string): Promise<SessionTranscript> {
  const session = await getSession(provider, sessionId, sourcePath);
  const fileStat = await stat(session.sourcePath);
  const start = fileStat.size > DETAIL_TAIL_BYTES ? fileStat.size - DETAIL_TAIL_BYTES : 0;
  const messages: SessionMessage[] = [];
  let total = 0;
  let pending = "";
  let firstChunk = true;
  const stream = createReadStream(session.sourcePath, { encoding: "utf8", start });
  for await (const chunk of stream) {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || "";
    if (firstChunk && start > 0) lines.shift();
    firstChunk = false;
    for (const line of lines) {
      const message = parseMessage(provider, line);
      if (!message) continue;
      total += 1;
      messages.push(message);
      if (messages.length > MAX_MESSAGES) messages.shift();
    }
  }
  if (pending && start === 0) {
    const message = parseMessage(provider, pending);
    if (message) {
      total += 1;
      messages.push(message);
      if (messages.length > MAX_MESSAGES) messages.shift();
    }
  }
  return { messages, total, truncated: start > 0 || total > messages.length };
}

export async function deleteSession(provider: SessionProvider, sessionId: string, sourcePath: string): Promise<SessionMeta> {
  const session = await getSession(provider, sessionId, sourcePath);
  if (provider === "claude") {
    const sidecar = join(dirname(session.sourcePath), basename(session.sourcePath, extname(session.sourcePath)));
    if (isWithin(resolve(sidecar), resolve(dirname(session.sourcePath)))) await rm(sidecar, { recursive: true, force: true });
  }
  await rm(session.sourcePath);
  return session;
}

export async function launchSession(provider: SessionProvider, sessionId: string, sourcePath: string): Promise<{ command: string; launched: boolean }> {
  const session = await getSession(provider, sessionId, sourcePath);
  if (process.platform !== "darwin") return { command: session.resumeCommand, launched: false };
  const fullCommand = session.projectDir
    ? `cd ${shellQuote(session.projectDir)} && ${session.resumeCommand}`
    : session.resumeCommand;
  const escaped = fullCommand.replaceAll("\\", "\\\\").replaceAll('"', '\\"');
  const script = `tell application "Terminal"\nactivate\ndo script "${escaped}"\nend tell`;
  const processResult = Bun.spawn(["osascript", "-e", script], { stdout: "ignore", stderr: "pipe" });
  const exitCode = await processResult.exited;
  if (exitCode !== 0) throw new Error("Unable to open Terminal.app. Copy the resume command and run it manually.");
  return { command: session.resumeCommand, launched: true };
}

export function parseSessionProvider(value: unknown): SessionProvider {
  if (value !== "codex" && value !== "claude") throw new Error("Provider must be codex or claude.");
  return value;
}

async function parseSessionFile(provider: SessionProvider, path: string, archived: boolean): Promise<SessionMeta | null> {
  if (provider === "claude" && basename(path).startsWith("agent-")) return null;
  const { head, tail } = await readHeadTail(path);
  const headValues = head.map(parseJsonLine).filter(isRecord);
  const tailValues = tail.map(parseJsonLine).filter(isRecord);
  return provider === "codex"
    ? parseCodexMeta(path, archived, headValues, tailValues)
    : parseClaudeMeta(path, headValues, tailValues);
}

function parseCodexMeta(path: string, archived: boolean, head: JsonObject[], tail: JsonObject[]): SessionMeta | null {
  const meta = head.find((value) => value.type === "session_meta");
  const payload = record(meta?.payload);
  if (record(payload.source)?.subagent) return null;
  const sessionId = stringValue(payload.id) || inferSessionId(path);
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) return null;
  const firstUser = head.map((value) => codexMessage(value)).find((message) => message?.role === "user" && isUsefulTitle(message.content));
  const lastMessage = [...tail].reverse().map((value) => codexMessage(value)).find(Boolean);
  const projectDir = stringValue(payload.cwd);
  const createdAt = timestamp(payload.timestamp) || firstTimestamp(head);
  const lastActiveAt = lastTimestamp(tail) || createdAt;
  return {
    providerId: "codex",
    sessionId,
    title: truncate(firstUser?.content || basename(projectDir || "") || sessionId, 100),
    summary: truncate(lastMessage?.content || "", 180),
    projectDir,
    createdAt,
    lastActiveAt,
    sourcePath: path,
    resumeCommand: `codex resume ${sessionId}`,
    archived,
  };
}

function parseClaudeMeta(path: string, head: JsonObject[], tail: JsonObject[]): SessionMeta | null {
  const sessionId = head.map((value) => stringValue(value.sessionId)).find(Boolean) || inferSessionId(path);
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) return null;
  const projectDir = head.map((value) => stringValue(value.cwd)).find(Boolean) || null;
  const firstUser = head.map((value) => claudeMessage(value)).find((message) => message?.role === "user" && isUsefulTitle(message.content));
  const customTitle = [...tail].reverse().find((value) => value.type === "custom-title");
  const lastMessage = [...tail].reverse().map((value) => claudeMessage(value)).find(Boolean);
  const createdAt = firstTimestamp(head);
  const lastActiveAt = lastTimestamp(tail) || createdAt;
  return {
    providerId: "claude",
    sessionId,
    title: truncate(stringValue(customTitle?.customTitle) || firstUser?.content || basename(projectDir || "") || sessionId, 100),
    summary: truncate(lastMessage?.content || "", 180),
    projectDir,
    createdAt,
    lastActiveAt,
    sourcePath: path,
    resumeCommand: `claude --resume ${sessionId}`,
    archived: false,
  };
}

function parseMessage(provider: SessionProvider, line: string): SessionMessage | null {
  const value = parseJsonLine(line);
  if (!isRecord(value)) return null;
  return provider === "codex" ? codexMessage(value) : claudeMessage(value);
}

function codexMessage(value: JsonObject): SessionMessage | null {
  if (value.type !== "response_item") return null;
  const payload = record(value.payload);
  const type = stringValue(payload.type);
  if (type === "function_call") return message("assistant", `[Tool: ${stringValue(payload.name) || "unknown"}]`, value.timestamp);
  if (type === "function_call_output") return message("tool", stringValue(payload.output), value.timestamp);
  if (type !== "message") return null;
  return message(stringValue(payload.role) || "unknown", extractText(payload.content), value.timestamp);
}

function claudeMessage(value: JsonObject): SessionMessage | null {
  if (value.isMeta === true) return null;
  const payload = record(value.message);
  let role = stringValue(payload.role) || "unknown";
  if (role === "user" && Array.isArray(payload.content) && payload.content.length > 0 && payload.content.every((item) => record(item).type === "tool_result")) role = "tool";
  return message(role, extractText(payload.content), value.timestamp);
}

function message(role: string, content: string | null, ts: unknown): SessionMessage | null {
  const text = (content || "").trim();
  if (!text) return null;
  return { role, content: truncate(text, MAX_MESSAGE_CHARS), ts: timestamp(ts) };
}

function extractText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return null;
  const parts: string[] = [];
  for (const item of value) {
    const entry = record(item);
    const text = stringValue(entry.text) || stringValue(entry.input_text) || stringValue(entry.output_text);
    if (text) parts.push(text);
    const name = stringValue(entry.name);
    if (entry.type === "tool_use" && name) parts.push(`[Tool: ${name}]`);
    if (entry.type === "tool_result") {
      const nested = extractText(entry.content);
      if (nested) parts.push(nested);
    }
  }
  return parts.join("\n");
}

async function validateSessionPath(provider: SessionProvider, sourcePath: string): Promise<string> {
  if (!sourcePath || sourcePath.includes("\0")) throw new Error("Invalid session source path.");
  const path = await realpath(sourcePath).catch(() => null);
  if (!path || extname(path) !== ".jsonl") throw new Error("Session source file was not found.");
  for (const root of sessionRoots(provider)) {
    const resolvedRoot = await realpath(root.path).catch(() => null);
    if (resolvedRoot && isWithin(path, resolvedRoot)) return path;
  }
  throw new Error("Session source is outside the configured session directories.");
}

async function readHeadTail(path: string): Promise<{ head: string[]; tail: string[] }> {
  const file = await open(path, "r");
  try {
    const fileStat = await file.stat();
    const headSize = Math.min(fileStat.size, SCAN_HEAD_BYTES);
    const tailStart = Math.max(0, fileStat.size - SCAN_TAIL_BYTES);
    const tailSize = fileStat.size - tailStart;
    const headBuffer = Buffer.alloc(headSize);
    const tailBuffer = Buffer.alloc(tailSize);
    await Promise.all([
      file.read(headBuffer, 0, headSize, 0),
      file.read(tailBuffer, 0, tailSize, tailStart),
    ]);
    const head = headBuffer.toString("utf8").split(/\r?\n/);
    const tail = tailBuffer.toString("utf8").split(/\r?\n/);
    if (headSize < fileStat.size) head.pop();
    if (tailStart > 0) tail.shift();
    return { head, tail };
  } finally {
    await file.close();
  }
}

async function collectJsonlFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const pending = [root];
  while (pending.length) {
    const dir = pending.pop()!;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && entry.name.endsWith(".jsonl")) files.push(path);
    }
  }
  return files;
}

async function loadCodexTitles(): Promise<Map<string, string>> {
  const codexRoot = process.env.CODEX_HOME || join(homedir(), ".codex");
  const text = await readFile(join(codexRoot, "session_index.jsonl"), "utf8").catch(() => "");
  const titles = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const value = parseJsonLine(line);
    if (!isRecord(value)) continue;
    const id = stringValue(value.id);
    const title = stringValue(value.thread_name);
    if (id && title) titles.set(id, title);
  }
  return titles;
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index]!);
    }
  }));
  return results;
}

type JsonObject = Record<string, unknown>;
function parseJsonLine(line: string): unknown {
  try { return JSON.parse(line); } catch { return null; }
}
function isRecord(value: unknown): value is JsonObject { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
function record(value: unknown): JsonObject { return isRecord(value) ? value : {}; }
function stringValue(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function timestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function firstTimestamp(values: JsonObject[]): number | null { return values.map((value) => timestamp(value.timestamp)).find((value) => value !== null) || null; }
function lastTimestamp(values: JsonObject[]): number | null { return [...values].reverse().map((value) => timestamp(value.timestamp)).find((value) => value !== null) || null; }
function truncate(value: string, max: number): string { return value.length <= max ? value : `${value.slice(0, max - 1)}...`; }
function isUsefulTitle(value: string): boolean {
  const text = value.trim();
  return Boolean(text && !text.startsWith("<") && !text.startsWith("# AGENTS.md instructions") && !text.includes("<local-command-caveat>"));
}
function inferSessionId(path: string): string | null { return basename(path).match(/[0-9a-fA-F]{8}-[0-9a-fA-F-]{27,}/)?.[0] || basename(path, ".jsonl"); }
function isWithin(path: string, root: string): boolean { return path === root || path.startsWith(`${root}/`); }
function assertSessionId(value: string): void { if (!SESSION_ID_PATTERN.test(value)) throw new Error("Invalid session id."); }
function shellQuote(value: string): string { return `'${value.replaceAll("'", `'\\''`)}'`; }
