# mcp-stack

Four small MCP servers for the LLM / RAG / agent niche. Each ships
independently on npm and is callable from Claude Desktop, Cursor, Cline,
Windsurf, Zed, and any other MCP-compatible client.

| Package | Tools | When to install |
|---|---|---|
| [`@mukundakatta/promptbudget-mcp`](./packages/promptbudget-mcp/) | `truncate_to_token_budget` | LLM needs to fit text into a context window mid-task |
| [`@mukundakatta/citecite-mcp`](./packages/citecite-mcp/) | `inject_citations`, `parse_citations`, `strip_citations` | Round-trip `[1] [2]` markers in RAG outputs |
| [`@mukundakatta/ragmetric-mcp`](./packages/ragmetric-mcp/) | `recall_at_k`, `hit_at_k`, `mrr`, `ndcg_at_k`, `evaluate_batch` | LLM helps score retrieval quality |
| [`@mukundakatta/ragdrift-mcp`](./packages/ragdrift-mcp/) | `interpret_drift_score`, `recommend_thresholds`, `explain_drift_dimensions` | LLM diagnoses RAG drift alerts |

## Sibling libraries

The Rust + Python implementations of the underlying logic ship separately:

- [`ragdrift`](https://crates.io/crates/ragdrift) (crates.io) /
  [`ragdrift-py`](https://pypi.org/project/ragdrift-py/) (PyPI) — five-dimensional drift detection
- [`embedrank`](https://crates.io/crates/embedrank), [`promptbudget`](https://crates.io/crates/promptbudget),
  [`stopstream`](https://crates.io/crates/stopstream), [`citecite`](https://crates.io/crates/citecite),
  [`ragmetric`](https://crates.io/crates/ragmetric) — pure-Rust crates from
  the [`rust-llm-stack`](https://github.com/MukundaKatta/rust-llm-stack) workspace

The MCP servers are independent: they re-implement the small bits of logic
they need in plain JavaScript so installing them doesn't pull a Rust toolchain.

## Install (any of them)

Add to your MCP client config. Example for Claude Desktop:

```json
{
  "mcpServers": {
    "promptbudget": { "command": "npx", "args": ["-y", "@mukundakatta/promptbudget-mcp"] },
    "citecite":     { "command": "npx", "args": ["-y", "@mukundakatta/citecite-mcp"] },
    "ragmetric":    { "command": "npx", "args": ["-y", "@mukundakatta/ragmetric-mcp"] },
    "ragdrift":     { "command": "npx", "args": ["-y", "@mukundakatta/ragdrift-mcp"] }
  }
}
```

## Develop

```bash
git clone https://github.com/MukundaKatta/mcp-stack
cd mcp-stack
npm install
npm test --workspaces
```

## License

MIT OR Apache-2.0.
