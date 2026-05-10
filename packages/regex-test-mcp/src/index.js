#!/usr/bin/env node
// regex-test-mcp — exact JS regex semantics as MCP tools.
//
// LLMs hallucinate regex behavior, especially around lookahead, anchors,
// group numbering, and named capture groups. These tools route the test
// through the actual JS engine and return concrete offsets + groups.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// --- pure logic ---

function compile(pattern, flags = "") {
  // Make sure global flag is on for find_all; explicit `g` is fine to add.
  return new RegExp(pattern, flags);
}

export function testRegex(pattern, text, flags = "") {
  const re = compile(pattern, flags);
  const m = re.exec(text);
  if (!m) {
    return { matched: false };
  }
  return {
    matched: true,
    match: m[0],
    start: m.index,
    end: m.index + m[0].length,
    groups: m.slice(1),
    named_groups: m.groups ?? {},
  };
}

export function findAll(pattern, text, flags = "") {
  const f = flags.includes("g") ? flags : flags + "g";
  const re = compile(pattern, f);
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      match: m[0],
      start: m.index,
      end: m.index + m[0].length,
      groups: m.slice(1),
      named_groups: m.groups ?? {},
    });
    // Avoid infinite loop on zero-width matches.
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return { matches: out, count: out.length };
}

export function replace(pattern, text, replacement, flags = "") {
  const f = flags.includes("g") ? flags : flags + "g";
  const re = compile(pattern, f);
  const result = text.replace(re, replacement);
  return { result, replaced: text !== result };
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "test_regex",
    description:
      "Test a regex pattern against a string and return the first match (or 'matched: false'). Returns the match text, start/end byte offsets, positional groups, and named groups. Use when you need to confirm whether a pattern matches before generating downstream output.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "JS regex pattern (no surrounding slashes)." },
        text: { type: "string" },
        flags: { type: "string", default: "", description: "JS regex flags, e.g. 'i', 'gm', 'isu'." },
      },
      required: ["pattern", "text"],
    },
  },
  {
    name: "find_all",
    description:
      "Find every non-overlapping match of a pattern in a string. Always behaves as if the 'g' flag is set. Returns a list of {match, start, end, groups, named_groups} entries plus a count. Safe against zero-width matches (won't infinite-loop).",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        text: { type: "string" },
        flags: { type: "string", default: "" },
      },
      required: ["pattern", "text"],
    },
  },
  {
    name: "replace",
    description:
      "Replace every match of a pattern with a replacement string. Replacement supports JS replace syntax: $1 / $2 for positional groups, $<name> for named groups, $& for the whole match. Returns the new string and a 'replaced' boolean.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        text: { type: "string" },
        replacement: { type: "string" },
        flags: { type: "string", default: "" },
      },
      required: ["pattern", "text", "replacement"],
    },
  },
];

const server = new Server(
  { name: "regex-test-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "test_regex":
        result = testRegex(args.pattern, args.text, args.flags ?? "");
        break;
      case "find_all":
        result = findAll(args.pattern, args.text, args.flags ?? "");
        break;
      case "replace":
        result = replace(args.pattern, args.text, args.replacement, args.flags ?? "");
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
