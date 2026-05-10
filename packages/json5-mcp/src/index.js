#!/usr/bin/env node
// json5-mcp — parse JSON5 (JSON with comments / trailing commas / single quotes)
// and emit strict JSON. LLMs frequently emit JSON5 thinking it's JSON; this
// server is the loose-parse + strict-emit round trip.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import JSON5 from "json5";

// --- pure logic ---

export function parseJson5(text) {
  try {
    return JSON5.parse(text);
  } catch (e) {
    throw new Error(`JSON5 parse error: ${e.message}`);
  }
}

export function toJson5(value, indent = 2) {
  return JSON5.stringify(value, null, indent);
}

export function toStrictJson(text, indent = 2) {
  const value = parseJson5(text);
  return JSON.stringify(value, null, indent);
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "parse_json5",
    description:
      "Parse a JSON5 string (comments, trailing commas, single-quoted strings, unquoted keys, hex/Inf/NaN). Returns the parsed value as JSON. Use when you got something that 'looks like JSON but with comments' from a config file or an LLM and need a real value.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  {
    name: "to_json5",
    description:
      "Serialize a value to JSON5 (allows unquoted keys and trailing commas). Useful when generating config snippets that humans will edit.",
    inputSchema: {
      type: "object",
      properties: {
        value: { description: "Any JSON-serializable value." },
        indent: { type: "integer", minimum: 0, maximum: 8, default: 2 },
      },
      required: ["value"],
    },
  },
  {
    name: "to_strict_json",
    description:
      "Round-trip JSON5 text into strict JSON. Useful when an upstream tool produced JSON5 and a downstream tool requires strict JSON.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "JSON5 text." },
        indent: { type: "integer", minimum: 0, maximum: 8, default: 2 },
      },
      required: ["text"],
    },
  },
];

const server = new Server(
  { name: "json5-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "parse_json5":
        result = { value: parseJson5(args.text) };
        break;
      case "to_json5":
        result = { json5: toJson5(args.value, args.indent ?? 2) };
        break;
      case "to_strict_json":
        result = { json: toStrictJson(args.text, args.indent ?? 2) };
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
