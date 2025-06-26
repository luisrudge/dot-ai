import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import {
  generateFiles,
  readAIConfig,
  writeGeneratedFiles,
} from "./generator.ts";

const TEST_DIR = "/tmp/dot-ai-test";
const AI_DIR = join(TEST_DIR, ".ai");

describe("Integration Tests", () => {
  beforeEach(async () => {
    // Clean up any existing test directory
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}

    // Create test directory structure
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(AI_DIR, { recursive: true });
    mkdirSync(join(AI_DIR, "rules"), { recursive: true });
    mkdirSync(join(AI_DIR, "commands"), { recursive: true });

    // Change to test directory
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    // Clean up
    try {
      rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  test("should read complete AI configuration from directory", async () => {
    // Create test files
    await Bun.write(
      join(AI_DIR, "instructions.md"),
      "# Main Instructions\n\nThis is the main instructions file.",
    );

    await Bun.write(
      join(AI_DIR, "rules", "general.md"),
      `---
title: General Rules
enabled: true
priority: 1
---

## General Rules

Follow these general guidelines.`,
    );

    await Bun.write(
      join(AI_DIR, "rules", "forms.md"),
      `---
title: Form Rules
enabled: false
---

## Form Rules

Rules for handling forms.`,
    );

    await Bun.write(
      join(AI_DIR, "commands", "deploy.md"),
      "Deploy command documentation",
    );
    await Bun.write(
      join(AI_DIR, "commands", "test.md"),
      "Test command documentation",
    );

    await Bun.write(
      join(AI_DIR, "mcp.json"),
      JSON.stringify(
        {
          mcpServers: {
            jira: {
              type: "stdio",
              command: "bun",
              args: ["--env-file", "mcps/.env", "mcps/jira.ts"],
              env: {},
            },
          },
        },
        null,
        2,
      ),
    );

    // Read configuration
    const config = await readAIConfig(".ai");

    // Verify instructions
    expect(config.instructions).toContain("Main Instructions");
    expect(config.instructions).toContain(
      "This is the main instructions file.",
    );

    // Verify rules
    expect(config.rules).toHaveLength(2);

    const generalRule = config.rules.find((r) => r.filename === "general.md");
    expect(generalRule).toBeDefined();
    expect(generalRule!.frontmatter.title).toBe("General Rules");
    expect(generalRule!.frontmatter.enabled).toBe(true);
    expect(generalRule!.frontmatter.priority).toBe(1);
    expect(generalRule!.content).toContain("Follow these general guidelines.");

    const formRule = config.rules.find((r) => r.filename === "forms.md");
    expect(formRule).toBeDefined();
    expect(formRule!.frontmatter.enabled).toBe(false);
    expect(formRule!.content).toContain("Rules for handling forms.");

    // Verify commands
    expect(config.commands).toHaveLength(2);
    expect(config.commands).toContain("deploy");
    expect(config.commands).toContain("test");

    // Verify MCP config
    expect(config.mcp.mcpServers.jira).toBeDefined();
    expect(config.mcp.mcpServers.jira!.command).toBe("bun");
  });

  test("should handle missing files gracefully", async () => {
    // Only create mcp.json
    await Bun.write(
      join(AI_DIR, "mcp.json"),
      JSON.stringify({
        mcpServers: {},
      }),
    );

    const config = await readAIConfig(".ai");

    expect(config.instructions).toBe("");
    expect(config.rules).toHaveLength(0);
    expect(config.commands).toHaveLength(0);
    expect(config.mcp.mcpServers).toEqual({});
  });

  test("should generate and write all files correctly", async () => {
    // Create minimal test configuration
    await Bun.write(join(AI_DIR, "instructions.md"), "Test instructions");
    await Bun.write(
      join(AI_DIR, "rules", "test.md"),
      `---
enabled: true
---

Test rule content`,
    );
    await Bun.write(
      join(AI_DIR, "mcp.json"),
      JSON.stringify({
        mcpServers: {
          test: { command: "test-cmd" },
        },
      }),
    );

    // Read, generate, and write
    const config = await readAIConfig(".ai");
    const files = await generateFiles(config);
    await writeGeneratedFiles(files);

    // Verify generated files exist and have correct content
    const claudeFile = Bun.file("CLAUDE.md");
    expect(await claudeFile.exists()).toBe(true);
    const claudeContent = await claudeFile.text();
    expect(claudeContent).toContain("Test instructions");
    expect(claudeContent).toContain("Test rule content");

    const geminiFile = Bun.file("GEMINI.md");
    expect(await geminiFile.exists()).toBe(true);
    const geminiContent = await geminiFile.text();
    expect(geminiContent).toBe(claudeContent); // Should be identical

    const agentsFile = Bun.file("AGENTS.md");
    expect(await agentsFile.exists()).toBe(true);
    const agentsContent = await agentsFile.text();
    expect(agentsContent).toBe(claudeContent); // Should be identical

    const mcpFile = Bun.file(".mcp.json");
    expect(await mcpFile.exists()).toBe(true);
    const mcpContent = await mcpFile.json();
    expect(mcpContent.mcpServers.test.command).toBe("test-cmd");

    // Check cursor rules directory and files
    const cursorRuleFile = Bun.file(".cursor/rules/test.mdc");
    expect(await cursorRuleFile.exists()).toBe(true);
    const cursorRuleContent = await cursorRuleFile.text();
    expect(cursorRuleContent).toContain("enabled: true");
    expect(cursorRuleContent).toContain("Test rule content");

    // Check Gemini settings
    const geminiSettingsFile = Bun.file(".gemini/settings.json");
    expect(await geminiSettingsFile.exists()).toBe(true);
    const geminiSettings = await geminiSettingsFile.json();
    expect(geminiSettings.mcpServers.test.command).toBe("test-cmd");

    // Check OpenCode config
    const openCodeFile = Bun.file("opencode.json");
    expect(await openCodeFile.exists()).toBe(true);
    const openCodeConfig = await openCodeFile.json();
    expect(openCodeConfig.mcp.test).toEqual({
      type: "local",
      command: ["test-cmd"],
    });
  });

  test("should handle directory creation for nested paths", async () => {
    // Create test config
    await Bun.write(join(AI_DIR, "instructions.md"), "Test");
    await Bun.write(
      join(AI_DIR, "mcp.json"),
      JSON.stringify({ mcpServers: {} }),
    );

    const config = await readAIConfig(".ai");
    const files = await generateFiles(config);
    await writeGeneratedFiles(files);

    // Verify directories were created
    try {
      await Bun.$`test -d .cursor`.quiet();
      expect(true).toBe(true); // Directory exists
    } catch {
      expect(false).toBe(true); // Directory does not exist
    }

    try {
      await Bun.$`test -d .gemini`.quiet();
      expect(true).toBe(true); // Directory exists
    } catch {
      expect(false).toBe(true); // Directory does not exist
    }
  });
});
