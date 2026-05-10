#!/usr/bin/env node
// html-to-markdown-mcp — convert HTML to clean Markdown via Turndown.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import TurndownService from "turndown";

// --- pure logic ---

function makeTurndown(options = {}) {
  return new TurndownService({
    headingStyle: options.heading_style ?? "atx", // # vs underline
    codeBlockStyle: options.code_block_style ?? "fenced",
    bulletListMarker: options.bullet_list_marker ?? "-",
    emDelimiter: options.em_delimiter ?? "*",
    linkStyle: options.link_style ?? "inlined",
  });
}

export function htmlToMd(html, options = {}) {
  const td = makeTurndown(options);
  // Optionally strip script/style entirely.
  if (options.strip_scripts !== false) {
    td.remove(["script", "style", "noscript", "iframe"]);
  }
  return td.turndown(html);
}

export function extractText(html) {
  // Aggressive: strip all HTML, return text content with normalized whitespace.
  const noScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const stripped = noScripts.replace(/<[^>]+>/g, " ");
  // Decode the most common HTML entities.
  const decoded = stripped
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded.replace(/\s+/g, " ").trim();
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "html_to_md",
    description:
      "Convert an HTML string to Markdown. Strips script/style/iframe by default. Useful for read-the-page and web-scraping agents that want a clean source for an LLM to read or summarize. Note: this is intentionally not a full content-extraction pipeline (use Readability for that) — it's a faithful HTML-to-MD render.",
    inputSchema: {
      type: "object",
      properties: {
        html: { type: "string" },
        heading_style: { type: "string", enum: ["atx", "setext"], default: "atx" },
        code_block_style: { type: "string", enum: ["fenced", "indented"], default: "fenced" },
        bullet_list_marker: { type: "string", enum: ["-", "*", "+"], default: "-" },
        link_style: { type: "string", enum: ["inlined", "referenced"], default: "inlined" },
        strip_scripts: { type: "boolean", default: true },
      },
      required: ["html"],
    },
  },
  {
    name: "extract_text",
    description:
      "Strip all HTML tags and return whitespace-normalized text. Faster and simpler than html_to_md when you only need the text content (e.g. for embedding or full-text indexing).",
    inputSchema: {
      type: "object",
      properties: { html: { type: "string" } },
      required: ["html"],
    },
  },
];

const server = new Server(
  { name: "html-to-markdown-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "html_to_md":
        result = { markdown: htmlToMd(args.html, args) };
        break;
      case "extract_text":
        result = { text: extractText(args.html) };
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
