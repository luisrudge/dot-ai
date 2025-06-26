import path from "path";
import { ensureDirectoryExists } from "./generator.ts";
import type {
  DetectedFiles,
  GeminiSettings,
  MCPConfig,
  MCPServer,
  OpenCodeConfig,
} from "./types.ts";

export async function detectProviderFiles(): Promise<DetectedFiles> {
  const detected: DetectedFiles = {
    cursorRules: [],
    claudeCommands: [],
  };

  // Check for instruction files
  if (await Bun.file("CLAUDE.md").exists()) {
    detected.claude = "CLAUDE.md";
  }
  if (await Bun.file("GEMINI.md").exists()) {
    detected.gemini = "GEMINI.md";
  }
  if (await Bun.file("AGENTS.md").exists()) {
    detected.agents = "AGENTS.md";
  }

  // Check for MCP files
  if (await Bun.file(".mcp.json").exists()) {
    detected.mcp = ".mcp.json";
  }
  if (await Bun.file(".gemini/settings.json").exists()) {
    detected.geminiSettings = ".gemini/settings.json";
  }
  if (await Bun.file("opencode.json").exists()) {
    detected.opencode = "opencode.json";
  }

  // Check for .cursor/rules/
  try {
    await Bun.$`test -d .cursor/rules`.quiet();
    const glob = new Bun.Glob("*.mdc");
    for await (const file of glob.scan({ cwd: ".cursor/rules" })) {
      detected.cursorRules.push(`.cursor/rules/${file}`);
    }
  } catch {
    // Directory doesn't exist, skip
  }

  // Check for .claude/commands/
  try {
    await Bun.$`test -d .claude/commands`.quiet();
    const glob = new Bun.Glob("*.md");
    for await (const file of glob.scan({ cwd: ".claude/commands" })) {
      detected.claudeCommands.push(`.claude/commands/${file}`);
    }
  } catch {
    // Directory doesn't exist, skip
  }

  return detected;
}

export async function extractAllMCPConfigs(): Promise<{
  merged: MCPConfig;
  duplicates: string[];
}> {
  const allServers: Record<string, MCPServer> = {};
  const duplicates: string[] = [];

  // 1. Load from .mcp.json
  try {
    if (await Bun.file(".mcp.json").exists()) {
      const mcpConfig = (await Bun.file(".mcp.json").json()) as MCPConfig;
      if (mcpConfig.mcpServers) {
        Object.assign(allServers, mcpConfig.mcpServers);
      }
    }
  } catch (error) {
    console.warn("Could not read .mcp.json:", error);
  }

  // 2. Load from .gemini/settings.json
  try {
    if (await Bun.file(".gemini/settings.json").exists()) {
      const geminiSettings = (await Bun.file(
        ".gemini/settings.json",
      ).json()) as GeminiSettings;
      if (geminiSettings.mcpServers) {
        for (const [name, server] of Object.entries(
          geminiSettings.mcpServers,
        )) {
          if (allServers[name]) {
            duplicates.push(name);
          }
          allServers[name] = server;
        }
      }
    }
  } catch (error) {
    console.warn("Could not read .gemini/settings.json:", error);
  }

  // 3. Load from opencode.json (convert format)
  try {
    if (await Bun.file("opencode.json").exists()) {
      const openCodeConfig = (await Bun.file(
        "opencode.json",
      ).json()) as OpenCodeConfig;
      if (openCodeConfig.mcp) {
        for (const [name, openCodeServer] of Object.entries(
          openCodeConfig.mcp,
        )) {
          if (allServers[name]) {
            duplicates.push(name);
          }
          // Convert OpenCode format back to standard format
          allServers[name] = {
            type: "stdio", // OpenCode uses "local" but standard uses "stdio"
            command: openCodeServer.command?.[0] || "",
            args: openCodeServer.command?.slice(1) || [],
            env: openCodeServer.environment || {},
          };
        }
      }
    }
  } catch (error) {
    console.warn("Could not read opencode.json:", error);
  }

  return {
    merged: { mcpServers: allServers },
    duplicates: [...new Set(duplicates)], // Remove duplicate names
  };
}

export async function runMigration(): Promise<void> {
  // Check .ai doesn't exist
  try {
    await Bun.$`test -d .ai`.quiet();
    throw new Error(".ai folder already exists");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === ".ai folder already exists"
    ) {
      throw error;
    }
    // Directory doesn't exist, which is what we want
  }

  const detected = await detectProviderFiles();

  // Check if we found any provider files
  const hasAnyFiles =
    detected.claude ||
    detected.gemini ||
    detected.agents ||
    detected.cursorRules.length > 0 ||
    detected.claudeCommands.length > 0 ||
    detected.mcp ||
    detected.geminiSettings ||
    detected.opencode;

  if (!hasAnyFiles) {
    throw new Error("No AI provider configs found to migrate");
  }

  // Create .ai structure
  await ensureDirectoryExists(".ai/rules");
  await ensureDirectoryExists(".ai/commands");

  let createdFiles: string[] = [];

  // Migrate instructions - concatenate CLAUDE.md + GEMINI.md + AGENTS.md
  let instructions = "";
  if (detected.claude) {
    instructions += await Bun.file(detected.claude).text();
  }
  if (detected.gemini) {
    if (instructions) instructions += "\n\n---\n\n";
    instructions += await Bun.file(detected.gemini).text();
  }
  if (detected.agents) {
    if (instructions) instructions += "\n\n---\n\n";
    instructions += await Bun.file(detected.agents).text();
  }
  if (instructions) {
    await Bun.write(".ai/instructions.md", instructions);
    createdFiles.push(".ai/instructions.md");
  }

  // Migrate rules (.mdc → .md)
  for (const ruleFile of detected.cursorRules) {
    const content = await Bun.file(ruleFile).text();
    const filename = path.basename(ruleFile).replace(".mdc", ".md");
    await Bun.write(`.ai/rules/${filename}`, content);
  }
  if (detected.cursorRules.length > 0) {
    createdFiles.push(`.ai/rules/ (${detected.cursorRules.length} files)`);
  }

  // Migrate commands
  for (const commandFile of detected.claudeCommands) {
    const content = await Bun.file(commandFile).text();
    const filename = path.basename(commandFile);
    await Bun.write(`.ai/commands/${filename}`, content);
  }
  if (detected.claudeCommands.length > 0) {
    createdFiles.push(
      `.ai/commands/ (${detected.claudeCommands.length} files)`,
    );
  }

  // Merge MCP configs
  const { merged, duplicates } = await extractAllMCPConfigs();
  const serverCount = Object.keys(merged.mcpServers).length;

  if (serverCount > 0) {
    await Bun.write(".ai/mcp.json", JSON.stringify(merged, null, 2));
    createdFiles.push(`.ai/mcp.json (${serverCount} servers)`);
  }

  // Report results
  console.log("✅ Migration completed!");
  console.log("");
  console.log("Created:");
  for (const file of createdFiles) {
    console.log(`  ${file}`);
  }

  if (duplicates.length > 0) {
    console.log("");
    console.log(`⚠️  Duplicate MCP servers found: ${duplicates.join(", ")}`);
    console.log("   Please review .ai/mcp.json and resolve conflicts manually");
  }

  console.log("");
  console.log("💡 Run 'dot-ai run' to test the migrated configuration");
}
