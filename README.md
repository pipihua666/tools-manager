# Tools Manager

[中文文档](README.zh-CN.md)

Tools Manager (`tm`) is a Bun-powered CLI for managing AI agent skills and MCP server configuration across Codex, Claude Code, Cursor, and OpenCode.

It gives you one local source of truth for:

- Skills stored under `~/.tools-manager/skills`
- Skill presets that group skills for different agents or workflows
- MCP servers stored in the Tools Manager database and synced into agent config files

Open `tm` with no arguments when you want a guided command picker instead of remembering every subcommand:

![Tools Manager interactive menu](docs/images/menu.svg)

The diagram below shows how skills and MCP servers move between local agents and the Tools Manager store:

![Tools Manager workflow](docs/images/workflow.svg)

## Requirements

- Bun `>= 1.3.0`
- Git, for importing skills from Git URLs and running `tm backup`

## Installation

Install globally:

```bash
npm install -g tools-manager
```

Verify the CLI:

```bash
tm status
```

For source checkout usage, see [Development](#development).


## Quick Start

Import all existing local agent skills into Tools Manager, then sync them back to all supported agents:

```bash
# Create the Tools Manager home directory and default config.
tm init

# Import existing skills from Codex, Claude Code, Cursor, and OpenCode.
tm skills add --tool all

# Show the skills now managed by Tools Manager.
tm skills list

# Apply the default skill preset to all supported agents.
tm presets apply Default
```

If you have not linked or installed the package yet, use:

```bash
bun run tm init
bun run tm skills add --tool all
bun run tm skills list
bun run tm presets apply Default
```

By default, Tools Manager writes state to:

```text
~/.tools-manager
```

Set `TOOLS_MANAGER_HOME` to use a custom manager root.

Run `tm` with no arguments to open an interactive command menu:

```bash
tm
```

The menu lets you choose common skill, skill preset, MCP, agent, and backup commands with arrow keys. It includes manual add flows for skill sources and MCP servers, plus import flows from existing agents. Tool parameters use an option picker with `all` selected by default. After a command runs, press `Enter` or `Esc` to return to the menu.

## Web Dashboard

Start the local management dashboard and open it in your browser:

```bash
tm web
```

The dashboard manages skills, presets, MCP servers, Agent imports and sync operations, and Git backups through the same core APIs as the CLI. The `All` skill and MCP views support per-row sync, multi-select, and select-all sync. Agent-filtered skill removal only removes that Agent's managed symlink.

Click a skill name to inspect its source metadata and edit the complete `SKILL.md`. Click an MCP server name to edit its name, transport, command or URL, arguments, environment, HTTP headers, target tools, and enabled state. MCP environment and header values are available only through the local detail endpoint and are omitted from the dashboard snapshot.

The server binds to `127.0.0.1` only. It uses port `4343` by default and tries the next available local port when needed. To select a port or avoid opening a browser automatically:

```bash
tm web --port 4400
tm web --no-open
```

Keep the terminal process running while using the dashboard. Press `Ctrl+C` to stop it.

For local source development, start the watched server:

```bash
bun run dev
```

Open `http://127.0.0.1:4343` once. Bun restarts the server when imported source files change, and the open dashboard reloads itself after the new server is ready. Use a temporary manager root when you want isolated test data:

```bash
TOOLS_MANAGER_HOME=/tmp/tools-manager-dev bun run dev
```

## Skills

Add a local skill directory:

```bash
tm skills add ./my-skill
```

Add existing skills from one local agent:

```bash
tm skills add --tool codex
tm skills add --tool cursor
tm skills add --tool claude_code
tm skills add --tool opencode
```

Import existing skills from all supported local agents:

```bash
tm skills add --tool all
```

Agent imports copy skills into `~/.tools-manager/skills`, then replace the original local agent skill directories with symlinks to the managed copies.

Import a skill from Git:

```bash
tm skills add 'git@gitlab.company.com:group/repo.git#main:path/to/skill'
```

If the source contains multiple skill directories, all discovered skills are imported. Existing skills with the same name are updated.

See [Remote Skill Repositories](docs/remote-skill-repositories.md) for the expected repository layout.

List managed skills:

```bash
tm skills list
```

List skills currently visible to local agents:

```bash
tm skills list --tool codex
tm skills list --tool all
```

Show one managed skill:

```bash
tm skills show my-skill
```

Remove a managed skill:

```bash
tm skills remove my-skill
```

If agent skill directories contain symlinks to the managed skill source, Tools Manager shows them and asks for confirmation before deleting both the managed source and those agent symlinks. Use `--yes` for non-interactive removal:

```bash
tm skills remove my-skill --yes
```

Remove only one Agent's managed symlink while keeping the tm source, preset membership, and other Agent links:

```bash
tm skills unlink my-skill --tool codex
```

Sync one or more selected skills to agent skill directories:

```bash
tm skills sync-selected my-skill --tool cursor
tm skills sync-selected skill-a skill-b --tool all --mode copy
```

Use presets when a maintained group of skills should be applied together:

```bash
tm presets apply Default
tm presets apply Work --tool codex --mode symlink
```

Both commands use `--tool all` by default and honor the configured `sync_mode`. Pass `--mode symlink` or `--mode copy` to override it for one run. `tm skills sync [preset]` remains available as a compatibility alias for applying a preset.

The interactive `tm` menu provides a checkbox-style multi-select flow for selected skill sync.

## Skill Presets

Skill presets are named groups of skills. They help you decide which skills should be synced together.

For example, you can keep everyday skills in `Default`, and work-only skills in `Work`. Imported skills are added to `Default` automatically.

List skill presets:

```bash
tm presets list
```

Apply a preset to agents:

```bash
tm presets apply Default
tm presets apply Work --tool cursor --mode copy
```

Move one skill from one preset to another:

```bash
tm presets move-skill my-skill Default Work
```

Remove one skill from a preset without deleting the managed skill or Agent links:

```bash
tm presets remove-skill my-skill Work
```

Move all skills from one skill preset to another:

```bash
tm presets move Default Work
```

After changing preset membership, use `tm presets apply` to write the current group to Agent skill directories.

## MCP Servers

Add an MCP server to Tools Manager:

```bash
tm mcp add playwright --command npx --arg @playwright/mcp@latest --tool codex
tm mcp add remote-api --url https://example.com/mcp --header "Authorization=Bearer $MCP_TOKEN" --tool all
```

MCP servers use either the local `stdio` transport (`--command`, `--arg`, `--env`) or remote Streamable HTTP (`--url`, `--header`). `--command` and `--url` are mutually exclusive. Repeat `--header` for multiple HTTP headers.

Add existing MCP servers from agent config files:

```bash
tm mcp add --tool codex
tm mcp add --tool all
```

List managed MCP servers:

```bash
tm mcp list
```

List MCP servers currently configured in local agent config files:

```bash
tm mcp list --tool codex
tm mcp list --tool all
```

Show one managed MCP server:

```bash
tm mcp show playwright
```

Remove a managed MCP server:

```bash
tm mcp remove playwright
```

Sync managed MCP servers back to agent config files:

```bash
tm mcp sync
tm mcp sync --tool codex
```

Sync only selected MCP servers:

```bash
tm mcp sync-selected playwright --tool codex
tm mcp sync-selected server-a server-b --tool all
```

The interactive `tm` menu supports multi-select and select-all for this command.

Defaults:

- `tm mcp sync` uses `--tool all`
- Sync creates timestamped backups before writing config files

Supported config targets:

```text
codex       -> ~/.codex/config.toml
claude_code -> ~/.claude/mcp.json
cursor      -> ~/.cursor/mcp.json
opencode    -> ~/.config/opencode/opencode.json
```

## Backup

Back up managed skills with Git:

```bash
tm backup
```

`tm backup` initializes a Git repo in `~/.tools-manager/skills` if needed, commits skill changes, and pushes when `git_remote` is configured in `~/.tools-manager/config.toml`.

## Command Reference

```bash
tm init
tm web [--port <port>] [--no-open] [--dev]
tm status [--json]
tm agents list [--tool <tool|all>] [--json]
tm skills add <source>
tm skills add --tool <tool|all>
tm skills list [--json]
tm skills list --tool <tool|all> [--json]
tm skills show <name> [--json]
tm skills remove <name> [--yes]
tm skills unlink <name> --tool <codex|claude_code|cursor|opencode>
tm skills sync-selected <name...> [--tool <tool|all>] [--mode <symlink|copy>]
tm skills sync [preset] [--tool <tool|all>] [--mode <symlink|copy>]
tm presets list [--json]
tm presets apply [preset] [--tool <tool|all>] [--mode <symlink|copy>]
tm presets move-skill <skill> <from> <to>
tm presets remove-skill <skill> <preset>
tm presets move <from> <to>
tm mcp add <name> (--command <cmd> [--arg value] [--env K=V] | --url <url> [--header K=V]) [--tool <tool|all>]
tm mcp add --tool <tool|all>
tm mcp list [--json]
tm mcp list --tool <tool|all> [--json]
tm mcp show <name> [--json]
tm mcp remove <name>
tm mcp sync-selected <name...> [--tool <tool|all>]
tm mcp sync [--tool <tool|all>]
tm backup
```

Supported tools:

```text
codex
claude_code
cursor
opencode
all
```

## Development

Install dependencies and run checks:

```bash
bun install
bun run check
```

This repository pins npm and Bun installs to the npmmirror registry through `.npmrc` and `bunfig.toml`.

Run the CLI through the package script:

```bash
bun run tm status
bun run tm skills list
```

Build the publishable CLI bundle:

```bash
bun run build
ls -la dist
```

Keep the `package.json` `bin` mapping. It exposes `dist/cli.js` as the global `tm` command after npm installation; without it, the package would only be usable through package scripts or direct file execution.

Test the `tm` binary exactly as consumers will run it:

```bash
npm link
tm status
tm skills list
npm unlink -g tools-manager
```

## Publishing

Before publishing:

```bash
bun run release:dry
```

Review the dry-run output. It should include only:

- `package.json`
- `README.md`
- `README.zh-CN.md`
- `SKILL.md`
- `dist/**`
- `docs/**`

Publish:

```bash
bun run release
```

Publish with a version bump:

```bash
bun run release:patch
bun run release:minor
bun run release:major
```

After publishing, test install in a clean shell:

```bash
npm install -g tools-manager
tm --help
tm status
```

## Notes

- `tm skills add` supports local folders, GitHub URLs, internal GitLab URLs, SSH Git URLs, and `#ref:path/to/skill`.
- Git authentication is delegated to your local Git setup: SSH keys, VPN, credential helpers, and tokens. Private HTTPS repositories with 2FA need a personal access token, or use an SSH Git URL.
- `tm skills add --codex` and `tm skills add --all` are kept as compatibility aliases.
- `tm skills remove` deletes the managed skill files, removes preset membership, and removes agent symlinks that point to the managed source after confirmation.
- `tm mcp remove` deletes the server from Tools Manager; run `tm mcp sync` to update agent config files.
- `--json` is available on list/status-style commands for scripting.
