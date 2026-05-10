# @mukundakatta/timezone-mcp

MCP server for IANA timezone conversions. Real DST rules, real offsets via the built-in `Intl.DateTimeFormat`. No `tzdata` dependency, no native binary — Node ships the IANA database.

## Tools

- **`convert_tz(instant, timezone)`** — UTC ISO → local in target tz
- **`now_in(timezone)`** — current local time in target tz
- **`tz_offset(instant, timezone)`** — UTC offset at that exact instant (DST-aware)

## Why this exists

LLMs hallucinate timezone offsets and DST transition dates. They will confidently say "PST is UTC-8" in summer (it's PDT, UTC-7). They get India's `+5:30` half-hour offset wrong. Routing through `Intl.DateTimeFormat` returns whatever the actual IANA rules say.

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "timezone": { "command": "npx", "args": ["-y", "@mukundakatta/timezone-mcp"] }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## License

MIT OR Apache-2.0.
