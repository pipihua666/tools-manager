#!/usr/bin/env bun
import { initManager } from "./core/init";
import { status } from "./core/status";
import { addAllLocalAgentSkills, addCodexSkills, addLocalAgentSkills, addSkill, addSkills, findSkillAgentLinks, getSkill, listAgentSkills, listSkills, removeSkill, skillMarkdownSummary } from "./core/skill";
import { listPresets, applyPreset, movePreset, moveSkillPreset, type SyncMode } from "./core/preset";
import { addMcpServer, getMcpServer, importMcpFromTools, listMcpServers, listToolMcpServers, removeMcpServer, syncMcp } from "./core/mcp";
import { listAgentOverview } from "./core/agent";
import { backup } from "./core/backup";
import { closeDb } from "./core/db";
import { heading, note, printJson, success, table } from "./core/output";
import { UsageError, assertUsage } from "./core/errors";

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
      await initManager();
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
    case "-h":
    case "--help":
      printHelp();
      break;
    default:
      throw new UsageError(`Unknown command: ${command}`);
  }
}

const menuCommands: MenuCommand[] = [
  { group: "System", label: "Status", description: "Paths, counts, and detected agents.", argv: ["status"] },
  { group: "Agents", label: "List agent-side contents", description: "Show skills and MCP currently in agents.", argv: ["agents", "list", "--tool", "$tool?"] },
  { group: "Skills", label: "Add skill from source", description: "Import a local path or Git URL.", argv: ["skills", "add", "$source"] },
  { group: "Skills", label: "Import skills from agent", description: "Copy agent-side skills into tm.", argv: ["skills", "add", "--tool", "$tool?"] },
  { group: "Skills", label: "List managed skills", description: "Browse skills stored in tm.", argv: ["skills", "list"] },
  { group: "Skills", label: "Show managed skill", description: "Inspect one tm skill document.", argv: ["skills", "show", "$skill"] },
  { group: "Skills", label: "Remove skill", description: "Delete managed source and agent symlinks.", argv: ["skills", "remove", "$skill"] },
  { group: "Skills", label: "Sync preset skills", description: "Apply a tm preset to agents.", argv: ["skills", "sync", "$preset?", "--tool", "$tool?", "--mode", "$mode?"] },
  { group: "Skill Presets", label: "List skill presets", description: "Show skill groups.", argv: ["presets", "list"] },
  { group: "Skill Presets", label: "Move skill to preset", description: "Move one skill between presets.", argv: ["presets", "move-skill", "$skill", "$from", "$to"] },
  { group: "Skill Presets", label: "Move whole preset", description: "Move all skills between presets.", argv: ["presets", "move", "$from", "$to"] },
  { group: "MCP", label: "Add managed MCP server", description: "Register server and target agents.", argv: ["mcp", "add", "$mcp", "--command", "$command", "--arg", "$args?", "--env", "$env?", "--tool", "$tool?"] },
  { group: "MCP", label: "Import MCP from agent", description: "Copy agent config servers into tm.", argv: ["mcp", "add", "--tool", "$tool?"] },
  { group: "MCP", label: "List managed MCP servers", description: "Browse MCP servers stored in tm.", argv: ["mcp", "list"] },
  { group: "MCP", label: "Show managed MCP server", description: "Inspect one tm MCP server.", argv: ["mcp", "show", "$mcp"] },
  { group: "MCP", label: "Remove MCP server", description: "Delete from tm; sync to update agents.", argv: ["mcp", "remove", "$mcp"] },
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
    } else if (arg === "$source") {
      const value = await selectExistingOrCustom("Skill Source", ["~/.codex/skills", "~/.claude/skills", "~/.cursor/skills", "~/.config/opencode/skills"], "Skill source path or Git URL: ");
      if (value === null) return null;
      resolved.push(value);
    } else if (arg === "$mcp") {
      const value = await selectExistingOrCustom("MCP Server", await mcpNameOptions(), "MCP server name: ");
      if (value === null) return null;
      resolved.push(value);
    } else if (arg === "$command") {
      const value = await selectExistingOrCustom("Command", ["npx", "bunx", "node", "python", "python3"], "Command: ");
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
      const value = await selectExistingOrCustom("Preset", await presetNameOptions("Default"), "Preset [Default]: ");
      if (value === null) return null;
      if (value && value !== "Default") resolved.push(value);
    } else if (arg === "$tool?") {
      const previous = resolved[resolved.length - 1];
      if (previous === "--tool") {
        const value = await selectExistingOrCustom("Tool", ["all", "codex", "cursor", "claude_code", "opencode"], "Tool [all|codex|cursor|claude_code|opencode]: ");
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
  const value = await status();
  if (global.json) return printJson(value);
  heading("Tools Manager Status");
  note(`Root: ${value.root}`);
  note(`Skills: ${value.skillCount} (${value.skillsDir})`);
  note(`Skill presets: ${value.presetCount}`);
  note(`MCP servers: ${value.mcpCount}`);
  table(value.tools.map((tool) => ({ tool: tool.key, installed: tool.installed ? "yes" : "no", skills: tool.skillsDir, mcp: tool.mcpPath })), { title: "Tools" });
}

async function cmdAgents(argv: string[], global: GlobalOptions): Promise<void> {
  const sub = argv.shift();
  switch (sub) {
    case "list": {
      const tool = takeOption(argv, "--tool") || "all";
      assertUsage(argv.length === 0, "Usage: tm agents list [--tool <tool|all>] [--json]");
      const result = await listAgentOverview(tool);
      if (global.json) return printJson(result);
      printAgentOverview(result);
      break;
    }
    default:
      throw new UsageError("Usage: tm agents <list>");
  }
}

function printAgentOverview(result: Awaited<ReturnType<typeof listAgentOverview>>): void {
  const rows = result.flatMap((agent) => {
    const skillRows = agent.skills.map((skill) => ({
      tool: agent.tool,
      type: "skill",
      name: skill.name,
      detail: skill.description || "",
      path: skill.path,
    }));
    const mcpRows = agent.mcpServers.map((server) => ({
      tool: agent.tool,
      type: "mcp",
      name: server.name,
      detail: [server.command, ...server.args].join(" "),
      path: agent.mcpPath,
    }));
    if (skillRows.length === 0 && mcpRows.length === 0) {
      return [{ tool: agent.tool, type: "", name: "", detail: "No skills or MCP servers found.", path: `${agent.skillsPath} | ${agent.mcpPath}` }];
    }
    return [...skillRows, ...mcpRows];
  });
  table(rows, { title: "Agent Contents", empty: "No agents found." });
}

async function cmdSkills(argv: string[], global: GlobalOptions): Promise<void> {
  const sub = argv.shift();
  switch (sub) {
    case "add": {
      const tool = takeOption(argv, "--tool");
      if (tool) {
        assertUsage(argv.length === 0, "Usage: tm skills add --tool <tool|all>");
        const result = await addLocalAgentSkills(tool);
        if (global.json) return printJson(result);
        printToolSkillImportResult(result);
        break;
      }
      if (takeFlag(argv, "--all")) {
        assertUsage(argv.length === 0, "Usage: tm skills add --all");
        const result = await addAllLocalAgentSkills();
        if (global.json) return printJson(result);
        printToolSkillImportResult(result);
        break;
      }
      if (takeFlag(argv, "--codex")) {
        assertUsage(argv.length === 0, "Usage: tm skills add --codex");
        const skills = await addCodexSkills();
        if (global.json) return printJson(skills);
        printSkills(skills, "Imported Skills");
        break;
      }
      const source = argv.shift();
      assertUsage(source, "Usage: tm skills add <source>");
      const skills = await addSkills(source);
      if (global.json) return printJson(skills);
      if (skills.length === 1) success(`Added skill ${skills[0]!.name}`);
      else printSkills(skills, `Imported Skills (${skills.length})`);
      break;
    }
    case "list": {
      const tool = takeOption(argv, "--tool");
      assertUsage(argv.length === 0, "Usage: tm skills list [--tool <tool|all>] [--json]");
      if (tool) {
        const result = await listAgentSkills(tool);
        if (global.json) return printJson(result);
        printAgentSkills(result);
        break;
      }
      const skills = await listSkills();
      if (global.json) return printJson(skills);
      printSkills(skills, `Skills (${skills.length})`);
      break;
    }
    case "show": {
      const name = argv.shift();
      assertUsage(name, "Usage: tm skills show <name>");
      const skill = await getSkill(name);
      assertUsage(skill, `Skill not found: ${name}`);
      const markdown = await skillMarkdownSummary(skill);
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
      const skill = await getSkill(name);
      assertUsage(skill, `Skill not found: ${name}`);
      const agentLinks = await findSkillAgentLinks(skill);
      if (global.json) {
        const result = await removeSkill(name, { removeAgentLinks: true });
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
      const result = await removeSkill(name, { removeAgentLinks: true });
      success(`Removed skill ${result.skill.name}`);
      if (result.agentLinks.length > 0) success(`Removed ${result.agentLinks.length} agent symlink(s).`);
      break;
    }
    case "sync": {
      const preset = argv[0]?.startsWith("--") ? "Default" : (argv.shift() || "Default");
      const tool = takeOption(argv, "--tool") || "all";
      const mode = takeSyncMode(argv);
      assertUsage(argv.length === 0, "Usage: tm skills sync [preset] [--tool <tool|all>] [--mode <symlink|copy>]");
      const result = await applyPreset(preset, tool, mode);
      if (global.json) return printJson(result);
      table(result.map((row) => ({ tool: row.tool, skill: row.skill, mode: row.mode, target: row.target })), { title: `Synced ${result.length} Skills` });
      break;
    }
    default:
      throw new UsageError("Usage: tm skills <add|list|show|remove|sync>");
  }
}

function printToolSkillImportResult(result: Awaited<ReturnType<typeof addLocalAgentSkills>>): void {
  const rows = result.flatMap((tool) => tool.skills.map((skill) => ({ tool: tool.tool, name: skill.name, source: skill.source_type, description: skill.description || "" })));
  table(rows, { title: `Imported Skills (${rows.length})`, empty: "No skills imported." });
}

function printSkills(skills: Array<{ name: string; source_type: string; description: string | null }>, title: string): void {
  table(skills.map((skill) => ({ name: skill.name, source: skill.source_type, description: skill.description || "" })), { title, empty: "No skills found." });
}

function printAgentSkills(result: Awaited<ReturnType<typeof listAgentSkills>>): void {
  const rows = result.flatMap((item) => item.skills.map((skill) => ({ tool: item.tool, name: skill.name, description: skill.description || "", path: skill.path })));
  table(rows, { title: `Agent Skills (${rows.length})`, empty: "No agent skills found." });
}

async function cmdPresets(argv: string[], global: GlobalOptions): Promise<void> {
  const sub = argv.shift();
  switch (sub) {
    case "list": {
      const presets = await listPresets();
      if (global.json) return printJson(presets);
      table(presets.map((preset) => ({ name: preset.name, skills: preset.skill_count })), { title: `Skill Presets (${presets.length})` });
      break;
    }
    case "apply": {
      const preset = argv[0]?.startsWith("--") ? "Default" : (argv.shift() || "Default");
      const tool = takeOption(argv, "--tool") || "all";
      const mode = takeSyncMode(argv);
      assertUsage(argv.length === 0, "Usage: tm presets apply [preset] [--tool <tool|all>] [--mode <symlink|copy>]");
      const result = await applyPreset(preset, tool, mode);
      if (global.json) return printJson(result);
      table(result.map((row) => ({ tool: row.tool, skill: row.skill, mode: row.mode, target: row.target })), { title: `Applied ${result.length} Skills` });
      break;
    }
    case "move":
    case "mv": {
      const from = argv.shift();
      const to = argv.shift();
      assertUsage(from && to, "Usage: tm presets move <from> <to>");
      const result = await movePreset(from, to);
      if (global.json) return printJson(result);
      success(`Moved ${result.skillCount} skills from ${result.from} to ${result.to}.`);
      break;
    }
    case "move-skill": {
      const skill = argv.shift();
      const from = argv.shift();
      const to = argv.shift();
      assertUsage(skill && from && to, "Usage: tm presets move-skill <skill> <from> <to>");
      const result = await moveSkillPreset(skill, from, to);
      if (global.json) return printJson(result);
      success(`Moved ${result.skill} from ${result.from} to ${result.to}.`);
      break;
    }
    default:
      throw new UsageError("Usage: tm presets <list|apply|move|move-skill>");
  }
}

async function cmdMcp(argv: string[], global: GlobalOptions): Promise<void> {
  const sub = argv.shift();
  switch (sub) {
    case "add": {
      const importTool = takeOption(argv, "--tool");
      if (importTool && argv.length === 0) {
        const result = await importMcpFromTools(importTool);
        if (global.json) return printJson(result);
        table(result.map((row) => ({ tool: row.tool, servers: row.count, path: row.path, names: row.servers.join(",") })), { title: "Imported MCP Servers" });
        break;
      }
      const name = argv.shift();
      assertUsage(name, "Usage: tm mcp add <name> --command <cmd> [--arg value] [--env K=V] [--tool <tool|all>]");
      const command = takeOption(argv, "--command");
      assertUsage(command, "Missing required --command.");
      const args = takeRepeatedOption(argv, "--arg");
      const env = Object.assign({}, ...takeRepeatedOption(argv, "--env").map(parseKeyValue));
      const targetTools = importTool ? [importTool, ...takeRepeatedOption(argv, "--tool")] : takeRepeatedOption(argv, "--tool");
      await addMcpServer({ name, command, args, env, targetTools: targetTools.length ? targetTools : ["all"], enabled: true });
      success(`Added MCP server ${name}`);
      break;
    }
    case "list": {
      const tool = takeOption(argv, "--tool");
      assertUsage(argv.length === 0, "Usage: tm mcp list [--tool <tool|all>] [--json]");
      if (tool) {
        const result = await listToolMcpServers(tool);
        if (global.json) return printJson(result);
        printToolMcpServers(result);
        break;
      }
      const servers = await listMcpServers();
      if (global.json) return printJson(servers);
      table(servers.map((server) => ({ name: server.name, command: server.command, tools: server.targetTools.join(","), enabled: server.enabled ? "yes" : "no" })), { title: `MCP Servers (${servers.length})` });
      break;
    }
    case "show": {
      const name = argv.shift();
      assertUsage(name, "Usage: tm mcp show <name>");
      const server = await getMcpServer(name);
      assertUsage(server, `MCP server not found: ${name}`);
      if (global.json) return printJson(server);
      heading(server.name);
      note(`Command: ${server.command}`);
      note(`Args: ${server.args.join(" ")}`);
      note(`Tools: ${server.targetTools.join(",")}`);
      note(`Enabled: ${server.enabled ? "yes" : "no"}`);
      if (Object.keys(server.env).length > 0) {
        note("Env:");
        for (const [key, value] of Object.entries(server.env)) note(`  ${key}=${value}`);
      }
      break;
    }
    case "sync": {
      const tool = takeOption(argv, "--tool") || "all";
      const result = await syncMcp(tool);
      if (global.json) return printJson(result);
      table(result.map((row) => ({ tool: row.tool, servers: row.count, path: row.path, backup: row.backup || "" })), { title: "MCP Sync" });
      break;
    }
    case "remove":
    case "rm": {
      const name = argv.shift();
      assertUsage(name, "Usage: tm mcp remove <name>");
      const server = await removeMcpServer(name);
      if (global.json) return printJson(server);
      success(`Removed MCP server ${server.name}`);
      break;
    }
    default:
      throw new UsageError("Usage: tm mcp <add|list|show|sync|remove>");
  }
}

function printToolMcpServers(result: Awaited<ReturnType<typeof listToolMcpServers>>): void {
  const rows = result.flatMap((item) => item.servers.map((server) => ({ tool: item.tool, name: server.name, command: [server.command, ...server.args].join(" "), env: Object.keys(server.env).length, path: item.path })));
  table(rows, { title: `Agent MCP Servers (${rows.length})`, empty: "No agent MCP servers found." });
}

async function cmdBackup(global: GlobalOptions): Promise<void> {
  const result = await backup();
  if (global.json) return printJson(result);
  success(result.message);
  if (result.pushed) success("Pushed to origin.");
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
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  const render = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write(`${ansi.dim("╭──────────────────────────────────────────────────────────────────────────────╮")}\n`);
    process.stdout.write(`${ansi.dim("│")} ${ansi.signal(title.padEnd(76))} ${ansi.dim("│")}\n`);
    process.stdout.write(`${ansi.dim("│")} ${ansi.muted("One local control plane for skills, presets, and MCP servers.".padEnd(76))} ${ansi.dim("│")}\n`);
    process.stdout.write(`${ansi.dim("╰──────────────────────────────────────────────────────────────────────────────╯")}\n\n`);
    process.stdout.write(`${ansi.muted("↑/↓ choose")}  ${ansi.muted("Enter run")}  ${ansi.muted("Esc/q quit")}\n\n`);
    let group = "";
    commands.forEach((command, index) => {
      const active = index === selected;
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
      if (chunk === "\u0003" || chunk === "\u001b" || chunk.toLowerCase() === "q") {
        cleanup();
        resolve(null);
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        const command = commands[selected] || null;
        cleanup();
        resolve(command);
        return;
      }
      if (chunk === "\u001b[A") {
        selected = (selected - 1 + commands.length) % commands.length;
        render();
      } else if (chunk === "\u001b[B") {
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
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  const render = () => {
    process.stdout.write("\x1b[2J\x1b[H");
    process.stdout.write(`${ansi.signal(title)}\n`);
    process.stdout.write(`${ansi.muted("↑/↓ choose")}  ${ansi.muted("Enter select")}  ${ansi.muted("Esc return")}\n\n`);
    choices.forEach((value, index) => {
      const active = index === selected;
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
      if (chunk === "\u0003" || chunk === "\u001b") {
        cleanup();
        resolve(null);
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        const value = choices[selected] || null;
        cleanup();
        resolve(value === customLabel ? "__custom__" : value);
        return;
      }
      if (chunk === "\u001b[A") {
        selected = (selected - 1 + choices.length) % choices.length;
        render();
      } else if (chunk === "\u001b[B") {
        selected = (selected + 1) % choices.length;
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

async function mcpNameOptions(): Promise<string[]> {
  try {
    return (await listMcpServers()).map((server) => server.name);
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
  tm status [--json]
  tm agents list [--tool <tool|all>] [--json]
  tm skills add <source>
  tm skills add --tool <tool|all>
  tm skills add --codex
  tm skills add --all
  tm skills list [--json]
  tm skills list --tool <tool|all> [--json]
  tm skills show <name> [--json]
  tm skills remove <name>
  tm skills sync [preset] [--tool <tool|all>] [--mode <symlink|copy>]
  tm presets list [--json]
  tm presets apply [preset] [--tool <tool|all>] [--mode <symlink|copy>]
  tm presets move-skill <skill> <from> <to>
  tm presets move <from> <to>
  tm mcp add <name> --command <cmd> [--arg value] [--env K=V] [--tool <tool|all>]
  tm mcp add --tool <tool|all>
  tm mcp list [--json]
  tm mcp list --tool <tool|all> [--json]
  tm mcp show <name> [--json]
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
