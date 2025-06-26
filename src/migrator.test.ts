import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "fs";
import {
  detectProviderFiles,
  extractAllMCPConfigs,
  runMigration,
} from "./migrator.ts";

const TEST_DIR = "/tmp/dot-ai-migrator-test";

describe("Migrator Unit Tests", () => {
  beforeEach(async () => {
    // Clean up any existing test directory
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}

    // Create test directory
    mkdirSync(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    // Clean up
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe("detectProviderFiles", () => {
    test("should find all available provider files", async () => {
      // Create test files
      await Bun.write("CLAUDE.md", "Claude instructions");
      await Bun.write("GEMINI.md", "Gemini instructions");
      await Bun.write("AGENTS.md", "Agents instructions");
      await Bun.write(".mcp.json", '{"mcpServers":{}}');

      mkdirSync(".cursor/rules", { recursive: true });
      await Bun.write(".cursor/rules/test.mdc", "Test rule");

      mkdirSync(".claude/commands", { recursive: true });
      await Bun.write(".claude/commands/deploy.md", "Deploy command");

      mkdirSync(".gemini", { recursive: true });
      await Bun.write(".gemini/settings.json", '{"mcpServers":{}}');

      await Bun.write("opencode.json", '{"mcp":{}}');

      const detected = await detectProviderFiles();

      expect(detected.claude).toBe("CLAUDE.md");
      expect(detected.gemini).toBe("GEMINI.md");
      expect(detected.agents).toBe("AGENTS.md");
      expect(detected.mcp).toBe(".mcp.json");
      expect(detected.geminiSettings).toBe(".gemini/settings.json");
      expect(detected.opencode).toBe("opencode.json");
      expect(detected.cursorRules).toEqual([".cursor/rules/test.mdc"]);
      expect(detected.claudeCommands).toEqual([".claude/commands/deploy.md"]);
    });

    test("should handle missing files gracefully", async () => {
      const detected = await detectProviderFiles();

      expect(detected.claude).toBeUndefined();
      expect(detected.gemini).toBeUndefined();
      expect(detected.agents).toBeUndefined();
      expect(detected.mcp).toBeUndefined();
      expect(detected.cursorRules).toEqual([]);
      expect(detected.claudeCommands).toEqual([]);
    });

    test("should find multiple cursor rules", async () => {
      mkdirSync(".cursor/rules", { recursive: true });
      await Bun.write(".cursor/rules/typescript.mdc", "TS rules");
      await Bun.write(".cursor/rules/forms.mdc", "Form rules");

      const detected = await detectProviderFiles();

      expect(detected.cursorRules).toHaveLength(2);
      expect(detected.cursorRules).toContain(".cursor/rules/typescript.mdc");
      expect(detected.cursorRules).toContain(".cursor/rules/forms.mdc");
    });

    test("should find multiple claude commands", async () => {
      mkdirSync(".claude/commands", { recursive: true });
      await Bun.write(".claude/commands/deploy.md", "Deploy cmd");
      await Bun.write(".claude/commands/test.md", "Test cmd");

      const detected = await detectProviderFiles();

      expect(detected.claudeCommands).toHaveLength(2);
      expect(detected.claudeCommands).toContain(".claude/commands/deploy.md");
      expect(detected.claudeCommands).toContain(".claude/commands/test.md");
    });
  });

  describe("extractAllMCPConfigs", () => {
    test("should merge MCP configs from all sources", async () => {
      // Create .mcp.json
      await Bun.write(
        ".mcp.json",
        JSON.stringify({
          mcpServers: {
            filesystem: { command: "npx", args: ["fs-server"] },
          },
        }),
      );

      // Create .gemini/settings.json
      mkdirSync(".gemini", { recursive: true });
      await Bun.write(
        ".gemini/settings.json",
        JSON.stringify({
          mcpServers: {
            git: { command: "npx", args: ["git-server"] },
          },
        }),
      );

      // Create opencode.json
      await Bun.write(
        "opencode.json",
        JSON.stringify({
          mcp: {
            postgres: {
              type: "local",
              command: ["bun", "postgres.ts"],
              environment: { DB_URL: "test" },
            },
          },
        }),
      );

      const { merged, duplicates } = await extractAllMCPConfigs();

      expect(Object.keys(merged.mcpServers)).toHaveLength(3);
      expect(merged.mcpServers.filesystem).toEqual({
        command: "npx",
        args: ["fs-server"],
      });
      expect(merged.mcpServers.git).toEqual({
        command: "npx",
        args: ["git-server"],
      });
      expect(merged.mcpServers.postgres).toEqual({
        type: "stdio",
        command: "bun",
        args: ["postgres.ts"],
        env: { DB_URL: "test" },
      });
      expect(duplicates).toEqual([]);
    });

    test("should detect duplicate server names", async () => {
      // Create .mcp.json
      await Bun.write(
        ".mcp.json",
        JSON.stringify({
          mcpServers: {
            filesystem: { command: "npx", args: ["fs-server"] },
          },
        }),
      );

      // Create .gemini/settings.json with duplicate
      mkdirSync(".gemini", { recursive: true });
      await Bun.write(
        ".gemini/settings.json",
        JSON.stringify({
          mcpServers: {
            filesystem: { command: "different", args: ["different-server"] },
          },
        }),
      );

      const { merged, duplicates } = await extractAllMCPConfigs();

      expect(duplicates).toContain("filesystem");
      // Last one wins
      expect(merged.mcpServers.filesystem).toEqual({
        command: "different",
        args: ["different-server"],
      });
    });

    test("should handle missing MCP files gracefully", async () => {
      const { merged, duplicates } = await extractAllMCPConfigs();

      expect(merged.mcpServers).toEqual({});
      expect(duplicates).toEqual([]);
    });

    test("should convert OpenCode format correctly", async () => {
      await Bun.write(
        "opencode.json",
        JSON.stringify({
          mcp: {
            test: {
              type: "local",
              command: ["bun", "--env-file", ".env", "server.ts"],
              environment: { PORT: "3000" },
            },
          },
        }),
      );

      const { merged, duplicates } = await extractAllMCPConfigs();

      expect(merged.mcpServers.test).toEqual({
        type: "stdio",
        command: "bun",
        args: ["--env-file", ".env", "server.ts"],
        env: { PORT: "3000" },
      });
    });

    test("should handle malformed JSON files", async () => {
      await Bun.write(".mcp.json", "invalid json");

      const { merged, duplicates } = await extractAllMCPConfigs();

      expect(merged.mcpServers).toEqual({});
      expect(duplicates).toEqual([]);
    });
  });
});

describe("Migration Integration Tests", () => {
  beforeEach(async () => {
    // Clean up any existing test directory
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}

    // Create test directory
    mkdirSync(TEST_DIR, { recursive: true });
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    // Clean up
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  test("should migrate complete provider setup to .ai folder", async () => {
    // Create complete provider setup
    await Bun.write(
      "CLAUDE.md",
      "# Claude Instructions\\n\\nMain instructions for Claude.",
    );
    await Bun.write(
      "GEMINI.md",
      "# Gemini Instructions\\n\\nSpecific instructions for Gemini.",
    );
    await Bun.write(
      "AGENTS.md",
      "# Agents Instructions\\n\\nSpecific instructions for Agents.",
    );

    mkdirSync(".cursor/rules", { recursive: true });
    await Bun.write(
      ".cursor/rules/typescript.mdc",
      `---
title: TypeScript Rules
enabled: true
---

# TypeScript Rules

Use strict types.`,
    );

    mkdirSync(".claude/commands", { recursive: true });
    await Bun.write(
      ".claude/commands/deploy.md",
      "# Deploy Command\n\nDeploy the application.",
    );

    await Bun.write(
      ".mcp.json",
      JSON.stringify({
        mcpServers: {
          filesystem: { command: "npx", args: ["fs-server"] },
        },
      }),
    );

    // Run migration
    await runMigration();

    // Verify .ai structure was created
    expect(await Bun.file(".ai/instructions.md").exists()).toBe(true);
    expect(await Bun.file(".ai/rules/typescript.md").exists()).toBe(true);
    expect(await Bun.file(".ai/commands/deploy.md").exists()).toBe(true);
    expect(await Bun.file(".ai/mcp.json").exists()).toBe(true);

    // Verify content
    const instructions = await Bun.file(".ai/instructions.md").text();
    expect(instructions).toContain("Claude Instructions");
    expect(instructions).toContain("---");
    expect(instructions).toContain("Gemini Instructions");
    expect(instructions).toContain("Agents Instructions");

    const rule = await Bun.file(".ai/rules/typescript.md").text();
    expect(rule).toContain("title: TypeScript Rules");
    expect(rule).toContain("Use strict types.");

    const command = await Bun.file(".ai/commands/deploy.md").text();
    expect(command).toContain("Deploy Command");

    const mcp = await Bun.file(".ai/mcp.json").json();
    expect(mcp.mcpServers.filesystem).toBeDefined();
  });

  test("should fail if .ai folder already exists", async () => {
    // Create .ai folder
    mkdirSync(".ai", { recursive: true });

    // Create some provider files
    await Bun.write("CLAUDE.md", "Instructions");

    // Should throw error
    await expect(runMigration()).rejects.toThrow(".ai folder already exists");
  });

  test("should handle partial provider configs", async () => {
    // Only create some files
    await Bun.write("CLAUDE.md", "Only Claude instructions");

    mkdirSync(".cursor/rules", { recursive: true });
    await Bun.write(".cursor/rules/test.mdc", "Test rule");

    await runMigration();

    // Should create what it can
    expect(await Bun.file(".ai/instructions.md").exists()).toBe(true);
    expect(await Bun.file(".ai/rules/test.md").exists()).toBe(true);
    expect(await Bun.file(".ai/mcp.json").exists()).toBe(false);

    const instructions = await Bun.file(".ai/instructions.md").text();
    expect(instructions).toBe("Only Claude instructions");
  });

  test("should error when no provider files found", async () => {
    await expect(runMigration()).rejects.toThrow(
      "No AI provider configs found to migrate",
    );
  });

  test("should handle MCP duplicate detection", async () => {
    // Create files with duplicate MCP servers
    await Bun.write("CLAUDE.md", "Instructions");

    await Bun.write(
      ".mcp.json",
      JSON.stringify({
        mcpServers: { test: { command: "original" } },
      }),
    );

    mkdirSync(".gemini", { recursive: true });
    await Bun.write(
      ".gemini/settings.json",
      JSON.stringify({
        mcpServers: { test: { command: "duplicate" } },
      }),
    );

    // Capture console output
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args) => logs.push(args.join(" "));

    try {
      await runMigration();

      // Should mention duplicates
      const output = logs.join("\n");
      expect(output).toContain("Duplicate MCP servers found: test");
    } finally {
      console.log = originalLog;
    }
  });

  test("should create valid .ai structure that can regenerate", async () => {
    // Create provider files
    await Bun.write("CLAUDE.md", "Test instructions");

    mkdirSync(".cursor/rules", { recursive: true });
    await Bun.write(
      ".cursor/rules/test.mdc",
      `---
enabled: true
---

Test rule content`,
    );

    await Bun.write(
      ".mcp.json",
      JSON.stringify({
        mcpServers: { test: { command: "test-cmd" } },
      }),
    );

    // Run migration
    await runMigration();

    // Import generation functions to test
    const { readAIConfig, generateFiles } = await import("./generator.ts");

    // Should be able to read the migrated config
    const config = await readAIConfig(".ai");
    expect(config.instructions).toContain("Test instructions");
    expect(config.rules).toHaveLength(1);
    expect(config.rules[0]!.content).toContain("Test rule content");
    expect(config.mcp.mcpServers.test).toBeDefined();

    // Should be able to generate files from migrated config
    const files = await generateFiles(config);
    expect(files["CLAUDE.md"]).toContain("Test instructions");
    expect(files["CLAUDE.md"]).toContain("Test rule content");
  });
});
