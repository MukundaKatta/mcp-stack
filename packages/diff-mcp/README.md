# @mukundakatta/diff-mcp

MCP server for character-precise unified diffs + patch application + patch parsing. For code-review and code-edit agents.

## Why this exists

LLMs hand-roll diffs that look right but won't apply: off-by-one line numbers, missing context lines, wrong hunk headers. Routing through this server produces patches that the standard `patch` utility (and `git apply`) accept on the first try.

## Tools

| Tool | Returns |
|---|---|
| `unified_diff(old_text, new_text, ...)` | Patch text plus addition / deletion / unchanged line counts |
| `apply_patch(original_text, patch)` | `{success, result, reason?}` — `success:false` means context drift |
| `parse_patch(patch)` | File list with per-file hunk count + addition / deletion totals |

## Install — Claude Desktop

```json
{
  "mcpServers": {
    "diff": { "command": "npx", "args": ["-y", "@mukundakatta/diff-mcp"] }
  }
}
```

Same shape for Cursor / Cline / Windsurf / Zed.

## License

MIT OR Apache-2.0.
