import { describe, expect, test } from "bun:test";
import {
  generateFiles,
  generateInstructions,
  parseFrontmatter,
  stripFrontmatter,
} from "./generator.ts";
import type { AIConfig } from "./types.ts";

describe("parseFrontmatter", () => {
  test("should parse YAML frontmatter correctly", () => {
    const content = `---
title: Test Rule
enabled: true
priority: 1
description: A test rule
---

This is the content of the rule`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter).toEqual({
      title: "Test Rule",
      enabled: true,
      priority: 1,
      description: "A test rule",
    });
    expect(result.content).toBe("\nThis is the content of the rule");
  });

  test("should handle content without frontmatter", () => {
    const content = "This is just regular content";
    const result = parseFrontmatter(content);

    expect(result.frontmatter).toEqual({});
    expect(result.content).toBe("This is just regular content");
  });

  test("should handle empty frontmatter", () => {
    const content = `---
---

Content here`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({});
    expect(result.content).toBe("\nContent here");
  });

  test("should handle different value types", () => {
    const content = `---
string_value: hello world
quoted_string: "hello world"
single_quoted: 'hello world'
boolean_true: true
boolean_false: false
integer: 42
float: 3.14
---

Content`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter).toEqual({
      string_value: "hello world",
      quoted_string: "hello world",
      single_quoted: "hello world",
      boolean_true: true,
      boolean_false: false,
      integer: 42,
      float: 3.14,
    });
  });
});

describe("stripFrontmatter", () => {
  test("should remove frontmatter and return content only", () => {
    const content = `---
title: Test
---

This is the content`;

    const result = stripFrontmatter(content);
    expect(result).toBe("\nThis is the content");
  });

  test("should return original content if no frontmatter", () => {
    const content = "This is just content";
    const result = stripFrontmatter(content);
    expect(result).toBe("This is just content");
  });
});

describe("generateInstructions", () => {
  test("should combine instructions, rules, and commands", () => {
    const config: AIConfig = {
      instructions: "Main instructions here",
      rules: [
        {
          frontmatter: { title: "Rule 1" },
          content: "Rule 1 content",
          filename: "rule1.md",
        },
        {
          frontmatter: {},
          content: "Rule 2 content",
          filename: "rule2.md",
        },
      ],
      commands: ["command1", "command2"],
      mcp: { mcpServers: {} },
    };

    const result = generateInstructions(config);

    expect(result).toContain("Main instructions here");
    expect(result).toContain("Rule 1 content");
    expect(result).toContain("Rule 2 content");
    expect(result).toContain("## Available Commands");
    expect(result).toContain("- command1");
    expect(result).toContain("- command2");
  });

  test("should handle empty rules and commands", () => {
    const config: AIConfig = {
      instructions: "Just instructions",
      rules: [],
      commands: [],
      mcp: { mcpServers: {} },
    };

    const result = generateInstructions(config);
    expect(result).toBe("Just instructions");
  });

  test("should handle only rules without commands", () => {
    const config: AIConfig = {
      instructions: "Instructions",
      rules: [
        {
          frontmatter: {},
          content: "Rule content",
          filename: "rule.md",
        },
      ],
      commands: [],
      mcp: { mcpServers: {} },
    };

    const result = generateInstructions(config);
    expect(result).toContain("Instructions");
    expect(result).toContain("Rule content");
    expect(result).not.toContain("Available Commands");
  });
});

describe("generateFiles", () => {
  test("should generate all required files", async () => {
    const config: AIConfig = {
      instructions: "Test instructions",
      rules: [
        {
          frontmatter: { enabled: true },
          content: "Test rule",
          filename: "test.md",
        },
      ],
      commands: ["test-command"],
      mcp: {
        mcpServers: {
          test: {
            command: "test-cmd",
            args: ["--test"],
          },
        },
      },
    };

    const files = await generateFiles(config);

    // Check that all expected files are generated
    expect(files["CLAUDE.md"]).toBeDefined();
    expect(files["GEMINI.md"]).toBeDefined();
    expect(files["AGENTS.md"]).toBeDefined();
    expect(files[".mcp.json"]).toBeDefined();
    expect(files[".cursor/rules"]).toBeDefined();
    expect(files[".gemini/settings.json"]).toBeDefined();
    expect(files["opencode.json"]).toBeDefined();

    // Check CLAUDE.md, GEMINI.md, and AGENTS.md are identical
    expect(files["CLAUDE.md"]).toBe(files["GEMINI.md"]);
    expect(files["CLAUDE.md"]).toBe(files["AGENTS.md"]);

    // Check content includes everything
    expect(files["CLAUDE.md"]).toContain("Test instructions");
    expect(files["CLAUDE.md"]).toContain("Test rule");
    expect(files["CLAUDE.md"]).toContain("test-command");

    // Check MCP config is properly formatted
    const mcpConfig = JSON.parse(files[".mcp.json"]);
    expect(mcpConfig.mcpServers.test).toEqual({
      command: "test-cmd",
      args: ["--test"],
    });

    // Check cursor rules preserve frontmatter
    expect(files[".cursor/rules"]["test.mdc"]).toContain("enabled: true");
    expect(files[".cursor/rules"]["test.mdc"]).toContain("Test rule");

    // Check Gemini settings
    const geminiSettings = JSON.parse(files[".gemini/settings.json"]);
    expect(geminiSettings.mcpServers).toEqual(config.mcp.mcpServers);

    // Check OpenCode config
    const openCodeConfig = JSON.parse(files["opencode.json"]);
    expect(openCodeConfig.mcp.test).toEqual({
      type: "local",
      command: ["test-cmd", "--test"],
    });
  });

  test("should handle empty configuration", async () => {
    const config: AIConfig = {
      instructions: "",
      rules: [],
      commands: [],
      mcp: { mcpServers: {} },
    };

    const files = await generateFiles(config);

    expect(files["CLAUDE.md"]).toBe("");
    expect(files["GEMINI.md"]).toBe("");
    expect(files["AGENTS.md"]).toBe("");

    const mcpConfig = JSON.parse(files[".mcp.json"]);
    expect(mcpConfig.mcpServers).toEqual({});

    expect(Object.keys(files[".cursor/rules"])).toHaveLength(0);
  });
});
