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

export type AgentUsageSummary = {
  providerId: SessionProvider;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  sessionCount: number;
  cacheHitRate: number;
  estimatedCostUsd: number;
  dailyUsage: AgentUsageDay[];
  todayModels: AgentModelUsage[];
  recommendation: AgentModelRecommendation | null;
  recommendedModel: string | null;
  recommendedEffort: string | null;
};

export type AgentModelRecommendation = {
  model: string;
  effort: string | null;
  observed: boolean;
  source: "model-catalog" | "local-observation";
  confidence: "low" | "medium" | "high";
  candidateCount: number;
  rationale: string;
};

export type AgentUsageDay = {
  date: string;
  totalTokens: number;
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  cacheHitRate: number;
  estimatedCostUsd: number;
};

export type AgentModelUsage = {
  model: string;
  effort: string | null;
  totalTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  cacheHitRate: number;
  estimatedCostUsd: number;
  costPerMillionTokens: number;
  requestCount: number;
  completedCount: number;
  completionRate: number | null;
  tokensPerCompletedTask: number | null;
  averageResponseMs: number | null;
  latestResponseMs: number | null;
};

type AvailableModel = {
  model: string;
  description: string;
  defaultEffort: string | null;
  efforts: string[];
  priority: number;
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

export async function getAgentUsage(provider: SessionProvider): Promise<AgentUsageSummary> {
  const sessions = await listSessions(provider);
  const dayKeys = recentLocalDayKeys(7);
  const analyticsStart = localDayStart(dayKeys[0]!);
  const recentSessions = sessions.filter((session) => (session.lastActiveAt || session.createdAt || 0) >= analyticsStart);
  const [usage, analytics] = await Promise.all([
    mapConcurrent(sessions, 8, (session) => readSessionUsage(provider, session.sourcePath)),
    mapConcurrent(recentSessions, 4, (session) => readSessionAnalytics(provider, session.sourcePath, analyticsStart, dayKeys.at(-1)!)),
  ]);
  const totals = usage.reduce((sum, item) => ({
    inputTokens: sum.inputTokens + item.inputTokens,
    cachedInputTokens: sum.cachedInputTokens + item.cachedInputTokens,
    cacheWriteTokens: sum.cacheWriteTokens + item.cacheWriteTokens,
    outputTokens: sum.outputTokens + item.outputTokens,
    totalTokens: sum.totalTokens + item.totalTokens,
  }), emptyUsage());
  const dailyTotals = new Map(dayKeys.map((day) => [day, emptyUsage()]));
  const modelTotals = new Map<string, ModelAnalytics>();
  for (const item of analytics) {
    for (const [day, value] of item.daily) dailyTotals.set(day, addUsage(dailyTotals.get(day) || emptyUsage(), value));
    for (const [key, value] of item.models) modelTotals.set(key, addModelAnalytics(modelTotals.get(key) || emptyModelAnalytics(value.model, value.effort), value));
  }
  const dailyUsage = dayKeys.map((date) => usageDay(provider, date, dailyTotals.get(date) || emptyUsage()));
  const todayModels = [...modelTotals.values()]
    .map((value) => modelUsage(provider, value))
    .sort((a, b) => b.totalTokens - a.totalTokens || a.model.localeCompare(b.model) || String(a.effort).localeCompare(String(b.effort)));
  const recommendation = await recommendModel(provider, todayModels);
  const cacheBase = totals.inputTokens;
  return {
    providerId: provider,
    totalTokens: totals.totalTokens,
    inputTokens: totals.inputTokens,
    cachedInputTokens: totals.cachedInputTokens,
    outputTokens: totals.outputTokens,
    sessionCount: sessions.length,
    cacheHitRate: cacheBase > 0 ? totals.cachedInputTokens / cacheBase : 0,
    estimatedCostUsd: estimateCost(provider, totals),
    dailyUsage,
    todayModels,
    recommendation,
    recommendedModel: recommendation?.model || null,
    recommendedEffort: recommendation?.effort || null,
  };
}

async function recommendModel(provider: SessionProvider, todayModels: AgentModelUsage[]): Promise<AgentModelRecommendation | null> {
  const observed = todayModels.filter((item) => item.model !== "Unknown model" && item.completedCount > 0 && Number(item.tokensPerCompletedTask) > 0);
  const completedTurns = observed.reduce((sum, item) => sum + item.completedCount, 0);
  if (completedTurns === 0) return null;

  const catalog = await loadAvailableModels(provider);
  if (catalog.length > 0) {
    const complexity = taskComplexity(observed);
    const effort = preferredEffort(complexity);
    const ranked = catalog.map((candidate, index) => {
      const traits = modelTraits(candidate, index, catalog.length);
      const underpowered = Math.max(0, complexity - traits.capability);
      const overpowered = Math.max(0, traits.capability - complexity);
      const score = traits.efficiency * 0.55 + traits.capability * 0.45 - underpowered * 3 - overpowered * 0.3;
      return { candidate, score, effort: nearestEffort(candidate.efforts, effort, candidate.defaultEffort) };
    }).sort((a, b) => b.score - a.score || a.candidate.priority - b.candidate.priority);
    const best = ranked[0]!;
    const observedLocally = todayModels.some((item) => item.model === best.candidate.model && (item.effort || null) === best.effort);
    return {
      model: best.candidate.model,
      effort: best.effort,
      observed: observedLocally,
      source: "model-catalog",
      confidence: completedTurns >= 10 ? "high" : completedTurns >= 3 ? "medium" : "low",
      candidateCount: catalog.length,
      rationale: `Estimated across ${catalog.length} available models from today's ${completedTurns} completed turn${completedTurns === 1 ? "" : "s"}; favors capability-to-token efficiency for ${complexityLabel(complexity)} work.`,
    };
  }

  const bestObserved = [...observed].sort((a, b) => {
    const aScore = Number(a.completionRate) / Number(a.tokensPerCompletedTask);
    const bScore = Number(b.completionRate) / Number(b.tokensPerCompletedTask);
    return bScore - aScore || Number(b.completionRate) - Number(a.completionRate) || Number(a.tokensPerCompletedTask) - Number(b.tokensPerCompletedTask);
  })[0]!;
  return {
    model: bestObserved.model,
    effort: bestObserved.effort,
    observed: true,
    source: "local-observation",
    confidence: completedTurns >= 10 ? "high" : completedTurns >= 3 ? "medium" : "low",
    candidateCount: observed.length,
    rationale: "The Agent model catalog is unavailable, so this fallback compares only locally completed turns.",
  };
}

async function loadAvailableModels(provider: SessionProvider): Promise<AvailableModel[]> {
  if (provider !== "codex") return [];
  try {
    const codexRoot = process.env.CODEX_HOME || join(homedir(), ".codex");
    const value = JSON.parse(await readFile(join(codexRoot, "models_cache.json"), "utf8"));
    if (!isRecord(value) || !Array.isArray(value.models)) return [];
    return value.models.flatMap((entry: unknown) => {
      if (!isRecord(entry) || entry.visibility !== "list") return [];
      const model = stringValue(entry.slug);
      if (!model) return [];
      const levels = Array.isArray(entry.supported_reasoning_levels) ? entry.supported_reasoning_levels : [];
      const efforts = levels.map((level) => stringValue(record(level).effort)).filter((effort): effort is string => Boolean(effort));
      return [{
        model,
        description: stringValue(entry.description) || "",
        defaultEffort: stringValue(entry.default_reasoning_level),
        efforts,
        priority: Number.isFinite(Number(entry.priority)) ? Number(entry.priority) : Number.MAX_SAFE_INTEGER,
      }];
    });
  } catch {
    return [];
  }
}

function taskComplexity(models: AgentModelUsage[]): number {
  const completed = Math.max(1, models.reduce((sum, item) => sum + item.completedCount, 0));
  const effortScore = models.reduce((sum, item) => sum + effortValue(item.effort) * item.completedCount, 0) / completed;
  const tokensPerTurn = models.reduce((sum, item) => sum + Number(item.tokensPerCompletedTask || 0) * item.completedCount, 0) / completed;
  const tokenScore = Math.min(1, Math.log10(Math.max(100, tokensPerTurn)) / 5);
  const completionRate = models.reduce((sum, item) => sum + Number(item.completionRate || 0) * item.requestCount, 0)
    / Math.max(1, models.reduce((sum, item) => sum + item.requestCount, 0));
  return Math.max(0.2, Math.min(1, effortScore * 0.65 + tokenScore * 0.25 + (1 - completionRate) * 0.1));
}

function modelTraits(model: AvailableModel, index: number, count: number): { capability: number; efficiency: number } {
  const description = model.description.toLowerCase();
  const catalogRank = count <= 1 ? 1 : 1 - index / (count - 1);
  let capability = 0.68 + catalogRank * 0.2;
  let efficiency = 0.64;
  if (description.includes("most capable")) { capability = 0.98; efficiency = 0.54; }
  else if (description.includes("reliable") || description.includes("workhorse")) { capability = 0.88; efficiency = 0.72; }
  else if (description.includes("balanced")) { capability = 0.82; efficiency = 0.85; }
  else if (description.includes("fast") || description.includes("affordable")) { capability = 0.7; efficiency = 0.98; }
  else if (description.includes("previous-generation")) { capability = 0.74; efficiency = 0.5; }
  return { capability, efficiency };
}

function effortValue(effort: string | null): number {
  return ({ minimal: 0.12, low: 0.25, medium: 0.5, high: 0.72, xhigh: 0.86, max: 0.94, ultra: 1 } as Record<string, number>)[effort || ""] ?? 0.5;
}

function preferredEffort(complexity: number): string {
  if (complexity < 0.38) return "low";
  if (complexity < 0.58) return "medium";
  if (complexity < 0.76) return "high";
  if (complexity < 0.88) return "xhigh";
  if (complexity < 0.96) return "max";
  return "ultra";
}

function nearestEffort(efforts: string[], preferred: string, fallback: string | null): string | null {
  if (efforts.length === 0) return fallback;
  return [...efforts].sort((a, b) => Math.abs(effortValue(a) - effortValue(preferred)) - Math.abs(effortValue(b) - effortValue(preferred)))[0] || fallback;
}

function complexityLabel(value: number): string {
  if (value < 0.38) return "lightweight";
  if (value < 0.62) return "balanced";
  if (value < 0.82) return "complex";
  return "demanding";
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

type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  totalTokens: number;
};

type SessionAnalytics = {
  daily: Map<string, TokenUsage>;
  models: Map<string, ModelAnalytics>;
};

type ModelAnalytics = {
  model: string;
  effort: string | null;
  usage: TokenUsage;
  requestCount: number;
  completedCount: number;
  completedTokens: number;
  responseTotalMs: number;
  responseCount: number;
  latestResponseAt: number;
  latestResponseMs: number | null;
};

type PendingTurn = {
  model: string;
  effort: string | null;
  startedAt: number | null;
  firstResponseMs: number | null;
  firstResponseAt: number;
  usage: TokenUsage;
};

async function readSessionAnalytics(provider: SessionProvider, path: string, startAt: number, today: string): Promise<SessionAnalytics> {
  const daily = new Map<string, TokenUsage>();
  const models = new Map<string, ModelAnalytics>();
  const stream = createReadStream(path, { encoding: "utf8" });
  let pending = "";
  let activeModel = "Unknown model";
  let activeEffort: string | null = null;
  let previous = emptyUsage();
  let turn: PendingTurn | null = null;
  const finalizeTurn = (completed: boolean) => {
    if (!turn?.startedAt || localDayKey(turn.startedAt) !== today) {
      turn = null;
      return;
    }
    const key = modelAnalyticsKey(turn.model, turn.effort);
    const current = models.get(key) || emptyModelAnalytics(turn.model, turn.effort);
    current.requestCount += 1;
    if (completed) {
      current.completedCount += 1;
      current.completedTokens += turn.usage.totalTokens;
    }
    if (turn.firstResponseMs !== null) {
      current.responseTotalMs += turn.firstResponseMs;
      current.responseCount += 1;
      if (turn.firstResponseAt >= current.latestResponseAt) {
        current.latestResponseAt = turn.firstResponseAt;
        current.latestResponseMs = turn.firstResponseMs;
      }
    }
    models.set(key, current);
    turn = null;
  };
  const consume = (line: string) => {
    const value = parseJsonLine(line);
    if (!isRecord(value)) return;
    const eventAt = timestamp(value.timestamp);
    let completesTurn = false;
    if (provider === "codex" && value.type === "turn_context") {
      const payload = record(value.payload);
      activeModel = stringValue(payload.model) || activeModel;
      activeEffort = stringValue(payload.effort) || stringValue(payload.reasoning_effort);
      if (turn) {
        turn.model = activeModel;
        turn.effort = activeEffort;
      }
      return;
    }
    if (provider === "codex") {
      const payload = record(value.payload);
      if (value.type === "event_msg" && payload.type === "task_started") {
        finalizeTurn(false);
        turn = { model: activeModel, effort: activeEffort, startedAt: eventAt, firstResponseMs: null, firstResponseAt: 0, usage: emptyUsage() };
      }
      if (value.type === "response_item" && payload.type === "message" && payload.role === "user") {
        if (!turn) turn = { model: activeModel, effort: activeEffort, startedAt: eventAt, firstResponseMs: null, firstResponseAt: 0, usage: emptyUsage() };
        else if (eventAt) turn.startedAt = eventAt;
      }
      if (value.type === "response_item" && payload.type === "message" && payload.role === "assistant" && turn && turn.firstResponseMs === null && eventAt && turn.startedAt) {
        turn.firstResponseMs = Math.max(0, eventAt - turn.startedAt);
        turn.firstResponseAt = eventAt;
      }
      if (value.type === "event_msg" && payload.type === "task_complete") {
        finalizeTurn(true);
        return;
      }
    } else {
      const message = record(value.message);
      if (value.type === "user" && message.role === "user" && isClaudeUserPrompt(message.content)) {
        finalizeTurn(false);
        turn = { model: activeModel, effort: null, startedAt: eventAt, firstResponseMs: null, firstResponseAt: 0, usage: emptyUsage() };
      }
      if (value.type === "assistant" && message.role === "assistant") {
        const model = stringValue(message.model) || stringValue(value.model) || activeModel;
        activeModel = model;
        if (turn) {
          turn.model = model;
          if (turn.firstResponseMs === null && eventAt && turn.startedAt) {
            turn.firstResponseMs = Math.max(0, eventAt - turn.startedAt);
            turn.firstResponseAt = eventAt;
          }
          const stopReason = stringValue(message.stop_reason);
          completesTurn = stopReason === "end_turn" || stopReason === "stop_sequence";
        }
      }
    }
    const parsed = parseUsageValue(provider, value);
    if (!parsed) {
      if (completesTurn) finalizeTurn(true);
      return;
    }
    const usage = provider === "codex" ? usageDelta(previous, parsed) : parsed;
    if (provider === "codex") previous = parsed;
    if (!eventAt || eventAt < startAt || usage.totalTokens <= 0) {
      if (completesTurn) finalizeTurn(true);
      return;
    }
    const day = localDayKey(eventAt);
    daily.set(day, addUsage(daily.get(day) || emptyUsage(), usage));
    if (day !== today) {
      if (completesTurn) finalizeTurn(true);
      return;
    }
    const message = record(value.message);
    const model = provider === "codex" ? activeModel : stringValue(message.model) || stringValue(value.model) || "Unknown model";
    const effort = provider === "codex" ? activeEffort : null;
    const key = modelAnalyticsKey(model, effort);
    const current = models.get(key) || emptyModelAnalytics(model, effort);
    current.usage = addUsage(current.usage, usage);
    models.set(key, current);
    if (turn) turn.usage = addUsage(turn.usage, usage);
    if (completesTurn) finalizeTurn(true);
  };
  for await (const chunk of stream) {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || "";
    for (const line of lines) consume(line);
  }
  if (pending) consume(pending);
  finalizeTurn(false);
  return { daily, models };
}

async function readSessionUsage(provider: SessionProvider, path: string): Promise<TokenUsage> {
  if (provider === "codex") {
    const { tail } = await readHeadTail(path);
    return tail.reduce((usage, line) => mergeUsage(provider, usage, parseUsage(provider, line)), emptyUsage());
  }
  const stream = createReadStream(path, { encoding: "utf8" });
  let pending = "";
  let usage = emptyUsage();
  for await (const chunk of stream) {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() || "";
    for (const line of lines) usage = mergeUsage(provider, usage, parseUsage(provider, line));
  }
  if (pending) usage = mergeUsage(provider, usage, parseUsage(provider, pending));
  return usage;
}

function parseUsage(provider: SessionProvider, line: string): TokenUsage | null {
  const value = parseJsonLine(line);
  if (!isRecord(value)) return null;
  return parseUsageValue(provider, value);
}

function parseUsageValue(provider: SessionProvider, value: JsonObject): TokenUsage | null {
  if (provider === "codex") {
    if (value.type !== "event_msg") return null;
    const payload = record(value.payload);
    if (payload.type !== "token_count") return null;
    const total = record(record(payload.info).total_token_usage);
    if (Object.keys(total).length === 0) return null;
    const inputTokens = numberValue(total.input_tokens);
    const cachedInputTokens = Math.min(inputTokens, numberValue(total.cached_input_tokens));
    const outputTokens = numberValue(total.output_tokens);
    return { inputTokens, cachedInputTokens, cacheWriteTokens: 0, outputTokens, totalTokens: numberValue(total.total_tokens) || inputTokens + outputTokens };
  }
  if (value.type !== "assistant") return null;
  const messageUsage = record(record(value.message).usage);
  if (Object.keys(messageUsage).length === 0) return null;
  const uncachedInput = numberValue(messageUsage.input_tokens);
  const cachedInputTokens = numberValue(messageUsage.cache_read_input_tokens);
  const cacheWriteTokens = numberValue(messageUsage.cache_creation_input_tokens);
  const outputTokens = numberValue(messageUsage.output_tokens);
  const inputTokens = uncachedInput + cachedInputTokens + cacheWriteTokens;
  return { inputTokens, cachedInputTokens, cacheWriteTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

function mergeUsage(provider: SessionProvider, current: TokenUsage, next: TokenUsage | null): TokenUsage {
  if (!next) return current;
  if (provider === "codex") return next.totalTokens >= current.totalTokens ? next : current;
  return {
    inputTokens: current.inputTokens + next.inputTokens,
    cachedInputTokens: current.cachedInputTokens + next.cachedInputTokens,
    cacheWriteTokens: current.cacheWriteTokens + next.cacheWriteTokens,
    outputTokens: current.outputTokens + next.outputTokens,
    totalTokens: current.totalTokens + next.totalTokens,
  };
}

function emptyUsage(): TokenUsage {
  return { inputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0, totalTokens: 0 };
}

function addUsage(current: TokenUsage, next: TokenUsage): TokenUsage {
  return {
    inputTokens: current.inputTokens + next.inputTokens,
    cachedInputTokens: current.cachedInputTokens + next.cachedInputTokens,
    cacheWriteTokens: current.cacheWriteTokens + next.cacheWriteTokens,
    outputTokens: current.outputTokens + next.outputTokens,
    totalTokens: current.totalTokens + next.totalTokens,
  };
}

function modelAnalyticsKey(model: string, effort: string | null): string {
  return `${model}\u0000${effort || ""}`;
}

function emptyModelAnalytics(model: string, effort: string | null): ModelAnalytics {
  return {
    model,
    effort,
    usage: emptyUsage(),
    requestCount: 0,
    completedCount: 0,
    completedTokens: 0,
    responseTotalMs: 0,
    responseCount: 0,
    latestResponseAt: 0,
    latestResponseMs: null,
  };
}

function addModelAnalytics(current: ModelAnalytics, next: ModelAnalytics): ModelAnalytics {
  const latestIsNext = next.latestResponseAt >= current.latestResponseAt;
  return {
    model: next.model,
    effort: next.effort,
    usage: addUsage(current.usage, next.usage),
    requestCount: current.requestCount + next.requestCount,
    completedCount: current.completedCount + next.completedCount,
    completedTokens: current.completedTokens + next.completedTokens,
    responseTotalMs: current.responseTotalMs + next.responseTotalMs,
    responseCount: current.responseCount + next.responseCount,
    latestResponseAt: latestIsNext ? next.latestResponseAt : current.latestResponseAt,
    latestResponseMs: latestIsNext ? next.latestResponseMs : current.latestResponseMs,
  };
}

function usageDelta(previous: TokenUsage, next: TokenUsage): TokenUsage {
  if (next.totalTokens < previous.totalTokens || next.inputTokens < previous.inputTokens || next.outputTokens < previous.outputTokens) return next;
  return {
    inputTokens: next.inputTokens - previous.inputTokens,
    cachedInputTokens: Math.max(0, next.cachedInputTokens - previous.cachedInputTokens),
    cacheWriteTokens: Math.max(0, next.cacheWriteTokens - previous.cacheWriteTokens),
    outputTokens: next.outputTokens - previous.outputTokens,
    totalTokens: next.totalTokens - previous.totalTokens,
  };
}

function usageDay(provider: SessionProvider, date: string, usage: TokenUsage): AgentUsageDay {
  return {
    date,
    totalTokens: usage.totalTokens,
    inputTokens: usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    outputTokens: usage.outputTokens,
    cacheHitRate: usage.inputTokens > 0 ? usage.cachedInputTokens / usage.inputTokens : 0,
    estimatedCostUsd: estimateCost(provider, usage),
  };
}

function modelUsage(provider: SessionProvider, analytics: ModelAnalytics): AgentModelUsage {
  const usage = analytics.usage;
  const estimatedCostUsd = estimateCost(provider, usage);
  return {
    model: analytics.model,
    effort: analytics.effort,
    totalTokens: usage.totalTokens,
    cachedInputTokens: usage.cachedInputTokens,
    outputTokens: usage.outputTokens,
    cacheHitRate: usage.inputTokens > 0 ? usage.cachedInputTokens / usage.inputTokens : 0,
    estimatedCostUsd,
    costPerMillionTokens: usage.totalTokens > 0 ? Math.round(estimatedCostUsd / usage.totalTokens * 1_000_000 * 100) / 100 : 0,
    requestCount: analytics.requestCount,
    completedCount: analytics.completedCount,
    completionRate: analytics.requestCount > 0 ? analytics.completedCount / analytics.requestCount : null,
    tokensPerCompletedTask: analytics.completedCount > 0 ? Math.round(analytics.completedTokens / analytics.completedCount) : null,
    averageResponseMs: analytics.responseCount > 0 ? Math.round(analytics.responseTotalMs / analytics.responseCount) : null,
    latestResponseMs: analytics.latestResponseMs,
  };
}

function isClaudeUserPrompt(content: unknown): boolean {
  if (typeof content === "string") return Boolean(content.trim());
  if (!Array.isArray(content)) return false;
  return content.some((item) => isRecord(item) && item.type === "text" && Boolean(stringValue(item.text)));
}

function localDayKey(value: number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function recentLocalDayKeys(count: number): string[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (count - index - 1));
    return localDayKey(date);
  });
}

function localDayStart(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, month! - 1, day!).getTime();
}

function estimateCost(provider: SessionProvider, usage: TokenUsage): number {
  const uncachedInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteTokens);
  const cost = provider === "codex"
    ? uncachedInput * 1.25e-6 + usage.cachedInputTokens * 0.125e-6 + usage.outputTokens * 10e-6
    : uncachedInput * 3e-6 + usage.cachedInputTokens * 0.3e-6 + usage.cacheWriteTokens * 3.75e-6 + usage.outputTokens * 15e-6;
  return Math.round(cost * 10000) / 10000;
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
function numberValue(value: unknown): number { return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0; }
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
