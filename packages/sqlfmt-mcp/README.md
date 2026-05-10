# @mukundakatta/sqlfmt-mcp

MCP server for deterministic SQL formatting across 19 dialects.

## Tools

- **`format_sql(sql, dialect?, keyword_case?, tab_width?, use_tabs?)`** — format with the named dialect (default `sql` for ANSI). Returns formatted text + line count.
- **`list_dialects()`** — return the list of supported dialects so an LLM can confirm before formatting.

## Why this exists

LLMs format SQL inconsistently across turns: same query, different indentation, different keyword casing. Code-review agents and downstream tooling that diffs SQL want one canonical form. Wrapping the well-tested `sql-formatter` library here gives you that.

## Supported dialects

`sql`, `bigquery`, `db2`, `db2i`, `duckdb`, `hive`, `mariadb`, `mysql`, `n1ql`, `plsql`, `postgresql`, `redshift`, `singlestoredb`, `snowflake`, `spark`, `sqlite`, `tidb`, `transactsql`, `trino`.

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "sqlfmt": { "command": "npx", "args": ["-y", "@mukundakatta/sqlfmt-mcp"] }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## License

MIT OR Apache-2.0.
