#!/usr/bin/env bun
import { initManager } from "./core/init";
import { status } from "./core/status";
import { addAllLocalAgentSkills, addCodexSkills, addLocalAgentSkills, addSkill, addSkills, findSkillAgentLinks, getSkill, listAgentSkills, listSkills, removeSkill, removeSkillAgentLink, skillMarkdownSummary } from "./core/skill";
import { listPresets, createPreset, applyPreset, movePreset, moveSkillPreset, moveSkillsPreset, removeSkillFromPreset, removeSkillsFromPreset, syncSkill, type SyncMode } from "./core/preset";
import { addMcpServer, getMcpServer, importMcpFromTools, listMcpServers, listToolMcpServers, removeMcpServer, syncMcp, syncMcpServer, type McpServer } from "./core/mcp";
import { listAgentOverview } from "./core/agent";
import { backup } from "./core/backup";
import { closeDb } from "./core/db";
import { heading, note, printJson, success, table, withLoading } from "./core/output";
import { UsageError, assertUsage } from "./core/errors";
import { getToolSkillsDirs, toolAdapters } from "./core/tools";
import { startWebDashboard } from "./web/server";

type GlobalOptions = {
  json: boolean;
};

type MenuCommand = {
  label: string;
  description: string;
  argv: string[];
  group: "System" | "Agents" | "Skills" | "Skill Presets" | "MCP";
};

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const global: GlobalOptions = { json: takeFlag(argv, "--json") };
  const command = argv.shift();
  if (command === undefined) {
    if (process.stdin.isTTY && process.stdout.isTTY) {
      await interactiveMenu(global);
    } else {
      printHelp();
    }
    return;
  }
  switch (command) {
    case "init":
      await runWithLoading(global, "Initializing Tools Manager...", initManager);
      success("Initialized tools manager.");
      break;
    case "status":
      await cmdStatus(global);
      break;
    case "agents":
      await cmdAgents(argv, global);
      break;
    case "skills":
      await cmdSkills(argv, global);
      break;
    case "presets":
      await cmdPresets(argv, global);
      break;
    case "mcp":
      await cmdMcp(argv, global);
      break;
    case "backup":
      await cmdBackup(global);
      break;
    case "web":
      await cmdWeb(argv);
      break;
    case "-h":
    case "--help":
      printHelp();
      break;
    default:
      throw new UsageError(`Unknown command: ${command}`);
  }
}

function runWithLoading<T>(global: GlobalOptions, message: string, action: () => Promise<T>): Promise<T> {
  return withLoading(message, action, { enabled: !global.json });
}

const menuCommands: MenuCommand[] = [
  { group: "System", label: "Status", description: "Paths, counts, and detected agents.", argv: ["status"] },
  { group: "System", label: "Open web dashboard", description: "Manage tools in a local browser.", argv: ["web"] },
  { group: "Agents", label: "List agent-side contents", description: "Show skills and MCP currently in agents.", argv: ["agents", "list", "--tool", "$tool?"] },
  { group: "Skills", label: "Add skill from source", description: "Import a local path or Git URL.", argv: ["skills", "add", "$source", "--preset", "$preset?"] },
  { group: "Skills", label: "Import skills from agent", description: "Copy agent-side skills into tm.", argv: ["skills", "add", "--tool", "$tool?", "--preset", "$preset?"] },
  { group: "Skills", label: "List managed skills", description: "Browse skills stored in tm.", argv: ["skills", "list"] },
  { group: "Skills", label: "Show managed skill", description: "Inspect one tm skill document.", argv: ["skills", "show", "$skill"] },
  { group: "Skills", label: "Remove skill", description: "Delete managed source and agent symlinks.", argv: ["skills", "remove", "$skill"] },
  { group: "Skills", label: "Unlink skill from agent", description: "Remove one managed Agent symlink only.", argv: ["skills", "unlink", "$skill", "--tool", "$agent?"] },
  { group: "Skills", label: "Sync selected skills", description: "Choose one or more skills for an agent.", argv: ["skills", "sync-selected", "$skills", "--tool", "$tool?", "--mode", "$mode?"] },
  { group: "Skill Presets", label: "List skill presets", description: "Show skill groups.", argv: ["presets", "list"] },
  { group: "Skill Presets", label: "Create skill preset", description: "Create an empty skill group.", argv: ["presets", "create", "$new_preset"] },
  { group: "Skill Presets", label: "Apply skill preset", description: "Apply one skill group to agents.", argv: ["presets", "apply", "$preset?", "--tool", "$tool?", "--mode", "$mode?"] },
  { group: "Skill Presets", label: "Move skills to preset", description: "Move selected skills between presets.", argv: ["presets", "move-skills", "$from", "$to", "$skills"] },
  { group: "Skill Presets", label: "Remove skills from preset", description: "Keep selected skills, remove group membership.", argv: ["presets", "remove-skills", "$from", "$skills"] },
  { group: "Skill Presets", label: "Move whole preset", description: "Move all skills between presets.", argv: ["presets", "move", "$from", "$to"] },
  { group: "MCP", label: "Add managed MCP server", description: "Register server and target agents.", argv: ["mcp", "add", "$mcp", "--command", "$command", "--arg", "$args?", "--env", "$env?", "--tool", "$tool?"] },
  { group: "MCP", label: "Add remote MCP server", description: "Register an HTTP endpoint and headers.", argv: ["mcp", "add", "$mcp", "--url", "$url", "--header", "$headers?", "--tool", "$tool?"] },
  { group: "MCP", label: "Import MCP from agent", description: "Copy agent config servers into tm.", argv: ["mcp", "add", "--tool", "$tool?"] },
  { group: "MCP", label: "List managed MCP servers", description: "Browse MCP servers stored in tm.", argv: ["mcp", "list"] },
  { group: "MCP", label: "Show managed MCP server", description: "Inspect one tm MCP server.", argv: ["mcp", "show", "$mcp"] },
  { group: "MCP", label: "Remove MCP server", description: "Delete from tm; sync to update agents.", argv: ["mcp", "remove", "$mcp"] },
  { group: "MCP", label: "Sync selected MCP", description: "Choose one or more servers for an agent.", argv: ["mcp", "sync-selected", "$mcps", "--tool", "$tool?"] },
  { group: "MCP", label: "Sync managed MCP", description: "Write tm MCP registry to agents.", argv: ["mcp", "sync", "--tool", "$tool?"] },
  { group: "System", label: "Backup skills", description: "Commit managed skills with Git.", argv: ["backup"] },
  { group: "System", label: "Help", description: "Print command reference.", argv: ["--help"] },
];

async function interactiveMenu(global: GlobalOptions): Promise<void> {
  while (true) {
    const selected = await selectMenu("Tools Manager", menuCommands);
    if (!selected) return;
    const argv = await resolveMenuArgs(selected.argv);
    if (!argv) continue;
    note(`\n$ tm ${argv.join(" ")}`);
    const command = argv.shift();
    if (command === "--help") {
      printHelp();
      await waitForMenuReturn();
      continue;
    }
    try {
      switch (command) {
        case "status":
          await cmdStatus(global);
          break;
        case "agents":
          await cmdAgents(argv, global);
          break;
        case "skills":
          await cmdSkills(argv, global);
          break;
        case "presets":
          await cmdPresets(argv, global);
          break;
        case "mcp":
          await cmdMcp(argv, global);
          break;
        case "backup":
          await cmdBackup(global);
          break;
        case "web":
          await cmdWeb(argv);
          break;
        default:
          throw new UsageError(`Unknown command: ${command}`);
      }
    } catch (error) {
      resetTerminalInput();
      console.error(error instanceof Error ? error.message : String(error));
    }
    await waitForMenuReturn();
  }
}

async function resolveMenuArgs(argv: string[]): Promise<string[] | null> {
  const resolved: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]!;
    if (arg === "$skill") {
      const value = await selectExistingOrCustom("Skill", await skillNameOptions(), "Skill name: ");
      if (value === null) return null;
      resolved.push(value);
    } else if (arg === "$skills") {
      const values = await selectMany("Skills", await skillNameOptions());
      if (values === null) return null;
      resolved.push(...values);
    } else if (arg === "$source") {
      const value = await selectExistingOrCustom("Skill Source", ["~/.codex/skills", "~/.claude/skills", "~/.cursor/skills", "~/.config/opencode/skills"], "Skill source path or Git URL: ");
      if (value === null) return null;
      resolved.push(value);
    } else if (arg === "$mcp") {
      const value = await selectExistingOrCustom("MCP Server", await mcpNameOptions(), "MCP server name: ");
      if (value === null) return null;
      resolved.push(value);
    } else if (arg === "$mcps") {
      const values = await selectMany("MCP Servers", await mcpNameOptions(true));
      if (values === null) return null;
      resolved.push(...values);
    } else if (arg === "$command") {
      const value = await selectExistingOrCustom("Command", ["npx", "bunx", "node", "python", "python3"], "Command: ");
      if (value === null) return null;
      resolved.push(value);
    } else if (arg === "$url") {
      const value = await selectExistingOrCustom("MCP URL", [], "Streamable HTTP URL: ");
      if (value === null) return null;
      resolved.push(value);
    } else if (arg === "$args?") {
      const previous = resolved[resolved.length - 1];
      const value = await selectExistingOrCustom("Args", ["none", "@playwright/mcp@latest", "-y @modelcontextprotocol/server-filesystem"], "Args [optional, space separated]: ");
      if (value === null) return null;
      if (value && value !== "none") {
        for (const item of value.split(/\s+/).filter(Boolean)) {
          resolved.push(item);
          resolved.push("--arg");
        }
        resolved.pop();
      } else if (previous === "--arg") {
        resolved.pop();
      }
    } else if (arg === "$headers?") {
      const value = await selectExistingOrCustom("HTTP Headers", ["none", "Authorization=Bearer $TOKEN"], "Headers [optional, comma separated KEY=value]: ");
      if (value === null) return null;
      if (value && value !== "none") {
        for (const item of value.split(",").map((entry) => entry.trim()).filter(Boolean)) {
          resolved.push(item);
          resolved.push("--header");
        }
        resolved.pop();
      } else if (resolved[resolved.length - 1] === "--header") {
        resolved.pop();
      }
    } else if (arg === "$env?") {
      const previous = resolved[resolved.length - 1];
      const value = await selectExistingOrCustom("Env", ["none"], "Env [optional, KEY=VALUE, comma separated]: ");
      if (value === null) return null;
      if (value && value !== "none") {
        for (const item of value.split(",").map((part) => part.trim()).filter(Boolean)) {
          resolved.push(item);
          resolved.push("--env");
        }
        resolved.pop();
      } else if (previous === "--env") {
        resolved.pop();
      }
    } else if (arg === "$new_preset") {
      const value = await selectExistingOrCustom("Preset Name", [], "New preset name: ");
      if (value === null) return null;
      resolved.push(value);
    } else if (arg === "$from") {
      const value = await selectExistingOrCustom("From Preset", await presetNameOptions(), "From preset: ");
      if (value === null) return null;
      resolved.push(value);
    } else if (arg === "$to") {
      const value = await selectExistingOrCustom("To Preset", await presetNameOptions(), "To preset: ");
      if (value === null) return null;
      resolved.push(value);
    }
    else if (arg === "$preset?") {
      const previous = resolved[resolved.length - 1];
      const value = await selectExistingOrCustom("Preset", await presetNameOptions("Default"), "Preset [Default]: ");
      if (value === null) return null;
      if (previous === "--preset") resolved.push(value || "Default");
      else if (value && value !== "Default") resolved.push(value);
    } else if (arg === "$tool?") {
      const previous = resolved[resolved.length - 1];
      if (previous === "--tool") {
        const value = await selectExistingOrCustom("Tool", ["all", "codex", "cursor", "claude_code", "opencode"], "Tool [all|codex|cursor|claude_code|opencode]: ");
        if (value === null) return null;
        resolved.push(value);
      }
    } else if (arg === "$agent?") {
      const previous = resolved[resolved.length - 1];
      if (previous === "--tool") {
        const value = await selectExistingOrCustom("Agent", ["codex", "cursor", "claude_code", "opencode"], "Agent [codex|cursor|claude_code|opencode]: ");
        if (value === null) return null;
        resolved.push(value);
      }
    } else if (arg === "$mode?") {
      const previous = resolved[resolved.length - 1];
      if (previous === "--mode") {
        const value = await selectExistingOrCustom("Sync Mode", ["symlink", "copy"], "Sync mode [symlink|copy]: ");
        if (value === null) return null;
        if (value) resolved.push(value);
        else resolved.pop();
      }
    } else {
      resolved.push(arg);
    }
  }
  return resolved.filter(Boolean);
}

async function cmdStatus(global: GlobalOptions): Promise<void> {
  const value = await runWithLoading(global, "Loading status...", status);
  if (global.json) return printJson(value);
  heading("Tools Manager Status");
  note(`Root: ${value.root}`);
  note(`Skills: ${value.skillCount} (${value.skillsDir})`);
  note(`Skill presets: ${value.presetCount}`);
  note(`MCP servers: ${value.mcpCount}`);
  table(value.tools.map((tool) => ({ tool: tool.key, installed: tool.installed ? "yes" : "no", skills: getToolSkillsDirs(tool).join(", "), mcp: tool.mcpPath })), { title: "Tools" });
}

async function cmdAgents(argv: string[], global: GlobalOptions): Promise<void> {
  const sub = argv.shift();
  switch (sub) {
    case "list": {
      const tool = takeOption(argv, "--tool") || "all";
      assertUsage(argv.length === 0, "Usage: tm agents list [--tool <tool|all>] [--json]");
      const result = await runWithLoading(global, "Loading Agent contents...", async () => {
        const [agents, skills, servers] = await Promise.all([listAgentOverview(tool), listSkills(), listMcpServers()]);
        return markAgentOverview(agents, new Set(skills.map((skill) => skill.name)), new Set(servers.map((server) => server.name)));
      });
      if (global.json) return printJson(result);
      printAgentOverview(result);
      break;
    }
    default:
      throw new UsageError("Usage: tm agents <list>");
  }
}

function markAgentOverview(result: Awaited<ReturnType<typeof listAgentOverview>>, skillNames: Set<string>, mcpNames: Set<string>) {
  return result.map((agent) => ({
    ...agent,
    skills: agent.skills.map((skill) => ({ ...skill, managed: skill.scope !== "system" && skillNames.has(skill.name) })),
    mcpServers: agent.mcpServers.map((server) => ({ ...server, managed: mcpNames.has(server.name) })),
  }));
}

function printAgentOverview(result: ReturnType<typeof markAgentOverview>): void {
  const rows = result.flatMap((agent) => {
    const skillRows = agent.skills.map((skill) => ({
      tool: agent.tool,
      type: "skill",
      name: skill.name,
      scope: skill.scope,
      status: skill.managed ? "synced" : "not-synced",
      detail: skill.description || "",
      path: skill.path,
    }));
    const mcpRows = agent.mcpServers.map((server) => ({
      tool: agent.tool,
      type: "mcp",
      name: server.name,
      scope: "user",
      status: server.managed ? "synced" : "not-synced",
      detail: server.transport === "http" ? server.url : [server.command, ...server.args].join(" "),
      path: agent.mcpPath,
    }));
    if (skillRows.length === 0 && mcpRows.length === 0) {
      return [{ tool: agent.tool, type: "", name: "", scope: "", status: "", detail: "No skills or MCP servers found.", path: `${agent.skillsPath} | ${agent.mcpPath}` }];
    }
    return [...skillRows, ...mcpRows];
  });
  table(rows, { title: "Agent Contents", empty: "No agents found." });
}

async function cmdSkills(argv: string[], global: GlobalOptions): Promise<void> {
  const sub = argv.shift();
  switch (sub) {
    case "add": {
      const preset = takeOption(argv, "--preset") || "Default";
      const tool = takeOption(argv, "--tool");
      if (tool) {
        assertUsage(argv.length === 0, "Usage: tm skills add --tool <tool|all> [--preset <name>]");
        const result = await runWithLoading(global, "Importing skills from Agent...", () => addLocalAgentSkills(tool, toolAdapters, preset));
        if (global.json) return printJson(result);
        printToolSkillImportResult(result);
        break;
      }
      if (takeFlag(argv, "--all")) {
        assertUsage(argv.length === 0, "Usage: tm skills add --all [--preset <name>]");
        const result = await runWithLoading(global, "Importing skills from Agents...", () => addAllLocalAgentSkills(toolAdapters, preset));
        if (global.json) return printJson(result);
        printToolSkillImportResult(result);
        break;
      }
      if (takeFlag(argv, "--codex")) {
        assertUsage(argv.length === 0, "Usage: tm skills add --codex [--preset <name>]");
        const skills = await runWithLoading(global, "Importing Codex skills...", () => addCodexSkills(undefined, preset));
        if (global.json) return printJson(skills);
        printSkills(skills, "Imported Skills");
        break;
      }
      const source = argv.shift();
      assertUsage(source && argv.length === 0, "Usage: tm skills add <source> [--preset <name>]");
      const skills = await runWithLoading(global, "Importing skills...", () => addSkills(source, preset));
      if (global.json) return printJson(skills);
      if (skills.length === 1) success(`Added skill ${skills[0]!.name}`);
      else printSkills(skills, `Imported Skills (${skills.length})`);
      break;
    }
    case "list": {
      const tool = takeOption(argv, "--tool");
      assertUsage(argv.length === 0, "Usage: tm skills list [--tool <tool|all>] [--json]");
      if (tool) {
        const result = await runWithLoading(global, "Loading Agent skills...", async () => {
          const [agents, managed] = await Promise.all([listAgentSkills(tool), listSkills()]);
          const names = new Set(managed.map((skill) => skill.name));
          return agents.map((item) => ({ ...item, skills: item.skills.map((skill) => ({ ...skill, managed: skill.scope !== "system" && names.has(skill.name) })) }));
        });
        if (global.json) return printJson(result);
        printAgentSkills(result);
        break;
      }
      const skills = await runWithLoading(global, "Loading managed skills...", listSkills);
      if (global.json) return printJson(skills.map((skill) => ({ ...skill, scope: "user", editable: true })));
      printSkills(skills, `Skills (${skills.length})`);
      break;
    }
    case "show": {
      const name = argv.shift();
      assertUsage(name, "Usage: tm skills show <name>");
      const skill = await runWithLoading(global, "Loading skill...", () => getSkill(name));
      assertUsage(skill, `Skill not found: ${name}`);
      const markdown = await runWithLoading(global, "Reading skill content...", () => skillMarkdownSummary(skill));
      if (global.json) return printJson({ ...skill, markdown });
      heading(skill.name);
      note(`Description: ${skill.description || ""}`);
      note(`Path: ${skill.path}`);
      note(`Source: ${skill.source_type}${skill.source_url ? ` ${skill.source_url}` : ""}`);
      note("");
      note(markdown);
      break;
    }
    case "remove":
    case "rm": {
      const yes = takeFlag(argv, "--yes") || takeFlag(argv, "-y");
      const name = argv.shift();
      assertUsage(name, "Usage: tm skills remove <name> [--yes]");
      const { skill, agentLinks } = await runWithLoading(global, "Inspecting skill links...", async () => {
        const managedSkill = await getSkill(name);
        assertUsage(managedSkill, `Skill not found: ${name}`);
        return { skill: managedSkill, agentLinks: await findSkillAgentLinks(managedSkill) };
      });
      if (global.json) {
        const result = await runWithLoading(global, "Removing skill...", () => removeSkill(name, { removeAgentLinks: true }));
        return printJson(result);
      }
      if (agentLinks.length > 0) {
        note(`Removing ${skill.name} will delete its managed source:`);
        note(`  ${skill.path}`);
        note("These agent skill symlinks point to that source and will also be deleted:");
        for (const link of agentLinks) note(`  ${link.tool}: ${link.path}`);
      } else {
        note(`Removing ${skill.name} will delete its managed source:`);
        note(`  ${skill.path}`);
      }
      if (!yes) {
        const confirmed = await confirm("Continue? [y/N] ");
        if (!confirmed) {
          note("Aborted.");
          break;
        }
      }
      const result = await runWithLoading(global, "Removing skill...", () => removeSkill(name, { removeAgentLinks: true }));
      success(`Removed skill ${result.skill.name}`);
      if (result.agentLinks.length > 0) success(`Removed ${result.agentLinks.length} agent symlink(s).`);
      break;
    }
    case "unlink": {
      const name = argv.shift();
      const tool = takeOption(argv, "--tool");
      assertUsage(name && tool && tool !== "all" && argv.length === 0, "Usage: tm skills unlink <name> --tool <codex|claude_code|cursor|opencode>");
      const result = await runWithLoading(global, "Unlinking skill from Agent...", () => removeSkillAgentLink(name, tool));
      if (global.json) return printJson(result);
      success(`Removed ${result.skill.name} from ${result.agentLink.tool}. The managed skill was kept.`);
      break;
    }
    case "sync": {
      const preset = argv[0]?.startsWith("--") ? "Default" : (argv.shift() || "Default");
      const tool = takeOption(argv, "--tool") || "all";
      const mode = takeSyncMode(argv);
      assertUsage(argv.length === 0, "Usage: tm skills sync [preset] [--tool <tool|all>] [--mode <symlink|copy>]");
      const result = await runWithLoading(global, "Syncing skill preset...", () => applyPreset(preset, tool, mode));
      if (global.json) return printJson(result);
      table(result.map((row) => ({ tool: row.tool, skill: row.skill, mode: row.mode, target: row.target })), { title: `Synced ${result.length} Skills` });
      break;
    }
    case "sync-selected": {
      const tool = takeOption(argv, "--tool") || "all";
      const mode = takeSyncMode(argv);
      const names = [...new Set(argv)];
      assertUsage(names.length > 0, "Usage: tm skills sync-selected <name...> [--tool <tool|all>] [--mode <symlink|copy>]");
      const result = await runWithLoading(global, "Syncing selected skills...", async () => {
        const synced: Awaited<ReturnType<typeof syncSkill>> = [];
        for (const name of names) synced.push(...await syncSkill(name, tool, mode));
        return synced;
      });
      if (global.json) return printJson(result);
      table(result.map((row) => ({ tool: row.tool, skill: row.skill, mode: row.mode, target: row.target })), { title: `Synced ${names.length} Selected Skills` });
      break;
    }
    default:
      throw new UsageError("Usage: tm skills <add|list|show|remove|unlink|sync-selected|sync>");
  }
}

function printToolSkillImportResult(result: Awaited<ReturnType<typeof addLocalAgentSkills>>): void {
  const rows = result.flatMap((tool) => tool.skills.map((skill) => ({ tool: tool.tool, name: skill.name, scope: "user", source: skill.source_type, description: skill.description || "" })));
  table(rows, { title: `Imported Skills (${rows.length})`, empty: "No skills imported." });
}

function printSkills(skills: Array<{ name: string; source_type: string; description: string | null }>, title: string): void {
  table(skills.map((skill) => ({ name: skill.name, scope: "user", source: skill.source_type, description: skill.description || "" })), { title, empty: "No skills found." });
}

function printAgentSkills(result: Array<{ tool: string; path: string; skills: Array<{ name: string; description: string | null; path: string; scope: "user" | "system"; editable: boolean; managed: boolean }> }>): void {
  const rows = result.flatMap((item) => item.skills.map((skill) => ({ tool: item.tool, name: skill.name, scope: skill.scope, access: skill.managed && skill.scope !== "system" ? "editable" : "read-only", sync: skill.managed ? "synced" : "not-synced", description: skill.description || "", path: skill.path })));
  table(rows, { title: `Agent Skills (${rows.length})`, empty: "No agent skills found." });
}

async function cmdPresets(argv: string[], global: GlobalOptions): Promise<void> {
  const sub = argv.shift();
  switch (sub) {
    case "create": {
      const name = argv.shift();
      assertUsage(name && argv.length === 0, "Usage: tm presets create <name>");
      const preset = await runWithLoading(global, "Creating skill preset...", () => createPreset(name));
      if (global.json) return printJson(preset);
      success(`Created preset ${preset.name}.`);
      break;
    }
    case "list": {
      const presets = await runWithLoading(global, "Loading skill presets...", listPresets);
      if (global.json) return printJson(presets);
      table(presets.map((preset) => ({ name: preset.name, skills: preset.skill_count })), { title: `Skill Presets (${presets.length})` });
      break;
    }
    case "apply": {
      const preset = argv[0]?.startsWith("--") ? "Default" : (argv.shift() || "Default");
      const tool = takeOption(argv, "--tool") || "all";
      const mode = takeSyncMode(argv);
      assertUsage(argv.length === 0, "Usage: tm presets apply [preset] [--tool <tool|all>] [--mode <symlink|copy>]");
      const result = await runWithLoading(global, "Applying skill preset...", () => applyPreset(preset, tool, mode));
      if (global.json) return printJson(result);
      table(result.map((row) => ({ tool: row.tool, skill: row.skill, mode: row.mode, target: row.target })), { title: `Applied ${result.length} Skills` });
      break;
    }
    case "move":
    case "mv": {
      const from = argv.shift();
      const to = argv.shift();
      assertUsage(from && to, "Usage: tm presets move <from> <to>");
      const result = await runWithLoading(global, "Moving preset skills...", () => movePreset(from, to));
      if (global.json) return printJson(result);
      success(`Moved ${result.skillCount} skills from ${result.from} to ${result.to}.`);
      break;
    }
    case "move-skill": {
      const skill = argv.shift();
      const from = argv.shift();
      const to = argv.shift();
      assertUsage(skill && from && to, "Usage: tm presets move-skill <skill> <from> <to>");
      const result = await runWithLoading(global, "Moving skill...", () => moveSkillPreset(skill, from, to));
      if (global.json) return printJson(result);
      success(`Moved ${result.skill} from ${result.from} to ${result.to}.`);
      break;
    }
    case "move-skills": {
      const from = argv.shift();
      const to = argv.shift();
      const skills = [...new Set(argv)];
      assertUsage(from && to && skills.length > 0, "Usage: tm presets move-skills <from> <to> <skill...>");
      const result = await runWithLoading(global, "Moving skills...", () => moveSkillsPreset(skills, from, to));
      if (global.json) return printJson(result);
      success(`Moved ${result.count} skills from ${result.from} to ${result.to}.`);
      break;
    }
    case "remove-skill": {
      const skill = argv.shift();
      const preset = argv.shift();
      assertUsage(skill && preset && argv.length === 0, "Usage: tm presets remove-skill <skill> <preset>");
      const result = await runWithLoading(global, "Removing skill from preset...", () => removeSkillFromPreset(skill, preset));
      if (global.json) return printJson(result);
      success(`Removed ${result.skill} from ${result.preset}. The managed skill was kept.`);
      break;
    }
    case "remove-skills": {
      const preset = argv.shift();
      const skills = [...new Set(argv)];
      assertUsage(preset && skills.length > 0, "Usage: tm presets remove-skills <preset> <skill...>");
      const result = await runWithLoading(global, "Removing skills from preset...", () => removeSkillsFromPreset(skills, preset));
      if (global.json) return printJson(result);
      success(`Removed ${result.count} skills from ${result.preset}. The managed skills were kept.`);
      break;
    }
    default:
      throw new UsageError("Usage: tm presets <create|list|apply|move|move-skill|move-skills|remove-skill|remove-skills>");
  }
}

async function cmdMcp(argv: string[], global: GlobalOptions): Promise<void> {
  const sub = argv.shift();
  switch (sub) {
    case "add": {
      const importTool = takeOption(argv, "--tool");
      if (importTool && argv.length === 0) {
        const result = await runWithLoading(global, "Importing MCP servers from Agents...", () => importMcpFromTools(importTool));
        if (global.json) return printJson(result);
        table(result.map((row) => ({ tool: row.tool, servers: row.count, path: row.path, names: row.servers.join(",") })), { title: "Imported MCP Servers" });
        break;
      }
      const name = argv.shift();
      assertUsage(name, "Usage: tm mcp add <name> (--command <cmd> | --url <url>) [--arg value] [--env K=V] [--header K=V] [--tool <tool|all>]");
      const command = takeOption(argv, "--command");
      const url = takeOption(argv, "--url");
      assertUsage(Boolean(command) !== Boolean(url), "Provide exactly one of --command or --url.");
      const args = takeRepeatedOption(argv, "--arg");
      const env = Object.assign({}, ...takeRepeatedOption(argv, "--env").map(parseKeyValue));
      const headers = Object.assign({}, ...takeRepeatedOption(argv, "--header").map(parseKeyValue));
      assertUsage(!url || (args.length === 0 && Object.keys(env).length === 0), "--arg and --env are only valid with --command.");
      assertUsage(!command || Object.keys(headers).length === 0, "--header is only valid with --url.");
      if (url) validateMcpUrl(url);
      const targetTools = importTool ? [importTool, ...takeRepeatedOption(argv, "--tool")] : takeRepeatedOption(argv, "--tool");
      assertUsage(argv.length === 0, `Unknown argument: ${argv[0]}`);
      await runWithLoading(global, "Adding MCP server...", () => addMcpServer({
        name,
        transport: url ? "http" : "stdio",
        command: command || "",
        url: url || "",
        args,
        env,
        headers,
        targetTools: targetTools.length ? targetTools : ["all"],
        enabled: true,
      }));
      success(`Added MCP server ${name}`);
      break;
    }
    case "list": {
      const tool = takeOption(argv, "--tool");
      assertUsage(argv.length === 0, "Usage: tm mcp list [--tool <tool|all>] [--json]");
      if (tool) {
        const result = await runWithLoading(global, "Loading Agent MCP servers...", async () => {
          const [agents, managed] = await Promise.all([listToolMcpServers(tool), listMcpServers()]);
          const names = new Set(managed.map((server) => server.name));
          return agents.map((item) => ({ ...item, servers: item.servers.map((server) => ({ ...server, managed: names.has(server.name) })) }));
        });
        if (global.json) return printJson(result);
        printToolMcpServers(result);
        break;
      }
      const servers = await runWithLoading(global, "Loading MCP servers...", listMcpServers);
      if (global.json) return printJson(servers);
      table(servers.map((server) => ({ name: server.name, transport: server.transport, endpoint: mcpEndpoint(server), tools: server.targetTools.join(","), enabled: server.enabled ? "yes" : "no" })), { title: `MCP Servers (${servers.length})` });
      break;
    }
    case "show": {
      const name = argv.shift();
      assertUsage(name, "Usage: tm mcp show <name>");
      const server = await runWithLoading(global, "Loading MCP server...", () => getMcpServer(name));
      assertUsage(server, `MCP server not found: ${name}`);
      if (global.json) return printJson(server);
      heading(server.name);
      note(`Transport: ${server.transport}`);
      if (server.transport === "http") note(`URL: ${server.url}`);
      else {
        note(`Command: ${server.command}`);
        note(`Args: ${server.args.join(" ")}`);
      }
      note(`Tools: ${server.targetTools.join(",")}`);
      note(`Enabled: ${server.enabled ? "yes" : "no"}`);
      if (Object.keys(server.env).length > 0) {
        note("Env:");
        for (const [key, value] of Object.entries(server.env)) note(`  ${key}=${value}`);
      }
      if (Object.keys(server.headers).length > 0) {
        note("Headers:");
        for (const [key, value] of Object.entries(server.headers)) note(`  ${key}=${value}`);
      }
      break;
    }
    case "sync": {
      const tool = takeOption(argv, "--tool") || "all";
      const result = await runWithLoading(global, "Syncing MCP configuration...", () => syncMcp(tool));
      if (global.json) return printJson(result);
      table(result.map((row) => ({ tool: row.tool, servers: row.count, path: row.path, backup: row.backup || "" })), { title: "MCP Sync" });
      break;
    }
    case "sync-selected": {
      const tool = takeOption(argv, "--tool") || "all";
      const names = [...new Set(argv)];
      assertUsage(names.length > 0, "Usage: tm mcp sync-selected <name...> [--tool <tool|all>]");
      const result = await runWithLoading(global, "Syncing selected MCP servers...", async () => {
        const synced: Awaited<ReturnType<typeof syncMcpServer>> = [];
        for (const name of names) synced.push(...await syncMcpServer(name, tool));
        return synced;
      });
      if (global.json) return printJson(result);
      table(result.map((row) => ({ tool: row.tool, servers: row.count, path: row.path, backup: row.backup || "" })), { title: `Synced ${names.length} Selected MCP Servers` });
      break;
    }
    case "remove":
    case "rm": {
      const name = argv.shift();
      assertUsage(name, "Usage: tm mcp remove <name>");
      const server = await runWithLoading(global, "Removing MCP server...", () => removeMcpServer(name));
      if (global.json) return printJson(server);
      success(`Removed MCP server ${server.name}`);
      break;
    }
    default:
      throw new UsageError("Usage: tm mcp <add|list|show|sync-selected|sync|remove>");
  }
}

function printToolMcpServers(result: Array<{ tool: string; path: string; servers: Array<McpServer & { managed: boolean }> }>): void {
  const rows = result.flatMap((item) => item.servers.map((server) => ({ tool: item.tool, name: server.name, sync: server.managed ? "synced" : "not-synced", transport: server.transport, endpoint: mcpEndpoint(server), credentials: Object.keys(server.transport === "http" ? server.headers : server.env).length, path: item.path })));
  table(rows, { title: `Agent MCP Servers (${rows.length})`, empty: "No agent MCP servers found." });
}

function mcpEndpoint(server: { transport: "stdio" | "http"; command: string; args: string[]; url: string }): string {
  return server.transport === "http" ? server.url : [server.command, ...server.args].join(" ");
}

function validateMcpUrl(value: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UsageError("MCP URL must be a valid http:// or https:// URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UsageError("MCP URL must use http:// or https://.");
}

async function cmdBackup(global: GlobalOptions): Promise<void> {
  const result = await runWithLoading(global, "Backing up managed skills...", backup);
  if (global.json) return printJson(result);
  success(result.message);
  if (result.pushed) success("Pushed to origin.");
}

async function cmdWeb(argv: string[]): Promise<void> {
  const portValue = takeOption(argv, "--port");
  const noOpen = takeFlag(argv, "--no-open");
  const dev = takeFlag(argv, "--dev");
  assertUsage(argv.length === 0, "Usage: tm web [--port <port>] [--no-open] [--dev]");
  const port = portValue === undefined ? undefined : Number(portValue);
  assertUsage(port === undefined || (Number.isInteger(port) && port > 0 && port <= 65535), "Expected --port to be an integer between 1 and 65535.");
  await startWebDashboard({ ...(port === undefined ? {} : { port }), open: !noOpen, dev });
}

function parseKeyValue(value: string): Record<string, string> {
  const index = value.indexOf("=");
  assertUsage(index > 0, `Expected KEY=VALUE, got: ${value}`);
  return { [value.slice(0, index)]: value.slice(index + 1) };
}

function takeFlag(argv: string[], flag: string): boolean {
  const index = argv.indexOf(flag);
  if (index === -1) return false;
  argv.splice(index, 1);
  return true;
}

function takeOption(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  assertUsage(value && !value.startsWith("--"), `Missing value for ${flag}.`);
  argv.splice(index, 2);
  return value;
}

function takeSyncMode(argv: string[]): SyncMode | undefined {
  const mode = takeOption(argv, "--mode");
  if (!mode) return undefined;
  assertUsage(mode === "symlink" || mode === "copy", "Expected --mode to be one of: symlink, copy.");
  return mode;
}

function takeRepeatedOption(argv: string[], flag: string): string[] {
  const values: string[] = [];
  let value;
  while ((value = takeOption(argv, flag))) values.push(value);
  return values;
}

async function selectMenu(title: string, commands: MenuCommand[]): Promise<MenuCommand | null> {
  let selected = 0;
  let selecting = true;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  const render = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write(`${ansi.dim("╭──────────────────────────────────────────────────────────────────────────────╮")}\n`);
    process.stdout.write(`${ansi.dim("│")} ${ansi.signal(title.padEnd(76))} ${ansi.dim("│")}\n`);
    process.stdout.write(`${ansi.dim("│")} ${ansi.muted("One local control plane for skills, presets, and MCP servers.".padEnd(76))} ${ansi.dim("│")}\n`);
    process.stdout.write(`${ansi.dim("╰──────────────────────────────────────────────────────────────────────────────╯")}\n\n`);
    process.stdout.write(`${ansi.muted("↑/↓ choose")}  ${ansi.muted("Enter run")}  ${ansi.muted("Esc deselect")}  ${ansi.muted("q quit")}\n\n`);
    let group = "";
    commands.forEach((command, index) => {
      const active = selecting && index === selected;
      if (command.group !== group) {
        group = command.group;
        process.stdout.write(`\n${ansi.group(group)}\n`);
      }
      const line = ` ${command.label.padEnd(24)} ${command.description.padEnd(44)} ${commandText(command.argv)}`;
      process.stdout.write(active ? `${ansi.selected(`›${line}`)}\n` : `${ansi.dim(" ")}${line}\n`);
    });
  };
  render();
  return new Promise((resolve) => {
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      if (chunk === "\u0003" || chunk.toLowerCase() === "q") {
        cleanup();
        resolve(null);
        return;
      }
      if (chunk === "\u001b") {
        selecting = false;
        render();
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        if (!selecting) {
          selecting = true;
          render();
          return;
        }
        const command = commands[selected] || null;
        cleanup();
        resolve(command);
        return;
      }
      if (chunk === "\u001b[A") {
        selecting = true;
        selected = (selected - 1 + commands.length) % commands.length;
        render();
      } else if (chunk === "\u001b[B") {
        selecting = true;
        selected = (selected + 1) % commands.length;
        render();
      }
    };
    process.stdin.on("data", onData);
  });
}

const ansi = {
  signal: (value: string) => `\x1b[38;5;191m${value}\x1b[0m`,
  muted: (value: string) => `\x1b[38;5;244m${value}\x1b[0m`,
  dim: (value: string) => `\x1b[2m${value}\x1b[0m`,
  group: (value: string) => `\x1b[38;5;214m${value.toUpperCase()}\x1b[0m`,
  selected: (value: string) => `\x1b[38;5;16m\x1b[48;5;191m${value}\x1b[0m`,
};

function commandText(argv: string[]): string {
  return ansi.muted(`tm ${argv.filter((arg) => !arg.startsWith("$")).join(" ")}`);
}

type SelectValueOptions = {
  custom?: boolean;
  descriptions?: Record<string, string>;
};

async function selectValue(title: string, values: string[], options: SelectValueOptions = {}): Promise<string | null> {
  const customLabel = "<custom>";
  const choices = options.custom ? [...values, customLabel] : values;
  let selected = 0;
  let selecting = true;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  const render = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write(`${ansi.signal(title)}\n`);
    process.stdout.write(`${ansi.muted("↑/↓ choose")}  ${ansi.muted("Enter select")}  ${ansi.muted("Esc deselect")}  ${ansi.muted("q return")}\n\n`);
    choices.forEach((value, index) => {
      const active = selecting && index === selected;
      const description = value === customLabel ? "custom input" : options.descriptions?.[value] || "";
      const line = ` ${value.padEnd(18)} ${description}`;
      process.stdout.write(active ? `${ansi.selected(`›${line}`)}\n` : `${ansi.dim(" ")}${line}\n`);
    });
  };
  render();
  return new Promise((resolve) => {
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      if (chunk === "\u0003" || chunk.toLowerCase() === "q") {
        cleanup();
        resolve(null);
        return;
      }
      if (chunk === "\u001b") {
        selecting = false;
        render();
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        if (!selecting) {
          selecting = true;
          render();
          return;
        }
        const value = choices[selected] || null;
        cleanup();
        resolve(value === customLabel ? "__custom__" : value);
        return;
      }
      if (chunk === "\u001b[A") {
        selecting = true;
        selected = (selected - 1 + choices.length) % choices.length;
        render();
      } else if (chunk === "\u001b[B") {
        selecting = true;
        selected = (selected + 1) % choices.length;
        render();
      }
    };
    process.stdin.on("data", onData);
  });
}

async function selectMany(title: string, values: string[]): Promise<string[] | null> {
  const choices = [...new Set(values.filter(Boolean))];
  if (choices.length === 0) throw new UsageError(`No ${title.toLowerCase()} available.`);
  let selected = 0;
  let message = "";
  const checked = new Set<string>();
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  const render = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write(`${ansi.signal(title)}\n`);
    process.stdout.write(`${ansi.muted("↑/↓ choose")}  ${ansi.muted("Space toggle")}  ${ansi.muted("a all")}  ${ansi.muted("Enter confirm")}  ${ansi.muted("Esc clear")}  ${ansi.muted("q return")}\n\n`);
    choices.forEach((value, index) => {
      const marker = checked.has(value) ? "[x]" : "[ ]";
      const line = ` ${marker} ${value}`;
      process.stdout.write(index === selected ? `${ansi.selected(`›${line}`)}\n` : `${ansi.dim(" ")}${line}\n`);
    });
    if (message) process.stdout.write(`\n${ansi.muted(message)}\n`);
  };
  render();
  return new Promise((resolve) => {
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk: string) => {
      if (chunk === "\u0003" || chunk.toLowerCase() === "q") {
        cleanup();
        resolve(null);
        return;
      }
      if (chunk === "\u001b") {
        checked.clear();
        message = "Selection cleared.";
        render();
        return;
      }
      if (chunk === " ") {
        const value = choices[selected]!;
        if (checked.has(value)) checked.delete(value);
        else checked.add(value);
        message = "";
        render();
        return;
      }
      if (chunk.toLowerCase() === "a") {
        if (checked.size === choices.length) checked.clear();
        else choices.forEach((value) => checked.add(value));
        message = "";
        render();
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        if (checked.size === 0) {
          message = "Select at least one item.";
          render();
          return;
        }
        cleanup();
        resolve(choices.filter((value) => checked.has(value)));
        return;
      }
      if (chunk === "\u001b[A") {
        selected = (selected - 1 + choices.length) % choices.length;
        message = "";
        render();
      } else if (chunk === "\u001b[B") {
        selected = (selected + 1) % choices.length;
        message = "";
        render();
      }
    };
    process.stdin.on("data", onData);
  });
}

async function selectExistingOrCustom(title: string, values: string[], prompt: string): Promise<string | null> {
  const uniqueValues = [...new Set(values.filter(Boolean))];
  const selected = await selectValue(title, uniqueValues, { custom: true });
  if (selected === null) return null;
  if (selected === "__custom__") return promptText(prompt);
  return selected;
}

async function skillNameOptions(): Promise<string[]> {
  try {
    return (await listSkills()).map((skill) => skill.name);
  } catch {
    return [];
  }
}

async function presetNameOptions(fallback?: string): Promise<string[]> {
  try {
    const names = (await listPresets()).map((preset) => preset.name);
    return fallback && !names.includes(fallback) ? [fallback, ...names] : names;
  } catch {
    return fallback ? [fallback] : [];
  }
}

async function mcpNameOptions(enabledOnly = false): Promise<string[]> {
  try {
    return (await listMcpServers()).filter((server) => !enabledOnly || server.enabled).map((server) => server.name);
  } catch {
    return [];
  }
}

async function promptText(prompt: string): Promise<string | null> {
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(`${prompt}${ansi.muted("(Esc to return) ")}`);
  return new Promise((resolve) => {
    let value = "";
    const cleanup = () => {
      process.stdin.off("data", onData);
      resetTerminalInput();
      process.stdout.write("\n");
    };
    const onData = (data: Buffer) => {
      const chunk = String(data);
      if (chunk === "\u0003" || chunk === "\u001b") {
        cleanup();
        resolve(null);
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        cleanup();
        resolve(value.trim());
        return;
      }
      if (chunk === "\u007f") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
        return;
      }
      if (chunk >= " ") {
        value += chunk;
        process.stdout.write(chunk);
      }
    };
    process.stdin.on("data", onData);
  });
}

async function waitForMenuReturn(): Promise<void> {
  if (!process.stdin.isTTY) return;
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdout.write(`\n${ansi.muted("Press Enter or Esc to return to menu.")}`);
  await new Promise<void>((resolve) => {
    const cleanup = () => {
      process.stdin.off("data", onData);
      resetTerminalInput();
      process.stdout.write("\n");
    };
    const onData = (data: Buffer) => {
      const chunk = String(data);
      if (chunk === "\r" || chunk === "\n" || chunk === "\u001b" || chunk === "\u0003") {
        cleanup();
        resolve();
      }
    };
    process.stdin.on("data", onData);
  });
}

function resetTerminalInput(): void {
  if (process.stdin.isTTY) process.stdin.setRawMode(false);
  process.stdin.pause();
}

async function confirm(prompt: string): Promise<boolean> {
  process.stderr.write(prompt);
  const line = await new Promise<string>((resolve) => {
    process.stdin.once("data", (data) => resolve(String(data)));
  });
  return ["y", "yes"].includes(line.trim().toLowerCase());
}

function printHelp(): void {
  console.log(`Usage:
  tm init
  tm web [--port <port>] [--no-open] [--dev]
  tm status [--json]
  tm agents list [--tool <tool|all>] [--json]
  tm skills add <source> [--preset <name>]
  tm skills add --tool <tool|all> [--preset <name>]
  tm skills add --codex [--preset <name>]
  tm skills add --all [--preset <name>]
  tm skills list [--json]
  tm skills list --tool <tool|all> [--json]
  tm skills show <name> [--json]
  tm skills remove <name>
  tm skills unlink <name> --tool <codex|claude_code|cursor|opencode>
  tm skills sync-selected <name...> [--tool <tool|all>] [--mode <symlink|copy>]
  tm skills sync [preset] [--tool <tool|all>] [--mode <symlink|copy>]
  tm presets create <name>
  tm presets list [--json]
  tm presets apply [preset] [--tool <tool|all>] [--mode <symlink|copy>]
  tm presets move-skill <skill> <from> <to>
  tm presets move-skills <from> <to> <skill...>
  tm presets remove-skill <skill> <preset>
  tm presets remove-skills <preset> <skill...>
  tm presets move <from> <to>
  tm mcp add <name> (--command <cmd> [--arg value] [--env K=V] | --url <url> [--header K=V]) [--tool <tool|all>]
  tm mcp add --tool <tool|all>
  tm mcp list [--json]
  tm mcp list --tool <tool|all> [--json]
  tm mcp show <name> [--json]
  tm mcp sync-selected <name...> [--tool <tool|all>]
  tm mcp sync [--tool <tool|all>]
  tm mcp remove <name>
  tm backup`);
}

main()
  .catch((error: unknown) => {
    resetTerminalInput();
    if (error instanceof UsageError) {
      console.error(error.message);
      process.exitCode = 2;
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => closeDb());
