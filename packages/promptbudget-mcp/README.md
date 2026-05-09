# @mukundakatta/promptbudget-mcp

MCP server for token-budget-aware text truncation. Helps an LLM (Claude
Desktop, Cursor, Cline, Windsurf, Zed, anything MCP-compatible) fit text
into a context window mid-task.

## Tool

**`truncate_to_token_budget(text, max_tokens, strategy?)`**

Strategies:

| Strategy | Drops | Good for |
|---|---|---|
| `head` | tail | Long source documents you want to summarize from the top |
| `tail` (default) | head | Chat history where latest matters most |
| `head_tail` | middle | Instructions + latest turn both matter |
| `smart_cut` | middle, with visible marker | Same as head_tail but model knows truncation happened |

Returns a JSON object with the truncated text and token counts:

```json
{
  "truncated": "...",
  "original_tokens": 250,
  "truncated_tokens": 50,
  "strategy_used": "smart_cut"
}
```

Token counting uses an approximate `chars_per_token` proxy (default 4, the
OpenAI rule of thumb). For accurate token accounting against a real model
you'll want to wire up a real tokenizer at the LLM client side.

## Install — Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "promptbudget": {
      "command": "npx",
      "args": ["-y", "@mukundakatta/promptbudget-mcp"]
    }
  }
}
```

Restart Claude Desktop. The `truncate_to_token_budget` tool is now callable.

## Install — Cursor

`~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "promptbudget": {
      "command": "npx",
      "args": ["-y", "@mukundakatta/promptbudget-mcp"]
    }
  }
}
```

## Install — Cline / Windsurf / Zed

Same shape as above, in each tool's MCP server config file. The transport is
stdio over `npx -y @mukundakatta/promptbudget-mcp`.

## Run directly (no MCP client)

```bash
npx -y @mukundakatta/promptbudget-mcp
```

The server speaks MCP over stdio. Pair with [`mcptools`](https://github.com/f/mcptools)
or your client of choice.

## License

MIT OR Apache-2.0.
