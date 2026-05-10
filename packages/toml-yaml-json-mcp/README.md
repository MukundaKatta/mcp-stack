# @mukundakatta/toml-yaml-json-mcp

MCP server for round-tripping config formats. Parse, format, or convert between TOML, YAML, and JSON.

## Tools

- **`parse(text, format)`** — config string in, JS value out
- **`format(value, format)`** — JS value in, config string out
- **`convert(text, from, to)`** — TOML ↔ YAML ↔ JSON round trip

## Why this exists

LLMs reliably mishandle:

- TOML datetime literals
- TOML array-of-tables (`[[server]]`)
- TOML inline arrays vs nested keys
- YAML indentation traps
- YAML implicit type coercion (`yes` → `true`, etc.)

Routing through proper parsers (`@iarna/toml`, `js-yaml`, the built-in `JSON`) avoids guessing.

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "toml-yaml-json": { "command": "npx", "args": ["-y", "@mukundakatta/toml-yaml-json-mcp"] }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## License

MIT OR Apache-2.0.
