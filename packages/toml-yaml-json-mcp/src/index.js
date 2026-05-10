#!/usr/bin/env node
// toml-yaml-json-mcp — parse + format + convert across TOML / YAML / JSON.
//
// LLMs are okay at JSON, mediocre at YAML, and routinely wrong at TOML
// (datetime tables, inline-array vs array-of-tables). Routing through this
// server gives you correct round trips.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import TOML from "@iarna/toml";
import yaml from "js-yaml";

// --- pure logic ---

const FORMATS = ["toml", "yaml", "json"];

function assertFormat(f, field) {
  if (!FORMATS.includes(f)) {
    throw new Error(`${field} must be one of: ${FORMATS.join(", ")} (got '${f}')`);
  }
}

export function parseConfig(text, format) {
  assertFormat(format, "format");
  try {
    if (format === "toml") return TOML.parse(text);
    if (format === "yaml") return yaml.load(text);
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`${format} parse error: ${e.message}`);
  }
}

export function formatConfig(value, format) {
  assertFormat(format, "format");
  try {
    if (format === "toml") return TOML.stringify(value);
    if (format === "yaml") return yaml.dump(value, { lineWidth: 100, noRefs: true });
    return JSON.stringify(value, null, 2);
  } catch (e) {
    throw new Error(`${format} format error: ${e.message}`);
  }
}

export function convert(text, from, to) {
  const value = parseConfig(text, from);
  return formatConfig(value, to);
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "parse",
    description:
      "Parse a config string (TOML, YAML, or JSON) into a value. Returns the parsed value as JSON.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        format: { type: "string", enum: FORMATS },
      },
      required: ["text", "format"],
    },
  },
  {
    name: "format",
    description:
      "Serialize a value into TOML, YAML, or JSON. Use to generate config files an LLM-produced value would otherwise mangle (TOML especially).",
    inputSchema: {
      type: "object",
      properties: {
        value: { description: "Any JSON-serializable value." },
        format: { type: "string", enum: FORMATS },
      },
      required: ["value", "format"],
    },
  },
  {
    name: "convert",
    description:
      "Round-trip a config from one format to another (TOML <-> YAML <-> JSON). Useful when an upstream tool produced one and a downstream tool wants the other.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        from: { type: "string", enum: FORMATS },
        to: { type: "string", enum: FORMATS },
      },
      required: ["text", "from", "to"],
    },
  },
];

const server = new Server(
  { name: "toml-yaml-json-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "parse":
        result = { value: parseConfig(args.text, args.format) };
        break;
      case "format":
        result = { text: formatConfig(args.value, args.format) };
        break;
      case "convert":
        result = { text: convert(args.text, args.from, args.to) };
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
