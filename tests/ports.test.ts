import { afterEach, expect, test } from "bun:test";
import { listPortProcesses, parsePortSockets, previewPortStop } from "../src/core/ports";
import { createWebHandler } from "../src/web/server";

let child: ReturnType<typeof Bun.spawn> | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
afterEach(async () => {
  server?.stop(true);
  server = undefined;
  if (child) {
    try { child.kill(); } catch {}
    await child.exited;
    child = undefined;
  }
});

test("parses numeric TCP, IPv6 and connected UDP endpoints without mistaking remote ports for local ports", () => {
  const sockets = parsePortSockets("p123\ncDemo App\nu501\nf5\nPTCP\nn[::1]:4343\nf6\nPUDP\nn127.0.0.1:6000->127.0.0.1:7000\nf7\nPTCP\nn*:99999\n");
  expect(sockets).toEqual([
    { pid: 123, uid: 501, command: "Demo App", protocol: "TCP", address: "[::1]", port: 4343 },
    { pid: 123, uid: 501, command: "Demo App", protocol: "UDP", address: "127.0.0.1", port: 6000 },
  ]);
});

const integrationTest = process.platform !== "win32" && Bun.which("lsof") ? test : test.skip;

integrationTest("protects the dashboard's own listener", async () => {
  server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response("test") });
  const entry = (await listPortProcesses()).find((entry) => entry.port === server!.port && entry.pid === process.pid)!;
  expect(entry.protectedReason).toBe("dashboard");
  expect(entry.canStop).toBe(false);
  await expect(previewPortStop(entry.id)).rejects.toThrow("protected");
});

integrationTest("requires a confirmed preview, stops only a disposable child and rejects replay or stale identities", async () => {
  child = Bun.spawn([process.execPath, "-e", "const s = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response('test')}); console.log(s.port);"], { stdout: "pipe", stderr: "pipe" });
  const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
  const chunk = await reader.read();
  reader.releaseLock();
  const port = Number(new TextDecoder().decode(chunk.value).trim());
  expect(port).toBeGreaterThan(0);
  const handler = createWebHandler("port-test-token");
  const response = await handler(new Request("http://127.0.0.1:4343/api/ports"));
  const entries = (await response.json()).ports;
  const entry = entries.find((entry: { port: number; pid: number }) => entry.port === port && entry.pid === child!.pid);
  expect(entry.canStop).toBe(true);
  const post = (path: string, body: unknown, token = "port-test-token") => new Request("http://127.0.0.1:4343" + path, {
    method: "POST", headers: { "content-type": "application/json", "x-tm-token": token }, body: JSON.stringify(body),
  });
  expect((await handler(post("/api/ports/stop", { planId: "missing" }))).status).toBe(400);
  expect((await handler(post("/api/ports/stop-preview", { id: entry.id }, "wrong"))).status).toBe(403);
  const preview = await (await handler(post("/api/ports/stop-preview", { id: entry.id }))).json();
  expect(preview.affected.some((entry: { port: number }) => entry.port === port)).toBe(true);
  expect(child.exitCode).toBeNull();
  const stopped = await handler(post("/api/ports/stop", { planId: preview.planId }));
  expect(stopped.status).toBe(200);
  expect((await stopped.json()).stopped).toBe(true);
  await child.exited;
  expect((await handler(post("/api/ports/stop", { planId: preview.planId }))).status).toBe(400);
  expect((await handler(post("/api/ports/stop-preview", { id: entry.id }))).status).toBe(400);
}, 20000);
