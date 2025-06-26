# dot-ai

**Generate AI provider configurations from a centralized `.ai/` folder**

A CLI tool that reads from a single `.ai/` directory and generates configuration files for multiple AI assistants and code editors, eliminating duplicate configs across Claude Code, Cursor, Gemini, and OpenCode.

![XKCD on standards](https://imgs.xkcd.com/comics/standards.png)

## The Problem

Modern development often involves multiple AI assistants and code editors, each requiring their own configuration files:

- **Claude Code** needs `CLAUDE.md`
- **Cursor** needs `.cursor/rules/*.mdc` files
- **Gemini** needs `GEMINI.md` and `.gemini/settings.json`
- **Codex** needs `AGENTS.md`
- **OpenCode** needs `opencode.json`
- **MCP servers** need `.mcp.json`

This leads to **scattered configs** and **duplicate content** across your project.

## The Solution

**dot-ai** provides a **single source of truth** in a `.ai/` folder that generates all provider-specific configurations:

```
.ai/ (single source)
├── instructions.md       # Main instructions
├── rules/               # Rules with YAML frontmatter
│   ├── general.md
│   ├── typescript.md
│   └── forms.md
├── commands/            # Available commands
│   ├── deploy.md
│   └── test.md
└── mcp.json            # MCP server configuration
```

↓ **Generates** ↓

```
CLAUDE.md                 # Claude Code instructions
GEMINI.md                 # Gemini instructions (identical to Claude)
AGENTS.md                 # Agents instructions (identical to Claude)
.mcp.json                 # MCP server config
.cursor/rules/*.mdc       # Cursor rules (preserves frontmatter)
.gemini/settings.json     # Gemini MCP settings
opencode.json            # OpenCode MCP config
```

### Before and After

![before and after](https://i.imgur.com/aVbTaAZ.png)

## Important Note: This is a Temporary Solution

**dot-ai is intended as a stop-gap solution.** The ultimate goal is for AI model providers and development tools to standardize on a single configuration format, so every provider and CLI tool reads from the same place. When that happens, this project will be deprecated.

Until that standardization happens, dot-ai helps eliminate the pain of maintaining duplicate configurations across multiple tools. We hope this project becomes obsolete as the ecosystem matures and converges on unified standards.

## Running the CLI

```bash
# If you have bun installed
bunx dot-ai@latest

# If you don't have bun installed
npx bun x dot-ai@latest
```

## Usage

### Quick Start

```bash
# Initialize .ai/ folder structure or migrate existing configs (one-time setup)
bun dot-ai@latest init

# Generate all AI provider configs from .ai/ folder
bun dot-ai@latest run
```

### Commands

- **`init`** - Initialize .ai/ folder structure or migrate existing configs
- **`run`** - Generate provider-specific configs from `.ai/` folder

The `run` command will:

1. Read your `.ai/` folder structure
2. Generate provider-specific configuration files
3. Preserve YAML frontmatter where needed (Cursor)
4. Transform MCP configs to each provider's format

## .ai/ Folder Structure

### `instructions.md`

Main instructions that will be included in `CLAUDE.md`, `GEMINI.md`, and `AGENTS.md`:

```markdown
# Project Instructions

Follow these guidelines when working on this project...
```

### `rules/` Directory

Rule files with YAML frontmatter that define specific coding standards:

```markdown
---
title: TypeScript Rules
enabled: true
priority: 1
---

# TypeScript Guidelines

- Always use explicit types
- Avoid `any` type
- Use strict mode
```

### `commands/` Directory

Documentation for available commands (included in instruction files):

```markdown
# Deploy Command

Handles deployment to production environments.

## Usage
```

### `mcp.json`

MCP server configuration that gets distributed to all providers:

```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/tmp"]
    }
  }
}
```

## Generated Files

| File                    | Description              | Content                                                          |
| ----------------------- | ------------------------ | ---------------------------------------------------------------- |
| `CLAUDE.md`             | Claude Code instructions | instructions + rules (no frontmatter) + commands                 |
| `GEMINI.md`             | Gemini instructions      | Identical to `CLAUDE.md`                                         |
| `AGENTS.md`             | Agents instructions      | Identical to `CLAUDE.md`                                         |
| `.mcp.json`             | MCP server config        | Direct copy of `.ai/mcp.json`                                    |
| `.cursor/rules/*.mdc`   | Cursor rules             | Individual rule files with frontmatter preserved                 |
| `.gemini/settings.json` | Gemini MCP settings      | `{ "mcpServers": { ... } }`                                      |
| `opencode.json`         | OpenCode MCP config      | `{ "mcp": { "server": { "type": "local", "command": [...] } } }` |

## How to Migrate to .ai

If you have existing AI configs, follow this workflow to safely migrate:

### 1. Create a Migration Branch

```bash
git checkout -b migrate-to-dot-ai
```

### 2. Run Migration

```bash
bun dot-ai@latest init
```

This creates a `.ai/` folder by consolidating your existing configs:

- `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` → `.ai/instructions.md`
- `.cursor/rules/*.mdc` → `.ai/rules/*.md`
- Various MCP configs → `.ai/mcp.json`

### 3. Review and Clean Up `.ai/` Folder

**Important**: The migration may concatenate multiple files or create duplicate MCP configs. Edit the files as needed to remove duplicates and organize content properly.

### 4. Delete Original AI Config Files

Once satisfied with `.ai/` folder, remove the original AI-specific files:

- **Always remove**: `CLAUDE.md`, `GEMINI.md`, `AGENTS.md`, `.cursor/rules/`
- **MCP configs**: Remove `.mcp.json`, `.gemini/settings.json`, `opencode.json` since these will be auto-generated
- **Keep other configs**: Don't remove `.json` files that serve purposes beyond MCP server configuration (like editor settings, build configs, etc.)

### 5. Commit the Migration

Commit the current work so we have a checkpoint.

### 6. Generate New Configs

```bash
bun dot-ai@latest run
```

### 7. Add Generated Files to .gitignore

You can add the generated files to .gitignore if you prefer.

### 8. Re-generate when needed

You can now use `bun dot-ai@latest run` whenever you update `.ai/` configs.

## Starting Fresh

If you don't have existing AI configs, initialize a new `.ai/` folder by running:

```bash
bun dot-ai@latest init
```

This will create the `.ai/` folder structure and example files to get you started.

## Contributing

Contributions are welcome! This project aims to:

1. **Support more providers** as they emerge
2. **Improve configuration mapping** between formats
3. **Eventually become unnecessary** once standards emerge

### Running the Project Locally

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Test the built CLI
bun link
bun link dot-ai

# Test in another project by running the linked cli
cd ~/my-project
bunx dot-ai run
```

### Running Tests

```bash
# Run all tests
bun test

# Run type checking
bun typecheck
```

Please open issues for bugs or feature requests.

## License

MIT License - see [LICENSE](LICENSE) for details.
