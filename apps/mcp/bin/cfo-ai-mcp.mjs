#!/usr/bin/env node
// Bin shim: invoca o servidor MCP via tsx, evita compile step.
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, "../src/index.ts");
const tsx = resolve(__dirname, "../node_modules/.bin/tsx");

const child = spawn(tsx, [entry], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
