# Remote Skill Repositories

Remote skill repositories are Git repositories that contain one or more skill directories. Each skill directory must include a `SKILL.md` or `skill.md` file.

## Single Skill Repository

Use this layout when the repository only contains one skill:

```text
my-skill-repo/
  SKILL.md
  scripts/
  references/
```

Import it with:

```bash
tm skills add 'git@github.com:you/my-skill-repo.git'
```

## Multiple Skills Repository

Use this layout when one repository contains multiple skills:

```text
my-skills-repo/
  skill-a/
    SKILL.md
  skill-b/
    SKILL.md
  skill-c/
    SKILL.md
```

Import all skills under the shared directory:

```bash
tm skills add 'git@github.com:you/my-skills-repo.git#main:skills'
```

Or import a specific skill by providing the branch, tag, or commit and the skill subpath:

```bash
tm skills add 'git@github.com:you/my-skills-repo.git#main:skill-a'
```

The Git source format is:

```text
<git-url>#<branch-or-tag-or-commit>:<skill-subpath>
```

Examples:

```bash
tm skills add 'git@gitlab.company.com:group/skills.git#main:cb-yapi-content'
tm skills add 'https://github.com/you/skills.git#v1.0.0:frontend-skill'
```

## Private Repositories

Tools Manager shells out to your local `git clone`. It does not prompt for, store, or refresh Git credentials.

Before importing a private repository, make sure this works in your terminal:

```bash
git clone <repo-url>
```

For HTTPS GitLab repositories, use a personal access token instead of your password when the account has 2FA enabled. For SSH repositories, use the SSH form after your key is configured:

```bash
tm skills add 'git@gitlab.company.com:group/skills.git#main:skills'
```

## Skill Metadata

`SKILL.md` should include frontmatter with a name and description:

```md
---
name: My Skill
description: What this skill does
---

# My Skill

Instructions...
```

The imported skill name is generated from the `name` field. If `name` is missing, Tools Manager uses the skill directory name.

## Notes

- If a source contains multiple skill directories, all discovered skills are imported.
- Existing skills with the same name are updated.
- Git authentication is delegated to your local Git setup, including SSH keys, VPN, credential helpers, and tokens.
- Files next to `SKILL.md`, such as `scripts/`, `references/`, and `assets/`, are copied into the managed skill directory.
