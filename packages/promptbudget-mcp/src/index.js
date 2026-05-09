#!/usr/bin/env node
// promptbudget-mcp — MCP server for token-budget-aware text truncation.
//
// Exposes one tool: `truncate_to_token_budget(text, max_tokens, strategy)`.
// Useful when an LLM needs to fit text into a context window mid-task.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// --- pure logic (also exported for tests) ---

const DEFAULT_CHARS_PER_TOKEN = 4;

export function countTokens(text, charsPerToken = DEFAULT_CHARS_PER_TOKEN) {
  if (!text) return 0;
  // Use Array.from for proper Unicode codepoint count, not byte length.
  const chars = Array.from(text).length;
  const cpt = Math.max(1, charsPerToken);
  return Math.ceil(chars / cpt);
}

function truncateHead(text, maxTokens, charsPerToken) {
  const cpt = Math.max(1, charsPerToken);
  const maxChars = maxTokens * cpt;
  return Array.from(text).slice(0, maxChars).join("");
}

function truncateTail(text, maxTokens, charsPerToken) {
  const cpt = Math.max(1, charsPerToken);
  const chars = Array.from(text);
  const maxChars = maxTokens * cpt;
  const skip = Math.max(0, chars.length - maxChars);
  return chars.slice(skip).join("");
}

const VALID_STRATEGIES = new Set(["head", "tail", "head_tail", "smart_cut"]);

export function truncateToTokenBudget(
  text,
  maxTokens,
  strategy = "tail",
  options = {},
) {
  if (!VALID_STRATEGIES.has(strategy)) {
    throw new Error(
      `unknown strategy '${strategy}'. Use head | tail | head_tail | smart_cut.`,
    );
  }
  const cpt = options.chars_per_token ?? DEFAULT_CHARS_PER_TOKEN;
  const headRatio = clamp01(options.head_ratio ?? 0.5);
  const marker = options.marker ?? "\n[...]\n";

  const original = countTokens(text, cpt);
  if (original <= maxTokens) {
    return {
      truncated: text,
      original_tokens: original,
      truncated_tokens: original,
      strategy_used: "passthrough",
    };
  }

  let out;
  let used = strategy;
  switch (strategy) {
    case "head":
      out = truncateHead(text, maxTokens, cpt);
      break;
    case "tail":
      out = truncateTail(text, maxTokens, cpt);
      break;
    case "head_tail": {
      const h = Math.round(maxTokens * headRatio);
      const t = Math.max(0, maxTokens - h);
      out = truncateHead(text, h, cpt) + truncateTail(text, t, cpt);
      break;
    }
    case "smart_cut": {
      const markerTokens = countTokens(marker, cpt);
      const usable = Math.max(0, maxTokens - markerTokens);
      const h = Math.round(usable * headRatio);
      const t = Math.max(0, usable - h);
      out =
        truncateHead(text, h, cpt) + marker + truncateTail(text, t, cpt);
      break;
    }
    // No default — strategy was validated up front.
  }

  return {
    truncated: out,
    original_tokens: original,
    truncated_tokens: countTokens(out, cpt),
    strategy_used: used,
  };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "truncate_to_token_budget",
    description:
      "Truncate text to fit within a token budget. Use when you need to put long text into an LLM context window without going over a token limit. Supports four strategies: head (keep beginning), tail (keep end, good for chat history), head_tail (drop the middle, keep both ends), and smart_cut (head_tail with a visible cut marker).",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text to truncate." },
        max_tokens: {
          type: "integer",
          minimum: 0,
          description: "Maximum tokens the result may use.",
        },
        strategy: {
          type: "string",
          enum: ["head", "tail", "head_tail", "smart_cut"],
          description: "Which truncation strategy to apply.",
          default: "tail",
        },
        chars_per_token: {
          type: "integer",
          minimum: 1,
          description:
            "Approx chars per token. Default 4 (OpenAI rule of thumb). For accurate token accounting against a real model, use a real tokenizer instead.",
          default: 4,
        },
        head_ratio: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description:
            "For head_tail and smart_cut: fraction of the budget reserved for the head. Default 0.5.",
          default: 0.5,
        },
        marker: {
          type: "string",
          description:
            "For smart_cut: marker inserted between head and tail. Default '\\n[...]\\n'.",
          default: "\n[...]\n",
        },
      },
      required: ["text", "max_tokens"],
    },
  },
];

const server = new Server(
  { name: "promptbudget-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (name !== "truncate_to_token_budget") {
    throw new Error(`unknown tool: ${name}`);
  }
  try {
    const result = truncateToTokenBudget(
      args.text,
      args.max_tokens,
      args.strategy ?? "tail",
      {
        chars_per_token: args.chars_per_token,
        head_ratio: args.head_ratio,
        marker: args.marker,
      },
    );
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  } catch (e) {
    return {
      content: [{ type: "text", text: `error: ${e.message}` }],
      isError: true,
    };
  }
});

// Start the server. Skipped when imported (e.g., from tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  await server.connect(new StdioServerTransport());
}
