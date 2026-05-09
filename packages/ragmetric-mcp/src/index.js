#!/usr/bin/env node
// ragmetric-mcp — IR metrics for RAG retrieval evaluation as MCP tools.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// --- pure logic ---

export function recallAtK(retrieved, relevant, k) {
  if (!relevant || relevant.length === 0) return 0;
  const rel = new Set(relevant);
  const take = Math.min(retrieved.length, k);
  let hits = 0;
  for (let i = 0; i < take; i++) if (rel.has(retrieved[i])) hits++;
  return hits / relevant.length;
}

export function hitAtK(retrieved, relevant, k) {
  if (!relevant || relevant.length === 0) return 0;
  const rel = new Set(relevant);
  const take = Math.min(retrieved.length, k);
  for (let i = 0; i < take; i++) if (rel.has(retrieved[i])) return 1;
  return 0;
}

export function mrr(retrieved, relevant) {
  if (!relevant || relevant.length === 0) return 0;
  const rel = new Set(relevant);
  for (let i = 0; i < retrieved.length; i++) {
    if (rel.has(retrieved[i])) return 1 / (i + 1);
  }
  return 0;
}

export function ndcgAtK(retrieved, relevant, k) {
  if (!relevant || relevant.length === 0 || k === 0) return 0;
  const rel = new Set(relevant);
  const take = Math.min(retrieved.length, k);
  let dcg = 0;
  for (let i = 0; i < take; i++) {
    if (rel.has(retrieved[i])) dcg += 1 / Math.log2(i + 2);
  }
  const nIdeal = Math.min(relevant.length, k);
  let idcg = 0;
  for (let i = 0; i < nIdeal; i++) idcg += 1 / Math.log2(i + 2);
  return idcg === 0 ? 0 : dcg / idcg;
}

export function evaluateBatch(queries, k) {
  if (!queries || queries.length === 0) {
    return {
      mean_recall_at_k: 0,
      mean_hit_at_k: 0,
      mean_mrr: 0,
      mean_ndcg_at_k: 0,
      n_queries: 0,
    };
  }
  let sr = 0, sh = 0, sm = 0, sn = 0;
  for (const q of queries) {
    sr += recallAtK(q.retrieved, q.relevant, k);
    sh += hitAtK(q.retrieved, q.relevant, k);
    sm += mrr(q.retrieved, q.relevant);
    sn += ndcgAtK(q.retrieved, q.relevant, k);
  }
  const n = queries.length;
  return {
    mean_recall_at_k: sr / n,
    mean_hit_at_k: sh / n,
    mean_mrr: sm / n,
    mean_ndcg_at_k: sn / n,
    n_queries: n,
  };
}

// --- MCP server wiring ---

const arrSchema = { type: "array", items: { type: "string" } };
const querySchema = {
  type: "object",
  properties: {
    retrieved: arrSchema,
    relevant: arrSchema,
  },
  required: ["retrieved", "relevant"],
};

const TOOLS = [
  {
    name: "recall_at_k",
    description:
      "Recall@k: fraction of relevant doc IDs in the top k retrieved. Use this when you have ground-truth relevance for a query and want to measure how well the retriever surfaced the right docs.",
    inputSchema: {
      type: "object",
      properties: {
        retrieved: { ...arrSchema, description: "Doc IDs returned by retriever, in rank order." },
        relevant: { ...arrSchema, description: "Ground-truth relevant doc IDs (binary relevance)." },
        k: { type: "integer", minimum: 1 },
      },
      required: ["retrieved", "relevant", "k"],
    },
  },
  {
    name: "hit_at_k",
    description:
      "Hit@k: 1.0 if any relevant doc appears in top k, else 0.0. Useful when 'did we get at least one right?' is what matters.",
    inputSchema: {
      type: "object",
      properties: {
        retrieved: arrSchema,
        relevant: arrSchema,
        k: { type: "integer", minimum: 1 },
      },
      required: ["retrieved", "relevant", "k"],
    },
  },
  {
    name: "mrr",
    description:
      "Mean Reciprocal Rank: 1 / rank of first relevant doc, 0 if none retrieved. Ranks are 1-based. For a single query.",
    inputSchema: {
      type: "object",
      properties: { retrieved: arrSchema, relevant: arrSchema },
      required: ["retrieved", "relevant"],
    },
  },
  {
    name: "ndcg_at_k",
    description:
      "NDCG@k with binary relevance. Discount = log2(rank + 1). Returns DCG@k / IDCG@k. Penalizes putting relevant docs lower in the ranking.",
    inputSchema: {
      type: "object",
      properties: {
        retrieved: arrSchema,
        relevant: arrSchema,
        k: { type: "integer", minimum: 1 },
      },
      required: ["retrieved", "relevant", "k"],
    },
  },
  {
    name: "evaluate_batch",
    description:
      "Run all four metrics over a batch of queries and return per-metric means. Use this when you have multiple eval queries and want one summary number per metric.",
    inputSchema: {
      type: "object",
      properties: {
        queries: { type: "array", items: querySchema },
        k: { type: "integer", minimum: 1 },
      },
      required: ["queries", "k"],
    },
  },
];

const server = new Server(
  { name: "ragmetric-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result;
    switch (name) {
      case "recall_at_k":
        result = { recall_at_k: recallAtK(args.retrieved, args.relevant, args.k) };
        break;
      case "hit_at_k":
        result = { hit_at_k: hitAtK(args.retrieved, args.relevant, args.k) };
        break;
      case "mrr":
        result = { mrr: mrr(args.retrieved, args.relevant) };
        break;
      case "ndcg_at_k":
        result = { ndcg_at_k: ndcgAtK(args.retrieved, args.relevant, args.k) };
        break;
      case "evaluate_batch":
        result = evaluateBatch(args.queries, args.k);
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
