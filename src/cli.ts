#!/usr/bin/env node

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { Command } from "commander";

import { generateRoutesFile } from "./index.js";

interface BuildOptions {
  dir: string;
  output: string;
  all: boolean;
  extensions: string[];
}

const program = new Command();

program
  .name("rehype-smart-links")
  .description("CLI utility for rehype-smart-links")
  .version("0.1.0");

program
  .command("build")
  .description("Generate routes file from build directory")
  .option("-d, --dir <path>", "Build directory path", "./dist")
  .option("-o, --output <path>", "Output path for routes file", "./.smart-links-routes.json")
  .option("-a, --all", "Include all files", false)
  .option("-e, --extensions <ext...>", "File extensions to include (default: html)", ["html"])
  .action((options: BuildOptions) => {
    const buildDir = resolve(process.cwd(), options.dir);
    const routesFile = resolve(process.cwd(), options.output);

    if (!existsSync(buildDir)) {
      console.error(`Error: Build directory '${buildDir}' does not exist.`);
      process.exit(1);
    }

    generateRoutesFile(buildDir, routesFile, {
      includeAllFiles: options.all,
      includeFileExtensions: options.extensions,
    });
  });

program.parse(process.argv);
