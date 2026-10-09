import { lstat, readdir, stat } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { deleteSession, getSession, listSessions, loadSessionMessages, type SessionMeta, type SessionProvider } from "./session";

const DAY = 24 * 60 * 60 * 1000;
export const SESSION_PRUNE_RULES = "Inactive for over 90 days, or inactive for over 30 days with at most one user message. Recently modified files are kept.";

export type SessionPruneCandidate = {
  session: SessionMeta;
  reason: "inactive" | "short-conversation";
  bytes: number;
  size: number;
  mtimeMs: number;
  dataPaths: string[];
};
export type SessionPrunePreview = { candidates: SessionPruneCandidate[]; estimatedBytes: number; skippedCount: number };

async function reasonFor(session: SessionMeta, mtimeMs: number, now: number): Promise<SessionPruneCandidate["reason"] | null> {
  const lastActive = Math.max(session.lastActiveAt || session.createdAt || mtimeMs, mtimeMs);
  const age = now - lastActive;
  if (age > 90 * DAY) return "inactive";
  if (age <= 30 * DAY) return null;
  const transcript = await loadSessionMessages(session.providerId, session.sessionId, session.sourcePath);
  // A partial transcript cannot prove that a conversation was short.
  return !transcript.truncated && transcript.messages.filter((message) => message.role === "user").length <= 1
    ? "short-conversation" : null;
}

async function storageBytes(path: string): Promise<number> {
  const info = await lstat(path).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!info) return 0;
  // Never follow symlinks into files outside the session's own directory.
  if (!info.isDirectory()) return info.size;
  let bytes = 0;
  for (const entry of await readdir(path)) bytes += await storageBytes(join(path, entry));
  return bytes;
}

async function sessionBytes(session: SessionMeta): Promise<number> {
  let bytes = await storageBytes(session.sourcePath);
  if (session.providerId === "claude") {
    bytes += await storageBytes(join(dirname(session.sourcePath), basename(session.sourcePath, extname(session.sourcePath))));
  }
  return bytes;
}

export async function previewSessionPrune(provider?: SessionProvider, now = Date.now()): Promise<SessionPrunePreview> {
  const candidates: SessionPruneCandidate[] = [];
  let skippedCount = 0;
  for (const session of await listSessions(provider)) {
    try {
      // Resolve and validate before reading sidecar storage.
      const validated = await getSession(session.providerId, session.sessionId, session.sourcePath);
      const info = await stat(validated.sourcePath);
      const reason = await reasonFor(validated, info.mtimeMs, now);
      if (!reason) continue;
      const dataPaths = [validated.sourcePath];
      if (validated.providerId === "claude") {
        const sidecar = join(dirname(validated.sourcePath), basename(validated.sourcePath, extname(validated.sourcePath)));
        if (await lstat(sidecar).catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        })) dataPaths.push(sidecar);
      }
      candidates.push({ session: { ...validated, title: session.title }, reason, bytes: await sessionBytes(validated), size: info.size, mtimeMs: info.mtimeMs, dataPaths });
    } catch {
      skippedCount += 1;
    }
  }
  return { candidates, estimatedBytes: candidates.reduce((sum, candidate) => sum + candidate.bytes, 0), skippedCount };
}

export async function pruneSessions(preview: SessionPrunePreview, now = Date.now()) {
  let deletedCount = 0;
  let skippedCount = 0;
  let freedBytes = 0;
  const errors: string[] = [];
  for (const candidate of preview.candidates) {
    try {
      const session = await getSession(candidate.session.providerId, candidate.session.sessionId, candidate.session.sourcePath);
      const info = await stat(session.sourcePath);
      if (info.size !== candidate.size || info.mtimeMs !== candidate.mtimeMs || !await reasonFor(session, info.mtimeMs, now)) {
        skippedCount += 1;
        continue;
      }
      const before = await sessionBytes(session);
      try {
        await deleteSession(session.providerId, session.sessionId, session.sourcePath);
        deletedCount += 1;
      } finally {
        // Count only storage actually removed, including partially removed sidecars.
        freedBytes += Math.max(0, before - await sessionBytes(session));
      }
    } catch (error) {
      errors.push(`${candidate.session.sessionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { deletedCount, skippedCount, freedBytes, errors };
}
