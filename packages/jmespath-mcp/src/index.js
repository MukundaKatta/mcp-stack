#!/usr/bin/env node
// jmespath-mcp — JMESPath JSON queries as an MCP tool.
//
// LLMs handle shallow JSON paths fine but mess up deep traversal, array
// slicing, projections, and pipe operators. JMESPath is a complete query
// language (AWS uses it everywhere) with a pure-JS implementation.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import jmespath from "jmespath";

// --- pure logic ---

/**
 * Run a JMESPath expression against a JSON value. The value may be passed as
 * a JSON string (will be parsed) or as a pre-parsed object.
 */
export function jsonQuery(expression, data) {
  let value = data;
  if (typeof data === "string") {
    try {
      value = JSON.parse(data);
    } catch (e) {
      throw new Error(`invalid JSON input: ${e.message}`);
    }
  }
  try {
    return jmespath.search(value, expression);
  } catch (e) {
    throw new Error(`jmespath error: ${e.message}`);
  }
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "json_query",
    description:
      "Run a JMESPath expression against JSON. Use for deep traversal, projections (e.g. people[*].name), filters (locations[?state == 'WA']), pipes, and built-in functions (length, sort, contains). Pure-JS implementation, no jq binary needed.",
    inputSchema: {
      type: "object",
      properties: {
        expression: {
          type: "string",
          description:
            "JMESPath expression. Examples: foo.bar | items[*].name | locations[?state=='WA'].name | length(@).",
        },
        data: {
          description: "JSON to query. Pass as a JSON string OR a pre-parsed value.",
        },
      },
      required: ["expression", "data"],
    },
  },
];

const server = new Server(
  { name: "jmespath-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name !== "json_query") {
    return {
      content: [{ type: "text", text: `unknown tool: ${name}` }],
      isError: true,
    };
  }
  try {
    const result = jsonQuery(args.expression, args.data);
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `error: ${e.message}` }], isError: true };
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  await server.connect(new StdioServerTransport());
}
