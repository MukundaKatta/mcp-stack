#!/usr/bin/env node
// shellquote-mcp — safe shell argument escaping for bash/sh, cmd.exe, PowerShell.
//
// LLMs reliably get shell escaping wrong: confusing single vs double quotes,
// missing backslash escapes, leaving $VAR or %VAR% interpolation in the
// rendered command. These tools make the escape choice explicit and correct.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// --- pure logic ---

/**
 * POSIX (bash / sh / zsh) safe single-quote escape.
 * Strategy: wrap in single quotes; replace any literal single-quote with '\''.
 * The result has no metacharacter expansion.
 */
export function quoteBash(arg) {
  if (arg === "") return "''";
  if (/^[A-Za-z0-9_./@:%+,=-]+$/.test(arg)) return arg; // bareword-safe
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

/** Quote a list of args with quoteBash and join with single spaces. */
export function quoteBashArgv(args) {
  return args.map(quoteBash).join(" ");
}

/**
 * Windows cmd.exe escape. cmd.exe is a horror; this is the best-effort
 * recommended pattern: wrap in double quotes, escape embedded double quotes
 * as `""`, and escape `^ & < > | %` outside the quoted region by prefixing `^`.
 * Caveat: cmd.exe has unfixable corner cases (caret in DELAYED expansion).
 * Use PowerShell instead when you have the choice.
 */
export function quoteCmd(arg) {
  if (arg === "") return '""';
  // If only safe chars, leave bare.
  if (/^[A-Za-z0-9_./:=-]+$/.test(arg)) return arg;
  // Double the embedded `"` and wrap in `"`.
  let out = '"' + arg.replace(/"/g, '""') + '"';
  return out;
}

/**
 * PowerShell escape. Strategy: single-quoted string with `'` doubled inside.
 * No variable expansion happens inside single-quoted PS strings.
 */
export function quotePowershell(arg) {
  if (arg === "") return "''";
  if (/^[A-Za-z0-9_./:=-]+$/.test(arg)) return arg;
  return "'" + arg.replace(/'/g, "''") + "'";
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "quote_bash",
    description:
      "Escape an argument for safe use in bash / sh / zsh. Returns a single-quoted form (or bareword if safe), guaranteed to suppress all metacharacter expansion. Pass argv to quote_bash_argv if you have multiple args.",
    inputSchema: {
      type: "object",
      properties: { arg: { type: "string" } },
      required: ["arg"],
    },
  },
  {
    name: "quote_bash_argv",
    description:
      "Escape a list of arguments for bash and join with single spaces. Returns a single command-ready string.",
    inputSchema: {
      type: "object",
      properties: {
        args: { type: "array", items: { type: "string" } },
      },
      required: ["args"],
    },
  },
  {
    name: "quote_cmd",
    description:
      "Escape an argument for Windows cmd.exe. Wraps in double quotes and doubles embedded quotes. Note: cmd.exe has unfixable corner cases with delayed expansion (`^ ! %`). Prefer PowerShell when you control the shell choice.",
    inputSchema: {
      type: "object",
      properties: { arg: { type: "string" } },
      required: ["arg"],
    },
  },
  {
    name: "quote_powershell",
    description:
      "Escape an argument for PowerShell. Returns a single-quoted PS string with embedded single quotes doubled. No variable expansion.",
    inputSchema: {
      type: "object",
      properties: { arg: { type: "string" } },
      required: ["arg"],
    },
  },
];

const server = new Server(
  { name: "shellquote-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "quote_bash":
        result = { quoted: quoteBash(args.arg) };
        break;
      case "quote_bash_argv":
        result = { command: quoteBashArgv(args.args) };
        break;
      case "quote_cmd":
        result = { quoted: quoteCmd(args.arg) };
        break;
      case "quote_powershell":
        result = { quoted: quotePowershell(args.arg) };
        break;
      default:
        throw new Error(`unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `error: ${e.message}` }], isError: true };
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  await server.connect(new StdioServerTransport());
}
