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
  expect(html).not.toContain("Managed inventory");
  expect(html).not.toContain('data-view="agents"');
  expect(html).not.toContain("Open agents");
  expect(html).toContain("<th>Skill paths</th><th>MCP config</th>");
  expect(html).toContain('class="agent-table"');
  expect(html).not.toContain('class="busy-status" role="status"');
  expect(html).toContain('.btn.loading::before');
  expect(html).toContain('grid-template-rows: auto minmax(0, 1fr) auto;');
  expect(html).toContain('max-width: none;');
  expect(html).toContain('max-height: calc(100dvh - 16px);');
  expect(html).toContain('max-height: calc(100dvh - 20px);');
  expect(html).toContain('[data-mcp-transport], [data-mcp-add-mode], [data-skill-add-mode] { display: grid; gap: 18px; }');
  expect(html).toContain('.dialog-body { min-height: 0;');
  expect(html).not.toContain('#form-dialog:has(.select-shell) { overflow: visible; }');
  expect(html).toContain('position: fixed; z-index: 80;');
  expect(html).toContain('function positionSelectMenu(trigger, menu)');
  expect(html).toContain('"Import": "Importing..."');
  expect(html).toContain('"Save": "Saving..."');
  expect(html).toContain('button.setAttribute("aria-busy", "true")');
  expect(html).toContain('data-resource-search=');
  expect(html).not.toContain('data-view="presets"');
  expect(html).not.toContain("Preset");
  expect(html).not.toContain("/api/presets");
  expect(html).toContain('synced / installed');
  expect(html).not.toContain('managed / installed');
  expect(html).toContain('read only');
  expect(html).not.toContain("edit-agent-skill");
  expect(html).toContain('managed && item.scope !== "system"');
  expect(html).toContain('(filter !== "all" ? \'<th>Scope</th>\' : \'\')');
  expect(html).toContain('state.skillFilter !== "all" || skill.scope !== "system"');
  expect(html).toContain('function scopeSummary(kind, resources)');
  expect(html).toContain('const label = kind === "skill" ? "Skill" : "MCP server";');
  expect(html).toContain('searchControl("skill") + scopeSummary("skill", resources)');
  expect(html).toContain("filter === \"all\" ? '<th>Agents</th>'");
  expect(html).toContain('data-action="toggle-skill-agent"');
  expect(html).toContain('aria-pressed="\' + synced + \'"');
  expect(html).toContain('function toolIcon(tool)');
  expect(html).toContain('<svg viewBox="0 0 320 320" aria-hidden="true">');
  expect(html).toContain('<svg viewBox="0 0 248 248" aria-hidden="true">');
  expect(html).toContain('<svg viewBox="0 0 512 512" aria-hidden="true">');
  expect(html).not.toContain('function toolGlyph(tool)');
  expect(html).toContain('data-action="delete-skill"');
  expect(html).toContain('class="delete-icon"');
  expect(html).toContain('class="managed-delete"');
  expect(html).toContain('data-tool="all" aria-label="Delete managed skill ');
  expect(html).not.toContain('data-action="sync-one-skill"');
  expect(html).not.toContain('data-action="sync-selected-skills"');
  expect(html).not.toContain('data-sync-selected="skill"');
  expect(html).not.toContain('data-resource-select="skill"');
  expect(html).not.toContain('data-resource-select-all="skill"');
  expect(html).not.toContain('data-tool="\' + esc(filter) + \'">Remove</button>');
  expect(html).toContain("(state.mcpFilter !== \"all\" ? '<th>Scope</th>' : '') + '<th>Transport</th><th>Endpoint</th><th>Status</th><th>'");
  expect(html).not.toContain('<th>Targets</th>');
  expect(html).toContain("state.mcpFilter === \"all\" ? 'Agents'");
  expect(html).not.toContain("<th>Management</th>");
  expect(html).toContain('data-action="toggle-mcp-agent"');
  expect(html).toContain('data-action="delete-mcp-agent"');
  expect(html).toContain('aria-label="Delete managed MCP server ');
  expect(html).not.toContain('data-action="sync-one-mcp"');
  expect(html).not.toContain('data-action="sync-selected-mcp"');
  expect(html).not.toContain('data-sync-selected="mcp"');
  expect(html).not.toContain('data-resource-select="mcp"');
  expect(html).not.toContain('data-resource-select-all="mcp"');
  expect(html).not.toContain('data-action="import-agent-skills"');
  expect(html).toContain('class="mode-switch" role="group" aria-label="Skill source"');
  expect(html).toContain('name="skillAddMode" value="remote"');
  expect(html).toContain('data-skill-add-mode-option="local" aria-pressed="false"');
  expect(html).toContain('data-skill-add-mode-option="remote" aria-pressed="true"');
  expect(html).toContain('form.get("skillAddMode") === "local"');
  expect(html).toContain('api("/api/skills/import-agent"');
  expect(html).toContain('field("Git source", "source"');
  expect(html).toContain('toolIconChecks("skillAgents", ["all"])');
  expect(html).toContain('input[name="skillAgents"]:checked');
  expect(html).toContain('input[data-tool-multi]');
  expect(html).toContain('metric("Managed skills", data.skills.length, data.status.skillsDir)');
  expect(html).toContain('class="manager-path" aria-label="Manager home: ');
  expect(html).toContain('.manager-path::before');
  expect(html).toContain("esc(state.data.status.root)");
  expect(html).toContain('function renderSkills()');
  expect(html).toContain('view.innerHTML = \'<section>\' + sectionHead("Skill registry"');
  expect(html).not.toContain('"Store · " + data.status.skillsDir');
  expect(html).toContain('class="metric-note" title=');
  expect(html).toContain('overflow-wrap: anywhere; text-overflow: clip;');
  expect(html).not.toContain('data-action="import-agent-mcp"');
  expect(html).toContain('class="mode-switch" role="group" aria-label="MCP add method"');
  expect(html).toContain('data-mcp-add-mode-option="manual" aria-pressed="true"');
  expect(html).toContain('data-mcp-add-mode-option="import" aria-pressed="false"');
  expect(html).toContain('data-mcp-add-mode="manual"');
  expect(html).toContain('data-mcp-add-mode="import" hidden');
  expect(html).toContain('class="target-tool-grid"');
  expect(html).toContain('class="target-tool-check"');
  expect(html).toContain('.mcp-add-dialog #dynamic-form');
  expect(html).toContain('searchControl("mcp") + scopeSummary("mcp", resources)');
  expect(html).toContain('System MCP servers are read only');
  expect(html).toContain('server.scope !== "system" && syncedMcpNames.has(server.name)');
  expect(html).toContain('form.get("mcpAddMode") === "import"');
  expect(html).toContain('api("/api/mcp/import"');
  expect(html).not.toContain("Import to Store");
  expect(html).toContain('state.skillFilter === "all"');
  expect(html).toContain('async function refreshAgentSyncState(button, kind)');
  expect(html).toContain('updateAgentSyncButton(button, kind)');
  expect(html).toContain('refreshAgentFilterCounts(kind)');
  const skillToggle = html.slice(html.indexOf('async function toggleSkillAgent'), html.indexOf('async function toggleMcpAgent'));
  expect(skillToggle).toContain('refreshAgentSyncState(button, "skill")');
  expect(skillToggle).not.toContain('await load()');
  expect(skillToggle).not.toContain('mode: "symlink"');
  const mcpToggle = html.slice(html.indexOf('async function toggleMcpAgent'), html.indexOf('function mcpFormBody'));
  expect(mcpToggle).toContain('refreshAgentSyncState(button, "mcp")');
  expect(mcpToggle).toContain('button.dataset.action === "delete-mcp-agent"');
  expect(html).toContain('state.mcpFilter === "all"');
  expect(html).not.toContain("Import from Agent");
  expect(html).not.toContain('data-action="sync-mcp"');
  expect(html).toContain('data-action="view-agent-mcp"');
  expect(html).toContain('data-resource-search-form=');
  expect(html).toContain('<button type="submit" class="btn" title="Search ');
  expect(html).not.toContain('>Move</button>');
  expect(html).not.toContain('>Remove</button>');
  expect(html).not.toContain('data-action="sync-skills"');
  expect(html).not.toContain('>Move Skills</button>');
  expect(html).not.toContain('>Remove Skills</button>');
  expect(html).not.toContain('>Deploy to Agents</button>');
  expect(html).not.toContain('>Deploy selected</button>');
  expect(html).not.toContain('>Add skill</button>');
  expect(html).not.toContain('>Add server</button>');
  expect(html).not.toContain("multiCheckField");
  expect(html).toContain('input.row-check[type="checkbox"]');
  expect(html).toContain('width: 16px; min-width: 16px; height: 16px; min-height: 16px;');
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
  const importedSnapshot = await handler(new Request("http://127.0.0.1:4343/api/snapshot"));
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
  const importedSnapshotBody = await importedSnapshot.json() as { skills: Array<{ name: string; scope: string; editable: boolean }> };
  expect(importedSnapshotBody.skills.find((skill) => skill.name === "web-managed")).toMatchObject({ scope: "user", editable: true });
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
