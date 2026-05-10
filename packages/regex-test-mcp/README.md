# @mukundakatta/regex-test-mcp

MCP server for trustworthy regex testing. Three tools: `test_regex`, `find_all`, `replace`. All use the actual JS regex engine, so you get exact semantics for lookahead, anchors, named groups, and Unicode escapes.

## Why this exists

LLMs reliably hallucinate regex behavior. Common ways they're wrong:

- Confidently stating a pattern matches when it doesn't (or vice versa)
- Wrong group indices when there are nested capture groups
- Forgetting that `.` excludes newlines without the `s` flag
- Hand-rolling `replace` results that miss edge cases (`$&` semantics, named-group syntax)

Routing the actual test through this MCP server avoids all of those.

## Tools

| Tool | Returns |
|---|---|
| `test_regex(pattern, text, flags?)` | `{matched, match, start, end, groups, named_groups}` for the first match |
| `find_all(pattern, text, flags?)` | All non-overlapping matches (always behaves as `g`); zero-width safe |
| `replace(pattern, text, replacement, flags?)` | New string + `replaced` boolean; supports `$1`, `$<name>`, `$&` |

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "regex-test": { "command": "npx", "args": ["-y", "@mukundakatta/regex-test-mcp"] }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## License

MIT OR Apache-2.0.
