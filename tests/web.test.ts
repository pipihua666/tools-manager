import { afterEach, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { closeDb } from "../src/core/db";
import { initManager } from "../src/core/init";
import { addMcpServer, type McpServer } from "../src/core/mcp";
import { createWebHandler } from "../src/web/server";

let roots: string[] = [];

afterEach(async () => {
  closeDb();
  delete process.env.TOOLS_MANAGER_HOME;
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
  roots = [];
});

async function tempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

test("serves the web dashboard and protects mutations", async () => {
  const managerHome = await tempRoot("tm-web-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  await initManager();
  await addMcpServer({
    name: "private-server",
    transport: "stdio",
    command: "node",
    url: "",
    args: ["server.js"],
    env: { PRIVATE_TOKEN: "must-not-leak" },
    headers: {},
    targetTools: ["codex"],
    enabled: true,
  });
  const handler = createWebHandler("test-token");
  const mutationHeaders = {
    "content-type": "application/json",
    "x-tm-token": "test-token",
    origin: "http://127.0.0.1:4343",
  };

  const page = await handler(new Request("http://127.0.0.1:4343/"));
  const denied = await handler(new Request("http://127.0.0.1:4343/api/backup", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }));
  const crossSite = await handler(new Request("http://127.0.0.1:4343/api/snapshot", {
    headers: { "sec-fetch-site": "cross-site" },
  }));
  const snapshot = await handler(new Request("http://127.0.0.1:4343/api/snapshot"));
  const snapshotText = await snapshot.text();
  const mcpDetail = await handler(new Request("http://127.0.0.1:4343/api/mcp/private-server"));
  const mcpUpdated = await handler(new Request("http://127.0.0.1:4343/api/mcp/private-server", {
    method: "PUT",
    headers: mutationHeaders,
    body: JSON.stringify({
      name: "private-server",
      transport: "http",
      command: "bunx",
      url: "https://example.com/mcp",
      args: ["updated-server"],
      env: { PRIVATE_TOKEN: "updated-secret" },
      headers: { Authorization: "Bearer updated-secret" },
      targetTools: ["cursor"],
      enabled: false,
    }),
  }));
  const updatedMcpDetail = await handler(new Request("http://127.0.0.1:4343/api/mcp/private-server"));
  const updatedSnapshot = await handler(new Request("http://127.0.0.1:4343/api/snapshot"));
  const updatedSnapshotText = await updatedSnapshot.text();

  const html = await page.text();
  const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1];

  expect(page.status).toBe(200);
  expect(html).toContain("test-token");
  expect(html).toContain("const DEV = false;");
  expect(script).toBeTruthy();
  expect(() => new Function(script!)).not.toThrow();
  expect(denied.status).toBe(403);
  expect(crossSite.status).toBe(403);
  expect(snapshotText).toContain("PRIVATE_TOKEN");
  expect(snapshotText).not.toContain("must-not-leak");
  expect((await mcpDetail.json() as { server: { env: Record<string, string> } }).server.env.PRIVATE_TOKEN).toBe("must-not-leak");
  expect(mcpUpdated.status).toBe(200);
  expect(updatedSnapshotText).toContain("Authorization");
  expect(updatedSnapshotText).not.toContain("Bearer updated-secret");
  expect((await updatedMcpDetail.json() as { server: McpServer }).server).toEqual({
    name: "private-server",
    transport: "http",
    command: "",
    url: "https://example.com/mcp",
    args: [],
    env: {},
    headers: { Authorization: "Bearer updated-secret" },
    targetTools: ["cursor"],
    enabled: false,
  });
});

test("exposes browser reload events only in development mode", async () => {
  const managerHome = await tempRoot("tm-web-dev-home-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  await initManager();
  const handler = createWebHandler("test-token", "127.0.0.1", 4343, { dev: true, bootId: "boot-test" });

  const page = await handler(new Request("http://127.0.0.1:4343/"));
  const events = await handler(new Request("http://127.0.0.1:4343/api/dev-events"));
  const reader = events.body!.getReader();
  const chunk = await reader.read();
  await reader.cancel();

  expect(await page.text()).toContain("const DEV = true;");
  expect(events.headers.get("content-type")).toBe("text/event-stream");
  expect(new TextDecoder().decode(chunk.value)).toBe("data: boot-test\n\n");
});

test("imports, inspects, and removes a skill through the web API", async () => {
  const managerHome = await tempRoot("tm-web-home-");
  const skillSource = await tempRoot("tm-web-skill-");
  process.env.TOOLS_MANAGER_HOME = managerHome;
  await mkdir(skillSource, { recursive: true });
  await writeFile(join(skillSource, "SKILL.md"), "---\nname: Web Managed\ndescription: Added from the dashboard\n---\n\n# Web Managed\n");
  await initManager();
  const handler = createWebHandler("test-token");
  const headers = {
    "content-type": "application/json",
    "x-tm-token": "test-token",
    origin: "http://127.0.0.1:4343",
  };

  const imported = await handler(new Request("http://127.0.0.1:4343/api/skills/import", {
    method: "POST",
    headers,
    body: JSON.stringify({ source: skillSource }),
  }));
  const updated = await handler(new Request("http://127.0.0.1:4343/api/skills/web-managed", {
    method: "PUT",
    headers,
    body: JSON.stringify({ markdown: "---\nname: Web Managed\ndescription: Updated in web\n---\n\n# Updated Web Managed\n" }),
  }));
  const detail = await handler(new Request("http://127.0.0.1:4343/api/skills/web-managed"));
  const rejectedRename = await handler(new Request("http://127.0.0.1:4343/api/skills/web-managed", {
    method: "PUT",
    headers,
    body: JSON.stringify({ markdown: "---\nname: Different Skill\ndescription: Invalid rename\n---\n" }),
  }));
  const scopedRemoval = await handler(new Request("http://127.0.0.1:4343/api/skills/web-managed?tool=codex", {
    method: "DELETE",
    headers,
  }));
  const retained = await handler(new Request("http://127.0.0.1:4343/api/skills/web-managed"));
  const removed = await handler(new Request("http://127.0.0.1:4343/api/skills/web-managed", {
    method: "DELETE",
    headers,
  }));
  const missing = await handler(new Request("http://127.0.0.1:4343/api/skills/web-managed"));

  expect(imported.status).toBe(201);
  expect((await imported.json() as { skills: Array<{ name: string }> }).skills[0]?.name).toBe("web-managed");
  expect(updated.status).toBe(200);
  expect(detail.status).toBe(200);
  const detailBody = await detail.json() as { skill: { description: string }; markdown: string };
  expect(detailBody.skill.description).toBe("Updated in web");
  expect(detailBody.markdown).toContain("# Updated Web Managed");
  expect(rejectedRename.status).toBe(400);
  expect(scopedRemoval.status).toBe(400);
  expect(retained.status).toBe(200);
  expect(removed.status).toBe(200);
  expect(missing.status).toBe(404);
});
