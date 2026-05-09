#!/usr/bin/env node
// citecite-mcp — MCP server for RAG citation marker [1] [2] handling.
//
// Three tools: inject, parse, strip.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// --- pure logic (also exported for tests) ---

/**
 * Inject citation markers into text.
 *
 * @param {string} text
 * @param {Array<{idx:number, source_id?:string}>} citations
 * @param {{at?: "end"|"position", position?: number}} options
 */
export function injectCitations(text, citations, options = {}) {
  if (!citations || citations.length === 0) return text;
  const at = options.at ?? "end";
  const markers = citations.map((c) => `[${c.idx}]`).join(" ");

  if (at === "end") {
    if (text === "") return markers;
    return text.endsWith(" ") ? `${text}${markers}` : `${text} ${markers}`;
  }

  if (at === "position") {
    let pos = Math.min(Math.max(0, options.position ?? text.length), text.length);
    // Snap back to a UTF-16 unit; treat any string as opaque.
    return `${text.slice(0, pos)}${markers}${text.slice(pos)}`;
  }

  throw new Error(`unknown 'at' value '${at}'. Use 'end' or 'position'.`);
}

/**
 * Find every [N] marker in text. Returns positions in source order.
 * Only matches `[<digits>]` with no internal whitespace.
 */
export function parseCitations(text) {
  const markers = [];
  // Greedy digit match between brackets.
  const re = /\[(\d+)\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    markers.push({ pos: m.index, idx: Number(m[1]), len: m[0].length });
  }
  return markers;
}

/**
 * Remove every [N] marker from text. Whitespace is left as-is.
 */
export function stripCitations(text) {
  return text.replace(/\[\d+\]/g, "");
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "inject_citations",
    description:
      "Append or insert [N] citation markers into RAG output text. Use after generating an answer to attach inline citations to the source list. Two modes: 'end' appends markers space-separated at the end; 'position' inserts at a given offset.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text to annotate." },
        citations: {
          type: "array",
          description: "Citations to insert. Each has an idx (the visible number) and an optional source_id (opaque key your RAG layer uses).",
          items: {
            type: "object",
            properties: {
              idx: { type: "integer", minimum: 1 },
              source_id: { type: "string" },
            },
            required: ["idx"],
          },
        },
        at: {
          type: "string",
          enum: ["end", "position"],
          default: "end",
        },
        position: {
          type: "integer",
          minimum: 0,
          description: "Required when at='position'. Insertion offset in chars.",
        },
      },
      required: ["text", "citations"],
    },
  },
  {
    name: "parse_citations",
    description:
      "Find every [N] marker in text. Returns position, the bracketed number, and the marker length. Only matches [<digits>] — text like [abc] is ignored.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  },
  {
    name: "strip_citations",
    description:
      "Remove every [N] marker from text. Whitespace around removed markers is left as-is; the caller can re-collapse if needed.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  },
];

const server = new Server(
  { name: "citecite-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "inject_citations":
        result = {
          text_with_citations: injectCitations(args.text, args.citations, {
            at: args.at,
            position: args.position,
          }),
        };
        break;
      case "parse_citations":
        result = { markers: parseCitations(args.text) };
        break;
      case "strip_citations":
        result = { stripped: stripCitations(args.text) };
        break;
      default:
        throw new Error(`unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (e) {
    return {
      content: [{ type: "text", text: `error: ${e.message}` }],
      isError: true,
    };
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  await server.connect(new StdioServerTransport());
}
