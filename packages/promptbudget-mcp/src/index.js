#!/usr/bin/env node
// promptbudget-mcp — MCP server for token-budget-aware text handling.
//
// Three tools:
//   - count_tokens: pre-flight check, optionally with a budget
//   - truncate_to_token_budget: trim text to fit
//   - chunk_to_budget: split long text into multiple under-budget chunks
//
// Useful when an LLM is preparing context, fitting chat history, or feeding
// long source documents through a prompt.

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

/**
 * Standalone count + optional budget check. Returns the count, the budget
 * (echoed back if provided), whether it fits, and the overflow amount.
 */
export function countWithBudget(text, options = {}) {
  const cpt = options.chars_per_token ?? DEFAULT_CHARS_PER_TOKEN;
  const tokens = countTokens(text, cpt);
  const max = options.max_tokens;
  if (max === undefined || max === null) {
    return { tokens, chars_per_token: cpt };
  }
  return {
    tokens,
    max_tokens: max,
    fits: tokens <= max,
    overflow_tokens: Math.max(0, tokens - max),
    chars_per_token: cpt,
  };
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
  }

  return {
    truncated: out,
    original_tokens: original,
    truncated_tokens: countTokens(out, cpt),
    strategy_used: strategy,
  };
}

/**
 * Split a long text into N chunks, each at most `max_tokens` tokens, with
 * optional overlap between adjacent chunks (useful for RAG ingestion so a
 * sentence isn't split across two chunks with no shared context).
 *
 * Boundaries respect Unicode codepoints (Array.from), not raw bytes.
 */
export function chunkToBudget(text, maxTokens, options = {}) {
  if (!Number.isInteger(maxTokens) || maxTokens <= 0) {
    throw new Error("max_tokens must be a positive integer");
  }
  const cpt = Math.max(1, options.chars_per_token ?? DEFAULT_CHARS_PER_TOKEN);
  const overlap = Math.max(0, options.overlap_tokens ?? 0);
  if (overlap >= maxTokens) {
    throw new Error("overlap_tokens must be strictly less than max_tokens");
  }

  const chars = Array.from(text);
  if (chars.length === 0) {
    return { chunks: [], chunk_count: 0, total_tokens: 0 };
  }

  const chunkChars = maxTokens * cpt;
  const overlapChars = overlap * cpt;
  const stepChars = chunkChars - overlapChars; // forward step per chunk

  const chunks = [];
  let start = 0;
  while (start < chars.length) {
    const end = Math.min(chars.length, start + chunkChars);
    chunks.push(chars.slice(start, end).join(""));
    if (end === chars.length) break;
    start += stepChars;
  }

  return {
    chunks,
    chunk_count: chunks.length,
    total_tokens: countTokens(text, cpt),
    chunk_max_tokens: maxTokens,
    overlap_tokens: overlap,
  };
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// --- MCP server wiring ---

const TOOLS = [
  {
    name: "count_tokens",
    description:
      "Count the approximate token usage of a text. Optionally compare against a budget and return a 'fits' flag plus overflow. Use as a pre-flight check before assembling a prompt: if count > budget, decide whether to truncate or chunk.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        max_tokens: {
          type: "integer",
          minimum: 0,
          description: "Optional. If provided, response includes 'fits' and 'overflow_tokens'.",
        },
        chars_per_token: {
          type: "integer",
          minimum: 1,
          default: 4,
          description: "Approx chars per token. Default 4 (OpenAI rule of thumb).",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "truncate_to_token_budget",
    description:
      "Truncate text to fit within a token budget. Four strategies: head (keep beginning), tail (keep end, good for chat history), head_tail (drop the middle, keep both ends), and smart_cut (head_tail with a visible cut marker). Use when you need to put long text into an LLM context window without going over a token limit.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The text to truncate." },
        max_tokens: { type: "integer", minimum: 0 },
        strategy: {
          type: "string",
          enum: ["head", "tail", "head_tail", "smart_cut"],
          default: "tail",
        },
        chars_per_token: { type: "integer", minimum: 1, default: 4 },
        head_ratio: {
          type: "number",
          minimum: 0,
          maximum: 1,
          default: 0.5,
          description: "For head_tail / smart_cut: fraction reserved for the head.",
        },
        marker: {
          type: "string",
          default: "\n[...]\n",
          description: "For smart_cut: marker inserted between head and tail.",
        },
      },
      required: ["text", "max_tokens"],
    },
  },
  {
    name: "chunk_to_budget",
    description:
      "Split a long text into multiple chunks, each at most max_tokens tokens, with optional overlap between adjacent chunks. Use when you have source material too long for one prompt and want to feed it through in pieces (for example, RAG ingestion or a fan-out summarize pattern). Overlap is useful so a sentence at a boundary still has surrounding context in the next chunk.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        max_tokens: {
          type: "integer",
          minimum: 1,
          description: "Maximum tokens per chunk.",
        },
        overlap_tokens: {
          type: "integer",
          minimum: 0,
          default: 0,
          description: "Tokens shared between adjacent chunks. Must be strictly less than max_tokens.",
        },
        chars_per_token: { type: "integer", minimum: 1, default: 4 },
      },
      required: ["text", "max_tokens"],
    },
  },
];

const server = new Server(
  { name: "promptbudget-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "count_tokens":
        result = countWithBudget(args.text, {
          max_tokens: args.max_tokens,
          chars_per_token: args.chars_per_token,
        });
        break;
      case "truncate_to_token_budget":
        result = truncateToTokenBudget(
          args.text,
          args.max_tokens,
          args.strategy ?? "tail",
          {
            chars_per_token: args.chars_per_token,
            head_ratio: args.head_ratio,
            marker: args.marker,
          },
        );
        break;
      case "chunk_to_budget":
        result = chunkToBudget(args.text, args.max_tokens, {
          overlap_tokens: args.overlap_tokens,
          chars_per_token: args.chars_per_token,
        });
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
