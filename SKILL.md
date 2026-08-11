---
name: tools-manager
description: Manage AI agent skills and MCP server configuration using the tm CLI or local web dashboard from the tools-manager package. Use when users ask how to initialize tm, launch tm web, import local agent skills, add skills from local/Git sources, list/show/remove/sync selected skills, choose symlink versus copy sync mode, import/list/add/remove/sync selected MCP servers, inspect agent-side contents, back up managed skills, build/publish the package, or troubleshoot tm command behavior.
---

# Tools Manager

Use this skill when working with the `tm` CLI or the `tools-manager` repository.

## Command Model

- `tm` stores managed skills, MCP server records, and config under `~/.tools-manager` unless `TOOLS_MANAGER_HOME` is set.
- Managed skills live in `~/.tools-manager/skills`.
- Agent-side skill directories are:
  - Codex: `~/.codex/skills`
  - Claude Code: `~/.claude/skills`
  - Cursor: `~/.cursor/skills`
  - OpenCode: `~/.config/opencode/skills`
- `sync_mode` defaults to `symlink`; command flags can override it per run.

## Common Workflows

Initialize and inspect:

```bash
tm init
tm status
tm agents list --tool all
```

Start the local web dashboard:

```bash
tm web
tm web --port 4400
tm web --no-open
```

The dashboard binds to `127.0.0.1` and provides browser-based management for skills, MCP, Agent sync, and backup operations. Agent filters include the complete installed inventory; unmanaged names open read-only details without mutation actions. Searches run when submitted by button or Enter. Agent Readiness shows synced and installed counts. Clicking a managed skill or MCP name opens its full editable content.

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
tm skills unlink <skill> --tool codex
tm skills sync-selected <skill-a> <skill-b> --tool codex --mode symlink
```

Manage MCP records:

```bash
tm mcp add playwright --command npx --arg @playwright/mcp@latest --tool codex
tm mcp add remote-api --url https://example.com/mcp --header "Authorization=Bearer $MCP_TOKEN" --tool all
tm mcp add --tool all
tm mcp list
tm mcp list --tool codex
tm mcp remove playwright
tm mcp sync-selected playwright filesystem --tool codex
tm mcp sync --tool all
```

## Sync Modes

Use `--mode symlink` to create agent-side symlinks to managed skills.

Use `--mode copy` to copy managed skill files into agent directories.

Examples:

```bash
tm skills sync-selected skill-a skill-b --tool all --mode symlink
tm skills sync-selected skill-a --tool cursor --mode copy
```

If `TOOLS_MANAGER_HOME` points inside the system temporary directory, do not symlink into real agent directories. Use a non-temporary manager home or `--mode copy`.

## Skill Edit Follow-up

After creating or editing a skill outside the managed skills directory, check whether that skill already exists in the tools-manager store.

- If the skill is not in the store, ask the user whether to add it. Do not import it without confirmation.
- If the skill is already in the store, treat the earlier successful sync as standing authorization. Update it automatically without asking again.

Add or update the stored copy with:

```bash
tm skills add <path-to-skill-directory>
```

Do not run the command when the edited skill is already inside the managed skills directory, including when it was reached through an Agent symlink that points there, because the store is already current.

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
