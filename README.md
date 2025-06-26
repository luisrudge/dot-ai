# dot-ai

**Generate AI provider configurations from a centralized `.ai/` folder**

A CLI tool that reads from a single `.ai/` directory and generates configuration files for multiple AI assistants and code editors, eliminating duplicate configs across Claude Code, Cursor, Gemini, and OpenCode.

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

## Installation

```bash
bun install -g dot-ai
```

## Usage

```bash
# Generate all AI provider configs from .ai/ folder
dot-ai run
```

That's it! The tool will:

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

## Example

Create a `.ai/` folder in your project:

```bash
mkdir -p .ai/rules .ai/commands
```

Add some content:

```bash
# .ai/instructions.md
echo "# My Project\nMain development guidelines..." > .ai/instructions.md

# .ai/rules/typescript.md
cat > .ai/rules/typescript.md << 'EOF'
---
title: TypeScript Rules
enabled: true
---

# TypeScript Guidelines
- Use explicit types
- Avoid any
EOF

# .ai/mcp.json
echo '{"mcpServers":{"git":{"command":"npx","args":["@modelcontextprotocol/server-git"]}}}' > .ai/mcp.json
```

Run the generator:

```bash
dot-ai run
```

## Important Note: This is a Temporary Solution

**dot-ai is intended as a stop-gap solution.** The ultimate goal is for AI model providers and development tools to standardize on a single configuration format, so every provider and CLI tool reads from the same place.

Until that standardization happens, dot-ai helps eliminate the pain of maintaining duplicate configurations across multiple tools. We hope this project becomes obsolete as the ecosystem matures and converges on unified standards.

## Development

```bash
# Clone the repository
git clone https://github.com/luisrudge/dot-ai.git
cd dot-ai

# Install dependencies
bun install

# Run tests
bun test

# Build
bun run build

# Test locally
bun run dev
```

## Contributing

Contributions are welcome! This project aims to:

1. **Support more providers** as they emerge
2. **Improve configuration mapping** between formats
3. **Eventually become unnecessary** once standards emerge

### Running the Project Locally

```bash
# Install dependencies
bun install

# Run the CLI locally (without building)
bun run dev

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
