---
name: tools-manager
description: Manage AI agent skills, skill presets, and MCP server configuration using the tm CLI from the tools-manager package. Use when users ask how to initialize tm, import local agent skills, add skills from local/Git sources, list/show/remove/sync skills, move skills between presets, choose symlink versus copy sync mode, import/list/add/remove/sync MCP servers, inspect agent-side contents, back up managed skills, build/publish the package, or troubleshoot tm command behavior.
---

# Tools Manager

Use this skill when working with the `tm` CLI or the `tools-manager` repository.

## Command Model

- `tm` stores managed skills, presets, MCP server records, and config under `~/.tools-manager` unless `TOOLS_MANAGER_HOME` is set.
- Managed skills live in `~/.tools-manager/skills`.
- Agent-side skill directories are:
  - Codex: `~/.codex/skills`
  - Claude Code: `~/.claude/skills`
  - Cursor: `~/.cursor/skills`
- `Default` is created automatically and imported skills are added to it.
- `sync_mode` defaults to `symlink`; command flags can override it per run.

## Common Workflows

Initialize and inspect:

```bash
tm init
tm status
tm agents list --tool all
```

Import skills into tm:

```bash
tm skills add ./path/to/skill
tm skills add 'git@example.com:group/repo.git#main:path/to/skill'
tm skills add --tool codex
tm skills add --tool all
```

Manage skills:

```bash
tm skills list
tm skills show <skill>
tm skills remove <skill>
```

Apply presets to agents:

```bash
tm skills sync
tm skills sync Work --tool cursor --mode copy
tm presets apply Default --tool all --mode symlink
```

Move preset membership:

```bash
tm presets move-skill <skill> Default Work
tm presets move Default Work
```

Use `move-skill` for one skill. Use `move` only when moving all skills from one preset to another.

Manage MCP records:

```bash
tm mcp add playwright --command npx --arg @playwright/mcp@latest --tool codex
tm mcp add --tool all
tm mcp list
tm mcp list --tool codex
tm mcp remove playwright
tm mcp sync --tool all
```

## Sync Modes

Use `--mode symlink` to create agent-side symlinks to managed skills.

Use `--mode copy` to copy managed skill files into agent directories.

Examples:

```bash
tm skills sync --mode symlink
tm skills sync --mode copy
tm presets apply Work --tool codex --mode copy
```

If `TOOLS_MANAGER_HOME` points inside the system temporary directory, do not symlink into real agent directories. Use a non-temporary manager home or `--mode copy`.

## Build And Publish

Build the distributable CLI:

```bash
bun run build
ls -la dist
```

Preview package contents:

```bash
bun run release:dry
```

Publish:

```bash
bun run release
bun run release:patch
bun run release:minor
bun run release:major
```

Use `release:patch`, `release:minor`, or `release:major` when the npm version must be bumped before publishing.
