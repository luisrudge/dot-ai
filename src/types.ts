export interface MCPConfig {
  mcpServers: Record<string, MCPServer>;
}

export interface MCPServer {
  type?: "stdio" | "sse";
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface RuleFile {
  frontmatter: Record<string, any>;
  content: string;
  filename: string;
}

export interface AIConfig {
  instructions: string;
  rules: RuleFile[];
  commands: string[];
  mcp: MCPConfig;
}

export interface GeminiSettings {
  mcpServers?: Record<string, MCPServer>;
  [key: string]: any;
}

export interface OpenCodeMCPServer {
  type: "local" | "remote";
  command?: string[];
  url?: string;
  environment?: Record<string, string>;
}

export interface OpenCodeConfig {
  mcp?: Record<string, OpenCodeMCPServer>;
  [key: string]: any;
}

export interface GeneratedFiles {
  "CLAUDE.md": string;
  "GEMINI.md": string;
  "AGENTS.md": string;
  ".mcp.json": string;
  ".cursor/rules": Record<string, string>;
  ".gemini/settings.json": string;
  "opencode.json": string;
}

export interface DetectedFiles {
  claude?: string;
  gemini?: string;
  agents?: string;
  mcp?: string;
  cursorRules: string[];
  claudeCommands: string[];
  geminiSettings?: string;
  opencode?: string;
}
