# dot-ai Codebase Instructions

## Project Overview

**dot-ai** is a CLI tool that generates AI provider configurations from a centralized `.ai/` folder, eliminating duplicate configs across Claude Code, Cursor, Gemini, and other AI assistants.

**Core Process**: `.ai/` folder → Parse & Transform → Multiple provider-specific config files

## Codebase Structure

```
src/
├── index.ts           # CLI entry point
├── generator.ts       # Core generation logic
├── migrator.ts        # Migration utilities
├── types.ts           # TypeScript definitions
└── *.test.ts          # Test files
```

## Available Commands

- **`bun run dev`**: Development mode with auto-restart
- **`bun run build`**: Build for production (outputs to `dist/`)
- **`bun run test`**: Run test suite
- **`bun run typecheck`**: TypeScript type checking
- **`bun run prepublishOnly`**: Auto-builds before npm publish
- **`bun run prepare`**: Sets up git hooks for code formatting

## Development Workflow

1. Run `bun run dev` for development
2. Make changes in `src/`
3. Run `bun run typecheck` and `bun run test`
4. Test CLI locally after building

## Key Functionality

**Input** (`.ai/` folder):

- `instructions.md` → Main instructions
- `rules/` → Markdown Rule files with YAML metadata
- `commands/` → Command documentation
- `mcp.json` → MCP server config

**Output** (generated files):

- `CLAUDE.md`, `GEMINI.md`, `AGENTS.md` → Combined instructions
- `.cursor/rules/*.mdc` → Rules with preserved metadata
- `.mcp.json`, `.gemini/settings.json`, `opencode.json` → MCP configs

## Code Guidelines

- **TypeScript**: Strict typing required
- **Testing**: Write tests for all changes

## Making Changes

- **New providers**: Update `generator.ts`, add tests
- **New formats**: Update `types.ts`, modify parsing logic
