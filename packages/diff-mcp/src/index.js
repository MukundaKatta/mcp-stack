#!/usr/bin/env node
// diff-mcp — character-precise unified diffs + patch application.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createTwoFilesPatch,
  applyPatch,
  parsePatch,
} from "diff";

// --- pure logic ---

export function unifiedDiff(oldText, newText, options = {}) {
  const oldFile = options.old_filename ?? "a";
  const newFile = options.new_filename ?? "b";
  const context = options.context ?? 3;
  const patch = createTwoFilesPatch(oldFile, newFile, oldText, newText, "", "", { context });
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  return {
    patch,
    additions: countLines(patch, "+"),
    deletions: countLines(patch, "-"),
    unchanged: oldLines.length - countLines(patch, "-"),
    new_total_lines: newLines.length,
  };
}

function countLines(patch, prefix) {
  return patch
    .split("\n")
    .filter((l) => l.startsWith(prefix) && !l.startsWith(prefix.repeat(3)))
    .length;
}

export function applyUnifiedPatch(originalText, patchText) {
  const result = applyPatch(originalText, patchText);
  if (result === false) {
    return { success: false, result: null, reason: "patch did not apply cleanly (context mismatch)" };
  }
  return { success: true, result };
}

export function parseUnifiedPatch(patchText) {
  const parsed = parsePatch(patchText);
  return {
    files: parsed.map((p) => ({
      old_filename: p.oldFileName,
      new_filename: p.newFileName,
      hunks: p.hunks.length,
      additions: p.hunks.reduce(
        (n, h) => n + h.lines.filter((l) => l.startsWith("+")).length,
        0,
      ),
      deletions: p.hunks.reduce(
        (n, h) => n + h.lines.filter((l) => l.startsWith("-")).length,
        0,
      ),
    })),
  };
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "unified_diff",
    description:
      "Generate a unified diff between two strings. Returns the patch text plus counts of additions / deletions / unchanged lines. Use this when an LLM needs to produce a code review or a patch the user (or a tool) will then apply.",
    inputSchema: {
      type: "object",
      properties: {
        old_text: { type: "string" },
        new_text: { type: "string" },
        old_filename: { type: "string", default: "a" },
        new_filename: { type: "string", default: "b" },
        context: { type: "integer", minimum: 0, default: 3, description: "Lines of context per hunk." },
      },
      required: ["old_text", "new_text"],
    },
  },
  {
    name: "apply_patch",
    description:
      "Apply a unified-diff patch to an original string. Returns success/false plus the patched text. Returns success:false with a reason when the patch can't apply cleanly (e.g. context drift).",
    inputSchema: {
      type: "object",
      properties: {
        original_text: { type: "string" },
        patch: { type: "string", description: "Unified-diff patch text." },
      },
      required: ["original_text", "patch"],
    },
  },
  {
    name: "parse_patch",
    description:
      "Parse a unified-diff patch and return its structure (file pairs, hunk count, addition/deletion counts per file). Useful for summarizing a patch before deciding whether to apply it.",
    inputSchema: {
      type: "object",
      properties: { patch: { type: "string" } },
      required: ["patch"],
    },
  },
];

const server = new Server(
  { name: "diff-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "unified_diff":
        result = unifiedDiff(args.old_text, args.new_text, {
          old_filename: args.old_filename,
          new_filename: args.new_filename,
          context: args.context,
        });
        break;
      case "apply_patch":
        result = applyUnifiedPatch(args.original_text, args.patch);
        break;
      case "parse_patch":
        result = parseUnifiedPatch(args.patch);
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
