# @mukundakatta/csv-tools-mcp

MCP server for reliable CSV parsing and generation. Three tools:

- **`parse_csv(text, has_header?, delimiter?)`** — RFC 4180 parsing with proper handling of quoted fields, embedded commas, escaped double quotes (`""`), CRLF/LF, and a leading BOM. Returns headers + objects (or raw arrays).
- **`to_csv(rows, headers?, delimiter?)`** — serialize arrays-of-arrays or arrays-of-objects with correct quoting.
- **`pluck_columns(rows, columns)`** — reduce parsed rows to just the named columns.

## Why this exists

LLMs ask for "the CSV parsed" and silently miss edge cases: a comma inside a quoted field, an escaped quote, a BOM that turns the first column header into `﻿name`. Routing through this MCP server gives you state-machine-correct parsing instead of best-effort imagination.

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "csv-tools": { "command": "npx", "args": ["-y", "@mukundakatta/csv-tools-mcp"] }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## License

MIT OR Apache-2.0.
