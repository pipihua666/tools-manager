# Tools Manager

[English](README.md)

GitHub: [pipihua666/tools-manager](https://github.com/pipihua666/tools-manager)

Tools Manager (`tm`) 是一个基于 Bun 的 CLI，用来统一管理 Codex、Claude Code 和 Cursor 等 AI Agent 的 skills 与 MCP server 配置。

它提供一个本地统一管理入口：

- Skills 存放在 `~/.tools-manager/skills`
- Skill presets 用来按 Agent 或工作流给 skills 分组
- MCP servers 存储在 Tools Manager 数据库中，并可同步到各 Agent 的配置文件

不想记子命令时，直接运行无参数的 `tm`，打开交互式命令菜单：

![Tools Manager interactive menu](docs/images/menu.svg)

下面这张图展示 skills 和 MCP servers 如何在本地 Agent 与 Tools Manager 存储之间流转：

![Tools Manager workflow](docs/images/workflow.svg)

## 环境要求

- Bun `>= 1.3.0`
- Git，用于从 Git URL 导入 skills，以及执行 `tm backup`

## 安装

全局安装：

```bash
npm install -g tools-manager
```

验证 CLI：

```bash
tm status
```

如果是源码检出方式使用，见 [开发](#开发)。

## 快速开始

先把所有本地 Agent 里已有的 skills 导入 Tools Manager，再同步回所有支持的 Agent：

```bash
# 创建 Tools Manager 的本地管理目录和默认配置。
tm init

# 从 Codex、Claude Code、Cursor 导入已有 skills。
tm skills add --tool all

# 查看当前由 Tools Manager 托管的 skills。
tm skills list

# 把默认 skill 分组同步回所有支持的 Agent。
tm skills sync
```

如果还没有 link 或安装这个包，可以使用：

```bash
bun run tm init
bun run tm skills add --tool all
bun run tm skills list
bun run tm skills sync
```

默认情况下，Tools Manager 会把状态写入：

```text
~/.tools-manager
```

设置 `TOOLS_MANAGER_HOME` 可以使用自定义管理目录。

运行无参数 `tm` 可以打开交互式命令菜单：

```bash
tm
```

菜单支持用方向键选择常用的 skill、skill preset、MCP、agent 和 backup 命令。菜单包含手动添加 skill source、手动添加 MCP server、从已有 Agent 导入的流程。涉及 tool 参数时会进入选项选择器，默认选择 `all`。命令执行后，按 `Enter` 或 `Esc` 返回菜单。

## Skills

添加本地 skill 目录：

```bash
tm skills add ./my-skill
```

从某一个本地 Agent 导入已有 skills：

```bash
tm skills add --tool codex
tm skills add --tool cursor
tm skills add --tool claude_code
```

从所有支持的本地 Agent 导入已有 skills：

```bash
tm skills add --tool all
```

从 Agent 导入时，Tools Manager 会把 skills 复制到 `~/.tools-manager/skills`，然后用指向托管副本的 symlink 替换原本的本地 Agent skill 目录。

从 Git 导入 skill：

```bash
tm skills add 'git@gitlab.company.com:group/repo.git#main:path/to/skill'
```

如果 source 中包含多个 skill 目录，会导入所有发现的 skills。已有同名 skill 会被更新。

仓库目录结构要求见 [Remote Skill Repositories](docs/remote-skill-repositories.md)。

列出托管的 skills：

```bash
tm skills list
```

列出当前本地 Agent 可见的 skills：

```bash
tm skills list --tool codex
tm skills list --tool all
```

查看某个托管 skill：

```bash
tm skills show my-skill
```

移除某个托管 skill：

```bash
tm skills remove my-skill
```

如果 Agent 的 skill 目录中存在指向托管 skill source 的 symlink，Tools Manager 会展示这些 symlink，并在删除托管 source 和 Agent symlink 前要求确认。非交互场景可使用 `--yes`：

```bash
tm skills remove my-skill --yes
```

同步 skills 到 Agent skill 目录：

```bash
tm skills sync
tm skills sync Work --tool cursor
tm skills sync --mode copy
tm skills sync Work --tool codex --mode symlink
```

`tm skills sync` 是让 Agent 工具看到托管 skills 的主命令。

默认行为：

- `tm skills sync` 同步 `Default` preset
- `tm skills sync` 同步到 `--tool all`，也就是 Codex、Claude Code 和 Cursor
- `tm skills sync` 使用配置里的 `sync_mode`；传入 `--mode symlink` 或 `--mode copy` 可以覆盖本次执行

简单理解：添加或移动 skills 后，执行 `tm skills sync`。

## Skill Presets

Skill presets 是命名的 skill 分组，用来决定哪些 skills 要一起同步。

例如，日常使用的 skills 可以放在 `Default`，工作专用的 skills 可以放在 `Work`。导入的 skills 会自动加入 `Default`。

列出 skill presets：

```bash
tm presets list
```

把单个 skill 从一个 preset 移动到另一个 preset：

```bash
tm presets move-skill my-skill Default Work
```

把一个 preset 里的所有 skills 移动到另一个 preset：

```bash
tm presets move Default Work
```

调整 preset 分组后，使用 `tm skills sync` 更新 Agent skill 目录。

## MCP Servers

添加 MCP server 到 Tools Manager：

```bash
tm mcp add playwright --command npx --arg @playwright/mcp@latest --tool codex
```

从 Agent 配置文件导入已有 MCP servers：

```bash
tm mcp add --tool codex
tm mcp add --tool all
```

列出托管的 MCP servers：

```bash
tm mcp list
```

列出当前本地 Agent 配置中的 MCP servers：

```bash
tm mcp list --tool codex
tm mcp list --tool all
```

查看某个托管 MCP server：

```bash
tm mcp show playwright
```

移除某个托管 MCP server：

```bash
tm mcp remove playwright
```

把托管 MCP servers 同步回 Agent 配置文件：

```bash
tm mcp sync
tm mcp sync --tool codex
```

默认行为：

- `tm mcp sync` 使用 `--tool all`
- 同步写入配置文件前会创建带时间戳的备份

支持的配置目标：

```text
codex       -> ~/.codex/config.toml
claude_code -> ~/.claude/mcp.json
cursor      -> ~/.cursor/mcp.json
```

## Backup

用 Git 备份托管 skills：

```bash
tm backup
```

如果需要，`tm backup` 会在 `~/.tools-manager/skills` 中初始化 Git 仓库，提交 skill 变更；当 `~/.tools-manager/config.toml` 中配置了 `git_remote` 时，还会执行 push。

## 命令参考

```bash
tm init
tm status [--json]
tm agents list [--tool <tool|all>] [--json]
tm skills add <source>
tm skills add --tool <tool|all>
tm skills list [--json]
tm skills list --tool <tool|all> [--json]
tm skills show <name> [--json]
tm skills remove <name> [--yes]
tm skills sync [preset] [--tool <tool|all>] [--mode <symlink|copy>]
tm presets list [--json]
tm presets move-skill <skill> <from> <to>
tm presets move <from> <to>
tm mcp add <name> --command <cmd> [--arg value] [--env K=V] [--tool <tool|all>]
tm mcp add --tool <tool|all>
tm mcp list [--json]
tm mcp list --tool <tool|all> [--json]
tm mcp show <name> [--json]
tm mcp remove <name>
tm mcp sync [--tool <tool|all>]
tm backup
```

支持的 tools：

```text
codex
claude_code
cursor
all
```

## 开发

安装依赖并运行检查：

```bash
bun install
bun run check
```

本仓库通过 `.npmrc` 和 `bunfig.toml` 将 npm 与 Bun 安装固定到 npmmirror registry。

通过 package script 运行 CLI：

```bash
bun run tm status
bun run tm skills list
```

构建发布用的 CLI bundle：

```bash
bun run build
ls -la dist
```

按用户实际使用方式测试 `tm` 二进制：

```bash
npm link
tm status
tm skills list
npm unlink -g tools-manager
```

## 发布

发布前：

```bash
bun run release:dry
```

检查 dry-run 输出。它应该只包含：

- `package.json`
- `README.md`
- `README.zh-CN.md`
- `dist/**`
- `docs/**`

发布：

```bash
bun run release
```

发布并自动升级版本：

```bash
bun run release:patch
bun run release:minor
bun run release:major
```

发布后，在干净 shell 中测试安装：

```bash
npm install -g tools-manager
tm --help
tm status
```

## 备注

- `tm skills add` 支持本地文件夹、GitHub URL、内部 GitLab URL、SSH Git URL，以及 `#ref:path/to/skill`。
- Git 认证交给本地 Git 配置处理：SSH keys、VPN、credential helpers 和 tokens。启用 2FA 的私有 HTTPS 仓库需要 personal access token，或改用 SSH Git URL。
- `tm skills add --codex` 和 `tm skills add --all` 会作为兼容别名保留。
- `tm skills remove` 会删除托管 skill 文件、移除 preset membership，并在确认后移除指向托管 source 的 Agent symlinks。
- `tm mcp remove` 只会从 Tools Manager 删除 server；运行 `tm mcp sync` 后才会更新 Agent 配置文件。
- `--json` 可用于 list/status 类命令，方便脚本调用。
