# @mukundakatta/json5-mcp

MCP server for JSON5: parse JSON-with-comments, trailing commas, unquoted keys, hex / NaN / Infinity. Round-trip to strict JSON when downstream tools require it.

## Tools

- **`parse_json5(text)`** — loose parse to a real value
- **`to_json5(value, indent?)`** — serialize for human-edited config
- **`to_strict_json(text, indent?)`** — JSON5 in, strict JSON out

## Why this exists

LLMs frequently emit JSON-with-comments thinking it's JSON. They also see config files (tsconfig, .babelrc, mcp.json) that are JSON5 in disguise. This server is the loose-parse + strict-emit round trip — feed it whatever the LLM produced, get back something `JSON.parse` accepts.

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "json5": { "command": "npx", "args": ["-y", "@mukundakatta/json5-mcp"] }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## License

MIT OR Apache-2.0.
