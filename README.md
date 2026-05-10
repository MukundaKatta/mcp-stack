# mcp-stack

Fourteen small MCP servers for everyday LLM / RAG / agent work. Each ships
independently on npm, listed in the [official MCP Registry](https://registry.modelcontextprotocol.io),
and is callable from Claude Desktop, Cursor, Cline, Windsurf, Zed, and any
other MCP-compatible client.

## RAG / agent helpers

| Package | Tools | When to install |
|---|---|---|
| [`@mukundakatta/promptbudget-mcp`](./packages/promptbudget-mcp/) | `truncate_to_token_budget` | LLM needs to fit text into a context window mid-task |
| [`@mukundakatta/citecite-mcp`](./packages/citecite-mcp/) | `inject_citations`, `parse_citations`, `strip_citations` | Round-trip `[1] [2]` markers in RAG outputs |
| [`@mukundakatta/ragmetric-mcp`](./packages/ragmetric-mcp/) | `recall_at_k`, `hit_at_k`, `mrr`, `ndcg_at_k`, `evaluate_batch` | LLM helps score retrieval quality |
| [`@mukundakatta/ragdrift-mcp`](./packages/ragdrift-mcp/) | `interpret_drift_score`, `recommend_thresholds`, `explain_drift_dimensions` | LLM diagnoses RAG drift alerts |

## Reliable transforms LLMs reach for tools instead of imagining

| Package | Tools | When to install |
|---|---|---|
| [`@mukundakatta/csv-tools-mcp`](./packages/csv-tools-mcp/) | `parse_csv`, `to_csv`, `pluck_columns` | LLM needs RFC 4180-correct CSV (quoted fields, embedded commas, BOMs) |
| [`@mukundakatta/regex-test-mcp`](./packages/regex-test-mcp/) | `test_regex`, `find_all`, `replace` | LLM needs exact regex semantics with real match offsets and named groups |
| [`@mukundakatta/jmespath-mcp`](./packages/jmespath-mcp/) | `json_query` | LLM needs deep JSON traversal (filters, projections, pipes) without hallucinating |
| [`@mukundakatta/diff-mcp`](./packages/diff-mcp/) | `unified_diff`, `apply_patch`, `parse_patch` | Code-review or code-edit agent needs character-precise patches |
| [`@mukundakatta/sqlfmt-mcp`](./packages/sqlfmt-mcp/) | `format_sql`, `list_dialects` | Deterministic SQL formatting across 19 dialects |
| [`@mukundakatta/shellquote-mcp`](./packages/shellquote-mcp/) | `quote_bash`, `quote_bash_argv`, `quote_cmd`, `quote_powershell` | Safe shell argument escaping; LLMs constantly mishandle quotes/$VAR |
| [`@mukundakatta/json5-mcp`](./packages/json5-mcp/) | `parse_json5`, `to_json5`, `to_strict_json` | LLM emitted JSON-with-comments / trailing-commas; round-trip to strict JSON |
| [`@mukundakatta/toml-yaml-json-mcp`](./packages/toml-yaml-json-mcp/) | `parse`, `format`, `convert` | TOML / YAML / JSON conversion (LLMs especially mishandle TOML) |
| [`@mukundakatta/timezone-mcp`](./packages/timezone-mcp/) | `convert_tz`, `now_in`, `tz_offset` | IANA timezone math with real DST rules; LLMs hallucinate offsets |
| [`@mukundakatta/html-to-markdown-mcp`](./packages/html-to-markdown-mcp/) | `html_to_md`, `extract_text` | Web-scraping agents need clean Markdown / text from HTML |

## Sibling libraries

The first four wrap or re-implement logic from the user's Rust + Python work:

- [`ragdrift`](https://crates.io/crates/ragdrift) (crates.io) /
  [`ragdrift-py`](https://pypi.org/project/ragdrift-py/) (PyPI) — five-dimensional drift detection
- [`embedrank`](https://crates.io/crates/embedrank), [`promptbudget`](https://crates.io/crates/promptbudget),
  [`stopstream`](https://crates.io/crates/stopstream), [`citecite`](https://crates.io/crates/citecite),
  [`ragmetric`](https://crates.io/crates/ragmetric) — pure-Rust crates from
  the [`rust-llm-stack`](https://github.com/MukundaKatta/rust-llm-stack) workspace

The MCP servers are independent: they implement the logic they need in plain
JavaScript so installing them doesn't pull a Rust toolchain.

## Install (any of them)

Add to your MCP client config. Example for Claude Desktop:

```json
{
  "mcpServers": {
    "promptbudget": { "command": "npx", "args": ["-y", "@mukundakatta/promptbudget-mcp"] },
    "citecite":     { "command": "npx", "args": ["-y", "@mukundakatta/citecite-mcp"] },
    "ragmetric":    { "command": "npx", "args": ["-y", "@mukundakatta/ragmetric-mcp"] },
    "ragdrift":     { "command": "npx", "args": ["-y", "@mukundakatta/ragdrift-mcp"] },
    "csv-tools":    { "command": "npx", "args": ["-y", "@mukundakatta/csv-tools-mcp"] },
    "regex-test":   { "command": "npx", "args": ["-y", "@mukundakatta/regex-test-mcp"] },
    "jmespath":     { "command": "npx", "args": ["-y", "@mukundakatta/jmespath-mcp"] },
    "diff":           { "command": "npx", "args": ["-y", "@mukundakatta/diff-mcp"] },
    "sqlfmt":         { "command": "npx", "args": ["-y", "@mukundakatta/sqlfmt-mcp"] },
    "shellquote":     { "command": "npx", "args": ["-y", "@mukundakatta/shellquote-mcp"] },
    "json5":          { "command": "npx", "args": ["-y", "@mukundakatta/json5-mcp"] },
    "toml-yaml-json": { "command": "npx", "args": ["-y", "@mukundakatta/toml-yaml-json-mcp"] },
    "timezone":       { "command": "npx", "args": ["-y", "@mukundakatta/timezone-mcp"] },
    "html-to-md":     { "command": "npx", "args": ["-y", "@mukundakatta/html-to-markdown-mcp"] }
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
