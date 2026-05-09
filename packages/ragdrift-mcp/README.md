# @mukundakatta/ragdrift-mcp

MCP server for diagnosing RAG drift. Lets an LLM reason about drift scores
without needing to install Rust or PyO3.

Sibling to the [`ragdrift`](https://crates.io/crates/ragdrift) crate +
[`ragdrift-py`](https://pypi.org/project/ragdrift-py/) PyPI wheel — this MCP
server is the *interpretation* layer; the actual drift detection happens in
those libraries (or your existing telemetry).

## Tools

- **`interpret_drift_score(score, dimension, threshold?)`** — plain-English
  interpretation, severity classification, suggested next steps.
- **`recommend_thresholds(dimension, sample_size, false_positive_budget)`** —
  threshold values tuned to your sample size and FP budget.
- **`explain_drift_dimensions()`** — structured reference for all 5 dimensions
  (data, embedding, response, confidence, query).

## When to install

Install when you want Claude Desktop / Cursor / Cline / Windsurf / Zed to
help diagnose RAG drift alerts. Example session:

> User: "Got an embedding-drift alert with score 0.27 on a sample of 500.
> Should I be worried?"
>
> LLM (calling `interpret_drift_score`): "Score 0.27 on the embedding
> dimension lands in the 'significant shift, investigate' band. The
> underlying methods are MMD² (RBF kernel) and sliced Wasserstein-1. Likely
> next steps: did the embedding model change? Was the corpus re-indexed?
> Compare baseline and current document samples."

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "ragdrift": {
      "command": "npx",
      "args": ["-y", "@mukundakatta/ragdrift-mcp"]
    }
  }
}
```

## Install — Cursor / Cline / Windsurf / Zed

Same shape per tool. `npx -y @mukundakatta/ragdrift-mcp` over stdio.

## License

MIT OR Apache-2.0.
