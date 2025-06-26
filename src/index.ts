#!/usr/bin/env bun

import { runGeneration } from "./generator.ts";
import { runInit } from "./migrator.ts";

async function checkGitStatus() {
  try {
    const output = await Bun.$`git status --porcelain`.text();

    if (output.trim() !== "") {
      console.error(
        "❌ Error: Git working directory is not clean. Please commit or stash your changes before running dot-ai.",
      );
      process.exit(1);
    }
  } catch (error) {
    console.error(
      "❌ Error: Failed to check git status. Make sure you're in a git repository.",
    );
    process.exit(1);
  }
}

async function main() {
  await checkGitStatus();

  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: dot-ai <command>");
    console.log("Commands:");
    console.log("  run   Generate AI provider configs from .ai/ folder");
    console.log(
      "  init  Initialize .ai/ folder structure or migrate existing configs",
    );
    process.exit(1);
  }

  if (args[0] === "run") {
    await runGeneration();
  } else if (args[0] === "init") {
    await runInit();
  } else {
    console.error(`❌ Error: Unknown command '${args[0]}'`);
    console.log("Usage: dot-ai <command>");
    console.log("Commands:");
    console.log("  run   Generate AI provider configs from .ai/ folder");
    console.log(
      "  init  Initialize .ai/ folder structure or migrate existing configs",
    );
    process.exit(1);
  }
}

main();
