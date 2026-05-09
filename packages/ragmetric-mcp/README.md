# @mukundakatta/ragmetric-mcp

MCP server for RAG retrieval evaluation. Lets an LLM compute IR metrics on
demand: **Recall@k**, **Hit@k**, **MRR**, **NDCG@k**, plus an
**`evaluate_batch`** convenience that runs all four across many queries.

## Tools

| Tool | Returns |
|---|---|
| `recall_at_k(retrieved, relevant, k)` | Fraction of relevant items in top k |
| `hit_at_k(retrieved, relevant, k)` | 1.0 if any relevant in top k else 0 |
| `mrr(retrieved, relevant)` | 1 / rank of first relevant, 0 if none |
| `ndcg_at_k(retrieved, relevant, k)` | NDCG@k with binary relevance (log2 discount) |
| `evaluate_batch(queries, k)` | Mean of each metric across many queries |

`retrieved` and `relevant` are arrays of doc IDs (strings).

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "ragmetric": {
      "command": "npx",
      "args": ["-y", "@mukundakatta/ragmetric-mcp"]
    }
  }
}
```

## Install — Cursor / Cline / Windsurf / Zed

Same shape per tool. `npx -y @mukundakatta/ragmetric-mcp` over stdio.

## Use case

You're iterating on a RAG retriever. Hand the LLM a JSONL of queries with
ground-truth doc IDs, ask it to call `evaluate_batch`, and it returns the
mean metrics in one call. No notebook, no boto3, no scikit-learn.

## License

MIT OR Apache-2.0.
