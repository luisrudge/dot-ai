import type {
  AIConfig,
  GeminiSettings,
  GeneratedFiles,
  MCPConfig,
  OpenCodeConfig,
  RuleFile,
} from "./types.ts";

export async function readAIConfig(aiDir = ".ai"): Promise<AIConfig> {
  // Read instructions
  const instructionsPath = `${aiDir}/instructions.md`;
  let instructions = "";
  try {
    const instructionsFile = Bun.file(instructionsPath);
    if (await instructionsFile.exists()) {
      instructions = await instructionsFile.text();
    }
  } catch (error) {
    console.warn(`Could not read instructions from ${instructionsPath}`);
  }

  // Read rules
  const rules: RuleFile[] = [];
  try {
    const rulesDir = `${aiDir}/rules`;
    // Check if directory exists using filesystem
    try {
      await Bun.$`test -d ${rulesDir}`.quiet();
      const glob = new Bun.Glob("*.md");
      for await (const file of glob.scan({ cwd: rulesDir })) {
        const filePath = `${rulesDir}/${file}`;
        const content = await Bun.file(filePath).text();
        const { frontmatter, content: ruleContent } = parseFrontmatter(content);
        rules.push({
          frontmatter,
          content: ruleContent,
          filename: file,
        });
      }
    } catch (dirError) {
      // Directory doesn't exist, skip
    }
  } catch (error) {
    console.warn(`Could not read rules from ${aiDir}/rules`);
  }

  // Read commands (just list them)
  const commands: string[] = [];
  try {
    const commandsDir = `${aiDir}/commands`;
    // Check if directory exists using filesystem
    try {
      await Bun.$`test -d ${commandsDir}`.quiet();
      const glob = new Bun.Glob("*.md");
      for await (const file of glob.scan({ cwd: commandsDir })) {
        commands.push(file.replace(".md", ""));
      }
    } catch (dirError) {
      // Directory doesn't exist, skip
    }
  } catch (error) {
    console.warn(`Could not read commands from ${aiDir}/commands`);
  }

  // Read MCP config
  let mcp: MCPConfig = { mcpServers: {} };
  try {
    const mcpPath = `${aiDir}/mcp.json`;
    const mcpFile = Bun.file(mcpPath);
    if (await mcpFile.exists()) {
      mcp = await mcpFile.json();
    }
  } catch (error) {
    console.warn(`Could not read MCP config from ${aiDir}/mcp.json`);
  }

  return {
    instructions,
    rules,
    commands,
    mcp,
  };
}

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, any>;
  content: string;
} {
  // Handle both empty and non-empty frontmatter
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

  // Special case for empty frontmatter (--- immediately followed by ---)
  const emptyFrontmatterRegex = /^---\n---\n([\s\S]*)$/;

  let match = content.match(frontmatterRegex);
  let frontmatterYaml = "";
  let bodyContent = "";

  if (!match) {
    // Try the empty frontmatter case
    const emptyMatch = content.match(emptyFrontmatterRegex);
    if (emptyMatch) {
      frontmatterYaml = "";
      bodyContent = emptyMatch[1]!;
    } else {
      return { frontmatter: {}, content };
    }
  } else {
    // TypeScript knows match is not null here, but destructuring still needs assertion
    frontmatterYaml = match[1]!;
    bodyContent = match[2]!;
  }

  // Simple YAML parser for basic key-value pairs
  const frontmatter: Record<string, any> = {};

  // Handle empty frontmatter case (just whitespace)
  if (!frontmatterYaml.trim()) {
    return { frontmatter, content: bodyContent };
  }

  const lines = frontmatterYaml.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const value = trimmed.slice(colonIndex + 1).trim();

    // Handle basic types
    if (value === "true") {
      frontmatter[key] = true;
    } else if (value === "false") {
      frontmatter[key] = false;
    } else if (/^\d+$/.test(value)) {
      frontmatter[key] = parseInt(value, 10);
    } else if (/^\d+\.\d+$/.test(value)) {
      frontmatter[key] = parseFloat(value);
    } else {
      // Remove quotes if present
      frontmatter[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }

  return { frontmatter, content: bodyContent };
}

export function stripFrontmatter(content: string): string {
  const { content: strippedContent } = parseFrontmatter(content);
  return strippedContent;
}

export function generateInstructions(config: AIConfig): string {
  let result = config.instructions;

  // Add rules content (without frontmatter)
  if (config.rules.length > 0) {
    result += "\n\n";
    for (const rule of config.rules) {
      result += `${rule.content}\n\n`;
    }
  }

  // Add commands list
  if (config.commands.length > 0) {
    result += "\n## Available Commands\n\n";
    for (const command of config.commands) {
      result += `- ${command}\n`;
    }
  }

  return result.trim();
}

export async function ensureDirectoryExists(path: string): Promise<void> {
  try {
    // Check if directory exists
    await Bun.$`test -d ${path}`.quiet();
  } catch (error) {
    // Directory doesn't exist, create it
    await Bun.$`mkdir -p ${path}`.quiet();
  }
}

export async function updateProviderSettings(
  filePath: string,
  mcpConfig: MCPConfig,
  updateKey: string,
): Promise<void> {
  let existingConfig: any = {};

  try {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      existingConfig = await file.json();
    }
  } catch (error) {
    // File doesn't exist or invalid JSON, start fresh
    existingConfig = {};
  }

  // Update the specific key with MCP servers
  existingConfig[updateKey] = mcpConfig.mcpServers;

  await Bun.write(filePath, JSON.stringify(existingConfig, null, 2));
}

export async function generateFiles(config: AIConfig): Promise<GeneratedFiles> {
  const instructionsContent = generateInstructions(config);

  // Generate cursor rules with frontmatter preserved
  const cursorRules: Record<string, string> = {};
  for (const rule of config.rules) {
    const frontmatterString =
      Object.keys(rule.frontmatter).length > 0
        ? "---\n" +
          Object.entries(rule.frontmatter)
            .map(
              ([key, value]) =>
                `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
            )
            .join("\n") +
          "\n---\n"
        : "";
    cursorRules[rule.filename.replace(".md", ".mdc")] =
      frontmatterString + rule.content;
  }

  // Generate Gemini settings
  const geminiSettings: GeminiSettings = {
    mcpServers: config.mcp.mcpServers,
  };

  // Generate OpenCode config - convert MCP servers to OpenCode format
  const openCodeMcpServers: Record<string, any> = {};

  for (const [serverName, serverConfig] of Object.entries(
    config.mcp.mcpServers,
  )) {
    openCodeMcpServers[serverName] = {
      type: "local",
      command: [serverConfig.command, ...(serverConfig.args || [])],
      ...(serverConfig.env &&
        Object.keys(serverConfig.env).length > 0 && {
          environment: serverConfig.env,
        }),
    };
  }

  const openCodeConfig: OpenCodeConfig = {
    mcp: openCodeMcpServers,
  };

  return {
    "CLAUDE.md": instructionsContent,
    "GEMINI.md": instructionsContent,
    "AGENTS.md": instructionsContent,
    ".mcp.json": JSON.stringify(config.mcp, null, 2),
    ".cursor/rules": cursorRules,
    ".gemini/settings.json": JSON.stringify(geminiSettings, null, 2),
    "opencode.json": JSON.stringify(openCodeConfig, null, 2),
  };
}

export async function writeGeneratedFiles(
  files: GeneratedFiles,
): Promise<void> {
  // Write CLAUDE.md, GEMINI.md, and AGENTS.md
  await Bun.write("CLAUDE.md", files["CLAUDE.md"]);
  await Bun.write("GEMINI.md", files["GEMINI.md"]);
  await Bun.write("AGENTS.md", files["AGENTS.md"]);

  // Write .mcp.json
  await Bun.write(".mcp.json", files[".mcp.json"]);

  // Write cursor rules
  await ensureDirectoryExists(".cursor/rules");
  for (const [filename, content] of Object.entries(files[".cursor/rules"])) {
    await Bun.write(`.cursor/rules/${filename}`, content);
  }

  // Write Gemini settings
  await ensureDirectoryExists(".gemini");
  await Bun.write(".gemini/settings.json", files[".gemini/settings.json"]);

  // Write OpenCode config
  await Bun.write("opencode.json", files["opencode.json"]);
}

export async function runGeneration() {
  console.log("🤖 dot-ai: Generating AI provider configurations...");

  // Check if .ai directory exists
  const aiDir = ".ai";
  try {
    await Bun.$`test -d ${aiDir}`.quiet();
  } catch (error) {
    throw new Error(".ai directory not found in current directory");
  }

  // Read configuration from .ai directory
  const config = await readAIConfig(aiDir);

  // Generate all provider configuration files
  const files = await generateFiles(config);

  // Write generated files to disk
  await writeGeneratedFiles(files);

  console.log("✅ Successfully generated configuration files:");
  console.log("  - CLAUDE.md");
  console.log("  - GEMINI.md");
  console.log("  - AGENTS.md");
  console.log("  - .mcp.json");
  console.log("  - .cursor/rules/*.mdc");
  console.log("  - .gemini/settings.json");
  console.log("  - opencode.json");
}
