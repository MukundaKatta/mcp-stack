# @mukundakatta/jmespath-mcp

MCP server for JMESPath JSON queries. One tool: `json_query(expression, data)`. Pure JavaScript implementation, no jq binary needed (works the same on macOS / Linux / Windows).

## Why this exists

LLMs handle shallow JSON paths well (`foo.bar.baz`) but reliably mess up:

- Array projections (`people[*].name`)
- Filters (`locations[?state == 'WA']`)
- Pipes and built-in functions (`length`, `sort_by`, `contains`, `keys`)
- Round-trips through `to_entries` / `from_entries`

JMESPath is the AWS-standardized query language for JSON. This server runs your expression through the real JMESPath engine and returns the result.

## Why JMESPath instead of jq?

`node-jq` requires a postinstall step that downloads the jq binary, which fails reliably on Windows. JMESPath is pure JavaScript with no native dependencies. The query language is similar enough for most LLM use-cases (deep paths, filters, projections, built-ins).

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "jmespath": { "command": "npx", "args": ["-y", "@mukundakatta/jmespath-mcp"] }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## Tutorial

See https://jmespath.org/tutorial.html for the language. Common patterns:

- `foo.bar` — nested key access
- `people[*].name` — pluck from each item
- `people[?age > \`30\`].name` — filter then project
- `sort_by(people, &age)[*].name` — sort + project
- `keys(@)`, `values(@)`, `length(@)` — basic functions

## License

MIT OR Apache-2.0.
